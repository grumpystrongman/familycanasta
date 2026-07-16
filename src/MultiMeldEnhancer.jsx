import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { auth, db } from "./firebase";
import { playGroupedMelds, undoLastPlay } from "./game/multiMeldActions";
import { planGroupedMelds } from "./game/multiMeldPlanner";
import { groupedMeldUiState } from "./game/groupedMeldUi";
import { guaranteePileUnfrozenAfterPickup } from "./game/discardStateRepair";
import { validatePendingPickupSelection } from "./game/discardPickupPlanner";
import { isWild, openingRequirementForTeam, SUIT_SYMBOLS } from "./game/engine";

function labelFor(card) {
  return `${card.rank} ${SUIT_SYMBOLS[card.suit] || "★"}`;
}

function selectedIdsFromRenderedHand(wraps, hand) {
  const byId = new Map(hand.map((card) => [card.id, card]));
  const unused = new Set(byId.keys());
  const queues = new Map();

  for (const card of hand) {
    const label = labelFor(card);
    if (!queues.has(label)) queues.set(label, []);
    queues.get(label).push(card.id);
  }

  const selected = [];
  for (const wrap of wraps) {
    const button = wrap.querySelector(".real-card");
    const label = button?.getAttribute("aria-label") || "";
    const rememberedId = wrap.dataset.cardId || "";
    const remembered = byId.get(rememberedId);
    let card = remembered && unused.has(rememberedId) && labelFor(remembered) === label
      ? remembered
      : null;

    if (!card) {
      const queue = queues.get(label) || [];
      const nextId = queue.find((id) => unused.has(id));
      card = nextId ? byId.get(nextId) : null;
    }
    if (!card) continue;

    wrap.dataset.cardId = card.id;
    unused.delete(card.id);
    if (button.classList.contains("selected")) selected.push(card.id);
  }
  return selected;
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
  const [uid, setUid] = useState(() => auth?.currentUser?.uid || "");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [hand, setHand] = useState([]);
  const [advisor, setAdvisor] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [wildTargetRank, setWildTargetRank] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (user) => setUid(user?.uid || ""));
  }, []);

  useEffect(() => {
    const scan = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
      setAdvisor(document.querySelector(".selection-advisor"));
      setWildTargetRank(document.querySelector(".wild-target select")?.value || "");
      applyBoardColors();

      const wraps = [...document.querySelectorAll(".cards .hand-card-wrap")];
      if (!wraps.length || !hand.length) {
        setSelectedIds([]);
        return;
      }
      const ordered = selectedIdsFromRenderedHand(wraps, hand);
      setSelectedIds((current) => current.join("|") === ordered.join("|") ? current : ordered);
    };

    const onChange = (event) => {
      if (event.target?.closest?.(".wild-target")) scan();
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    document.addEventListener("change", onChange, true);
    window.addEventListener("resize", scan);
    return () => {
      observer.disconnect();
      document.removeEventListener("change", onChange, true);
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
    if (!roomCode || !uid || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}/privateHands/${uid}`), (snapshot) => setHand(snapshot.val() || []));
  }, [roomCode, uid, room?.publicState?.currentPlayerIndex]);

  const selectedCards = useMemo(
    () => selectedIds.map((id) => hand.find((card) => card.id === id)).filter(Boolean),
    [selectedIds, hand],
  );
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
  const pendingPickup = room?.publicState?.pendingDiscardPickup?.uid === uid
    ? room.publicState.pendingDiscardPickup
    : null;
  const pendingSupportDescription = pendingPickup?.supportDescription
    || `two natural ${pendingPickup?.rank || "matching"}s`;
  const openingNeed = team >= 0 ? openingRequirementForTeam(room, team) : 0;
  const pendingError = validatePendingPickupSelection(pendingPickup, selectedCards);
  const groupedUi = useMemo(
    () => groupedMeldUiState({
      cards: selectedCards,
      plan,
      teamOpened,
      openingNeed,
      pendingError,
    }),
    [selectedCards, plan, teamOpened, openingNeed, pendingError],
  );
  const usesGroupedAction = groupedUi.grouped;

  const singleRank = groupedUi.naturalRanks.length === 1
    ? groupedUi.naturalRanks[0]
    : selectedCards.length > 0 && selectedCards.every(isWild)
      ? wildTargetRank
      : "";
  const existingSingleMeld = singleRank ? board.find((meld) => meld.rank === singleRank) : null;
  const combinedSingleMeld = existingSingleMeld
    ? [...(existingSingleMeld.cards || []), ...selectedCards]
    : selectedCards;
  const combinedNaturals = combinedSingleMeld.filter((card) => !isWild(card));
  const combinedWilds = combinedSingleMeld.filter(isWild);
  const singleRankLegal = Boolean(
    !usesGroupedAction
    && selectedCards.length > 0
    && !selectedCards.some((card) => card.rank === "3")
    && combinedNaturals.length > 0
    && new Set(combinedNaturals.map((card) => card.rank)).size === 1
    && combinedWilds.length <= combinedNaturals.length
    && (existingSingleMeld || selectedCards.length >= 3)
    && !pendingError
    && groupedUi.openingSatisfied
  );
  const equalWildBalance = singleRankLegal
    && combinedWilds.length > 0
    && combinedWilds.length === combinedNaturals.length;

  useEffect(() => {
    if (!advisor) return undefined;
    const primaryButton = [...advisor.children].find((child) => (
      child.matches?.("button:not(.discard-button):not(.autosort-hand-button)")
    ));
    if (!primaryButton) return undefined;

    if (!usesGroupedAction) {
      primaryButton.hidden = false;
      advisor.classList.remove("grouped-meld-mode");
      const previousDisabled = primaryButton.disabled;
      const statusText = advisor.querySelector(":scope > div > span");
      const previousStatus = statusText?.textContent || "";
      const equalityMessage = "Legal play. Wild cards may equal, but cannot exceed, the natural cards.";

      if (singleRankLegal) primaryButton.disabled = !canAct || busy;
      if (equalWildBalance && statusText) statusText.textContent = equalityMessage;

      return () => {
        primaryButton.disabled = previousDisabled;
        if (statusText?.textContent === equalityMessage) statusText.textContent = previousStatus;
      };
    }

    primaryButton.hidden = true;
    advisor.classList.add("grouped-meld-mode");
    return () => {
      primaryButton.hidden = false;
      advisor.classList.remove("grouped-meld-mode");
    };
  }, [advisor, usesGroupedAction, singleRankLegal, equalWildBalance, canAct, busy]);

  useEffect(() => {
    if (!pendingPickup) return undefined;
    const blockPendingPickupDiscard = (event) => {
      if (!event.target.closest(".discard-button")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setError(`Complete the opening with the picked-up ${pendingPickup.rank} before discarding.`);
    };
    document.addEventListener("click", blockPendingPickupDiscard, true);
    return () => document.removeEventListener("click", blockPendingPickupDiscard, true);
  }, [pendingPickup]);

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
    <div className={`multi-meld-tools ${usesGroupedAction ? "active" : ""}`}>
      {pendingPickup && !usesGroupedAction && (
        <span className="multi-meld-help">
          The pile is in your hand. Your atomic opening must include the picked-up {pendingPickup.rank}, {pendingSupportDescription} from your original hand, and at least {openingNeed} total points.
        </span>
      )}

      {usesGroupedAction && (
        <>
          <div className="multi-meld-preview" aria-live="polite">
            <div className="multi-meld-preview-title">
              {teamOpened
                ? "Grouped play"
                : pendingPickup
                  ? `Discard-pile opening (${groupedUi.points} / ${openingNeed})`
                  : `Opening play (${groupedUi.points} / ${openingNeed})`}
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

            <div className={`multi-meld-total ${groupedUi.canCommit ? "legal" : "not-ready"}`}>
              <span>{teamOpened ? "Combined play total" : "Atomic opening total"}</span>
              <strong>{teamOpened ? `${groupedUi.points} pts` : `${groupedUi.points} / ${openingNeed} pts`}</strong>
              <small>{groupedUi.statusText}</small>
            </div>
          </div>

          <button
            type="button"
            className="multi-meld-button"
            disabled={!canAct || busy || !groupedUi.canCommit}
            onClick={() => run(() => playGroupedMelds(roomCode, uid, selectedIds))}
          >
            {busy ? "Playing grouped melds…" : groupedUi.buttonText}
          </button>
        </>
      )}

      <button type="button" className="undo-play-button" disabled={!canUndo || busy} onClick={() => run(() => undoLastPlay(roomCode, uid))}>Undo last play</button>
      {usesGroupedAction && <span className="multi-meld-help">Select complete groups for every rank. The grouped play button commits all of them together, so their points combine toward a 90- or 120-point opening.</span>}
      {error && <span className="multi-meld-error" role="alert">{error}</span>}
    </div>,
    advisor,
  ) : null;
}
