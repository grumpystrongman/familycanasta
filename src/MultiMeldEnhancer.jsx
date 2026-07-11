import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref } from "firebase/database";
import { auth, db } from "./firebase";
import { playGroupedMelds, undoLastPlay } from "./game/multiMeldActions";
import { planGroupedMelds } from "./game/multiMeldPlanner";
import { repairAbandonedOpening } from "./game/openingMeldRepair";
import { guaranteePileUnfrozenAfterPickup } from "./game/discardStateRepair";
import { isWild, openingRequirement, SUIT_SYMBOLS } from "./game/engine";

function labelFor(card) {
  return `${card.rank} ${SUIT_SYMBOLS[card.suit] || "★"}`;
}

function setActionButtonLabel(button, text) {
  const textNode = [...button.childNodes].find((node) => node.nodeType === 3);
  if (textNode) textNode.textContent = ` ${text}`;
  else button.appendChild(document.createTextNode(` ${text}`));
  button.setAttribute("aria-label", text);
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
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
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

  const selectedCards = useMemo(
    () => selectedIds.map((id) => hand.find((card) => card.id === id)).filter(Boolean),
    [selectedIds, hand],
  );
  const uid = auth?.currentUser?.uid;
  const members = Object.values(room?.members || {}).sort((a, b) => a.seat - b.seat);
  const active = members[Number(room?.publicState?.currentPlayerIndex || 0)];
  const canAct = Boolean(uid && active?.uid === uid && room?.publicState?.phase === "playing" && room?.publicState?.turnPhase === "play");
  const canUndo = Boolean(canAct && room?.publicState?.undoPlay?.uid === uid);
  const team = Number(room?.members?.[uid]?.team ?? -1);
  const teamOpened = team >= 0 && Boolean(room?.publicState?.opened?.[team]);
  const board = team >= 0 ? (room?.publicState?.teamBoards?.[team] || []) : [];
  const plan = useMemo(
    () => planGroupedMelds(selectedCards, board, room?.rules || {}),
    [selectedCards, board, room?.rules],
  );
  const openingOwner = room?.publicState?.openingTurnUid || null;
  const stagedPoints = openingOwner === uid ? Number(room?.publicState?.openingTurnPoints || 0) : 0;
  const openingNeed = team >= 0 ? openingRequirement(Number(room?.publicState?.teamScores?.[team] || 0)) : 0;
  const openingInProgress = Boolean(canAct && !teamOpened && openingOwner === uid && stagedPoints > 0);
  const usesGroupedAction = Boolean(selectedCards.length > 0 && !selectedCards.every(isWild));
  const openingConflict = Boolean(!teamOpened && openingOwner && openingOwner !== uid);
  const projectedOpeningPoints = stagedPoints + plan.totalPoints;
  const openingSatisfied = teamOpened || projectedOpeningPoints >= openingNeed;
  const selectionIsLegal = Boolean(plan.valid && !openingConflict);
  const meldWord = plan.groups.length === 1 ? "meld" : "melds";
  const buttonText = teamOpened
    ? `Play ${plan.groups.length} ${meldWord} · ${plan.totalPoints} pts`
    : openingSatisfied
      ? `Play opening ${meldWord} · ${projectedOpeningPoints} pts`
      : `Stage opening ${meldWord} · ${projectedOpeningPoints}/${openingNeed} pts`;

  useEffect(() => {
    const openingUid = room?.publicState?.openingTurnUid;
    const hostUid = room?.hostUid;
    if (!roomCode || !uid || uid !== hostUid || !openingUid || openingUid === active?.uid) return;
    repairAbandonedOpening(roomCode, uid).catch((event) => setError(event.message));
  }, [roomCode, uid, room?.hostUid, room?.publicState?.openingTurnUid, active?.uid]);

  useEffect(() => {
    if (!openingInProgress) return undefined;
    const blockIncompleteOpeningDiscard = (event) => {
      if (!event.target.closest(".discard-button")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setError(`Finish the opening meld (${stagedPoints}/${openingNeed}) or undo it before discarding.`);
    };
    document.addEventListener("click", blockIncompleteOpeningDiscard, true);
    return () => document.removeEventListener("click", blockIncompleteOpeningDiscard, true);
  }, [openingInProgress, stagedPoints, openingNeed]);

  useEffect(() => {
    if (!advisor || !usesGroupedAction) return undefined;
    const primaryButton = [...advisor.children].find((child) => child.matches?.("button:not(.discard-button)"));
    if (!primaryButton) return undefined;

    setActionButtonLabel(primaryButton, buttonText);
    primaryButton.classList.add("grouped-meld-primary");
    primaryButton.disabled = !canAct || busy || !selectionIsLegal;

    const playAllProposedMelds = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (!canAct || busy || !selectionIsLegal) return;
      run(() => playGroupedMelds(roomCode, uid, selectedIds));
    };

    primaryButton.addEventListener("click", playAllProposedMelds, true);
    return () => {
      primaryButton.removeEventListener("click", playAllProposedMelds, true);
      primaryButton.classList.remove("grouped-meld-primary");
    };
  }, [advisor, usesGroupedAction, buttonText, canAct, busy, selectionIsLegal, roomCode, uid, selectedIds]);

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  return advisor ? createPortal(
    <div className="multi-meld-tools">
      {openingInProgress && !usesGroupedAction && (
        <span className="multi-meld-help">
          Opening staged: {stagedPoints} of {openingNeed} points. Add another legal meld or undo before discarding.
        </span>
      )}

      {usesGroupedAction && (
        <div className="multi-meld-preview" aria-live="polite">
          <div className="multi-meld-preview-title">
            {teamOpened ? "Proposed melds" : `Opening play (${projectedOpeningPoints} / ${openingNeed})`}
          </div>
          <div className="multi-meld-list">
            {plan.groups.map((group) => (
              <div className={`multi-meld-row ${group.error ? "invalid" : "valid"}`} key={`${group.rank}-${group.cards.map((card) => card.id).join("-")}`}>
                <div className="multi-meld-row-heading">
                  <strong>{group.error ? "✕" : "✓"} {group.rank === "Wild" ? "Wild cards" : `${group.rank}s`}</strong>
                  <span>{group.points} pts</span>
                </div>
                <div className="multi-meld-card-list">{group.cards.map(labelFor).join(", ")}</div>
                {group.error && <div className="multi-meld-row-error">{group.error}</div>}
              </div>
            ))}
          </div>

          {!teamOpened ? (
            <div className={`multi-meld-total ${selectionIsLegal && openingSatisfied ? "legal" : "not-ready"}`}>
              <span>Combined valid opening total</span>
              <strong>{projectedOpeningPoints} / {openingNeed} pts</strong>
              {stagedPoints > 0 && <small>Includes {stagedPoints} points already staged this turn.</small>}
              {plan.valid && !openingConflict && !openingSatisfied && (
                <small>Need {openingNeed - projectedOpeningPoints} more points to open.</small>
              )}
              {openingConflict && <small>Another player has an unfinished opening meld.</small>}
            </div>
          ) : (
            <div className={`multi-meld-total ${plan.valid ? "legal" : "not-ready"}`}>
              <span>Combined valid total</span>
              <strong>{plan.totalPoints} pts</strong>
            </div>
          )}
        </div>
      )}

      <button className="undo-play-button" disabled={!canUndo || busy} onClick={() => run(() => undoLastPlay(roomCode, uid))}>Undo last play</button>
      {usesGroupedAction && <span className="multi-meld-help">The main play button commits every valid proposed meld together. Wild cards attach to the nearest selected natural rank.</span>}
      {error && <span className="multi-meld-error">{error}</span>}
    </div>,
    advisor,
  ) : null;
}
