import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref } from "firebase/database";
import { auth, db } from "./firebase";
import { playGroupedMelds, undoLastPlay } from "./game/multiMeldActions";
import { guaranteePileUnfrozenAfterPickup } from "./game/discardStateRepair";
import { cardPoints, isWild, SUIT_SYMBOLS } from "./game/engine";

function labelFor(card) {
  return `${card.rank} ${SUIT_SYMBOLS[card.suit] || "★"}`;
}

function applyBoardColors() {
  document.querySelectorAll(".board-meld .real-card").forEach((card) => {
    const label = card.getAttribute("aria-label") || "";
    const red = label.includes("♥") || label.includes("♦");
    const color = red ? "#c00024" : "#050505";
    card.style.setProperty("color", color, "important");
    card.style.setProperty("opacity", "1", "important");
    card.style.setProperty("filter", "none", "important");
    card.style.setProperty("background", "#ffffff", "important");
    card.querySelectorAll(".pip-field > span, .card-corner, .card-corner b, .card-corner i").forEach((item) => {
      item.style.setProperty("color", color, "important");
      item.style.setProperty("opacity", "1", "important");
      item.style.setProperty("filter", "none", "important");
    });
  });
}

export default function MultiMeldEnhancer() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [hand, setHand] = useState([]);
  const [advisor, setAdvisor] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const scan = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
      setAdvisor(document.querySelector(".selection-advisor"));
      applyBoardColors();
      const wraps = [...document.querySelectorAll(".cards .hand-card-wrap")];
      if (!wraps.length || !hand.length) {
        setSelectedIds([]);
        return;
      }
      const unused = new Set(hand.map((card) => card.id));
      const ordered = [];
      for (const wrap of wraps) {
        const button = wrap.querySelector(".real-card");
        const label = button?.getAttribute("aria-label") || "";
        const match = hand.find((card) => unused.has(card.id) && labelFor(card) === label);
        if (!match) continue;
        unused.delete(match.id);
        if (button.classList.contains("selected")) ordered.push(match.id);
      }
      setSelectedIds((current) => current.join("|") === ordered.join("|") ? current : ordered);
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:["class"] });
    window.addEventListener("resize", scan);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scan);
    };
  }, [hand]);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  useEffect(() => {
    const pickedUp = room?.publicState?.discardPileHasBeenTaken === true;
    const lastAction = String(room?.publicState?.lastAction || "").toLowerCase();
    if (roomCode && pickedUp && room?.publicState?.discardFrozen !== false && (lastAction.includes("took the discard pile") || lastAction.includes("drew from the discard pile"))) {
      guaranteePileUnfrozenAfterPickup(roomCode).catch(() => {});
    }
  }, [roomCode, room?.publicState?.discardFrozen, room?.publicState?.discardPileHasBeenTaken, room?.publicState?.lastAction]);

  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!roomCode || !uid || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}/privateHands/${uid}`), (snapshot) => setHand(snapshot.val() || []));
  }, [roomCode, room?.publicState?.currentPlayerIndex]);

  const selectedCards = useMemo(() => selectedIds.map((id) => hand.find((card) => card.id === id)).filter(Boolean), [selectedIds, hand]);
  const naturalRanks = [...new Set(selectedCards.filter((card) => !isWild(card) && card.rank !== "3").map((card) => card.rank))];
  const points = selectedCards.reduce((sum, card) => sum + cardPoints(card), 0);
  const isMulti = naturalRanks.length > 1;
  const uid = auth?.currentUser?.uid;
  const members = Object.values(room?.members || {}).sort((a,b) => a.seat - b.seat);
  const active = members[Number(room?.publicState?.currentPlayerIndex || 0)];
  const canAct = Boolean(uid && active?.uid === uid && room?.publicState?.phase === "playing" && room?.publicState?.turnPhase === "play");
  const canUndo = Boolean(canAct && room?.publicState?.undoPlay?.uid === uid);

  async function run(action) {
    setBusy(true);
    setError("");
    try { await action(); } catch (event) { setError(event.message); } finally { setBusy(false); }
  }

  return advisor ? createPortal(
    <div className="multi-meld-tools">
      {isMulti && <button className="multi-meld-button" disabled={!canAct || busy} onClick={() => run(() => playGroupedMelds(roomCode, uid, selectedIds))}>Play {naturalRanks.map((rank) => `${rank}s`).join(" + ")} · {points} pts</button>}
      <button className="undo-play-button" disabled={!canUndo || busy} onClick={() => run(() => undoLastPlay(roomCode, uid))}>Undo last play</button>
      {isMulti && <span className="multi-meld-help">Wild cards attach to the nearest selected rank in your hand.</span>}
      {error && <span className="multi-meld-error">{error}</span>}
    </div>,
    advisor,
  ) : null;
}
