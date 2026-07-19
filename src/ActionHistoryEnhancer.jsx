import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref, runTransaction } from "firebase/database";
import { db } from "./firebase";
import { TEAM_NAMES } from "./game/engine";

const MAX_ACTIONS = 200;

function orderedMembers(room) {
  return Object.values(room?.members || {}).sort((a, b) => Number(a.seat || 0) - Number(b.seat || 0));
}

function actionFingerprint(room) {
  const state = room?.publicState || {};
  const boardCounts = Object.entries(state.teamBoards || {})
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([team, board]) => [
      team,
      (Array.isArray(board) ? board : []).map((meld) => [
        meld?.rank || "",
        (meld?.cards || []).map((card) => card?.id || "").filter(Boolean).sort(),
      ]),
    ]);
  const handCounts = Object.entries(state.handCounts || {})
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
  const discard = Array.isArray(state.discardPile) ? state.discardPile : [];

  return JSON.stringify({
    hand: Number(room?.handNumber || 0),
    message: String(state.lastAction || ""),
    player: Number(state.currentPlayerIndex || 0),
    phase: String(state.phase || ""),
    turnPhase: String(state.turnPhase || ""),
    stock: Number(state.stockCount || 0),
    discardCount: discard.length,
    discardTop: discard.at(-1)?.id || "",
    handCounts,
    boardCounts,
  });
}

function normalizeActions(value) {
  const actions = Array.isArray(value) ? value : Object.values(value || {});
  return actions
    .filter((item) => item && typeof item.message === "string" && item.message.trim())
    .sort((left, right) => Number(left.sequence || left.createdAt || 0) - Number(right.sequence || right.createdAt || 0));
}

function actorForMessage(room, message) {
  const members = orderedMembers(room);
  return members.find((member) => message.startsWith(`${member.nickname} `)) || null;
}

function displayTime(createdAt) {
  const time = Number(createdAt || 0);
  if (!time) return "";
  return new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ActionHistoryEnhancer() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [scoreTarget, setScoreTarget] = useState(null);
  const logRef = useRef(null);

  useEffect(() => {
    const scan = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
      setScoreTarget(document.querySelector(".score-sidebar-content"));
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  const members = useMemo(() => orderedMembers(room), [room]);
  const actions = useMemo(
    () => normalizeActions(room?.publicState?.actionLog),
    [room?.publicState?.actionLog],
  );

  useEffect(() => {
    if (!roomCode || !room?.publicState?.lastAction || !db) return;
    const message = String(room.publicState.lastAction).trim();
    if (!message) return;
    const fingerprint = actionFingerprint(room);
    const actor = actorForMessage(room, message);

    runTransaction(ref(db, `rooms/${roomCode}/publicState`), (publicState) => {
      if (!publicState || String(publicState.lastAction || "").trim() !== message) return publicState;
      const actionLog = normalizeActions(publicState.actionLog);
      if (actionLog.at(-1)?.fingerprint === fingerprint) return publicState;

      const sequence = Number(actionLog.at(-1)?.sequence || 0) + 1;
      actionLog.push({
        id: `${Number(room.handNumber || 0)}-${sequence}`,
        sequence,
        handNumber: Number(room.handNumber || 0),
        actorUid: actor?.uid || "",
        actorName: actor?.nickname || "Table",
        message,
        createdAt: Date.now(),
        fingerprint,
      });
      publicState.actionLog = actionLog.slice(-MAX_ACTIONS);
      return publicState;
    }, { applyLocally: false }).catch(() => {});
  }, [roomCode, room?.publicState?.lastAction, room?.publicState?.currentPlayerIndex, room?.publicState?.turnPhase, room?.publicState?.stockCount, room?.handNumber]);

  useEffect(() => {
    const element = logRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [actions.length]);

  if (!scoreTarget || !room) return null;

  return createPortal(
    <>
      <section className="public-hand-counts" aria-label="Public player hand counts">
        <div className="public-hand-counts-heading">
          <b>Cards in hand</b>
          <small>Counts only — cards stay private</small>
        </div>
        <div className="public-hand-count-grid">
          {members.map((member) => (
            <article key={member.uid} className={room.publicState?.currentPlayerIndex === member.seat ? "active" : ""}>
              <span className="public-hand-avatar">{member.avatar}</span>
              <div>
                <b>{member.nickname}</b>
                <small>{TEAM_NAMES[member.team] || `Team ${Number(member.team) + 1}`}</small>
              </div>
              <strong>{Number(room.publicState?.handCounts?.[member.uid] || 0)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="action-history-panel" aria-label="All table actions">
        <div className="action-history-heading">
          <div><b>Table actions</b><small>All players · newest at bottom</small></div>
          <span>{actions.length}</span>
        </div>
        <div className="action-history-list" ref={logRef} role="log" aria-live="polite">
          {actions.length ? actions.map((action) => (
            <article key={action.id || `${action.sequence}-${action.createdAt}`}>
              <div className="action-history-meta">
                <b>{action.actorName || "Table"}</b>
                <time>{displayTime(action.createdAt)}</time>
              </div>
              <p>{action.message}</p>
            </article>
          )) : <p className="action-history-empty">Actions will appear here as players draw, meld, discard, undo, and complete turns.</p>}
        </div>
      </section>
    </>,
    scoreTarget,
  );
}
