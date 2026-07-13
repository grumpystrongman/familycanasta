import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref, runTransaction } from "firebase/database";
import { auth, db } from "./firebase";
import { blackThreeGoOutPlan } from "./game/blackThreeGoOutRules";
import { goOutWithBlackThrees } from "./game/blackThreeGoOutAction";
import { isBlackThree } from "./game/engine";
import "./blackThreeGoOut.css";

const CARD_ID_TYPE = "text/card-id";

function createDataTransfer() {
  const values = new Map();
  const types = [];
  return {
    dropEffect: "move",
    effectAllowed: "move",
    files: [],
    items: [],
    types,
    clearData(type) {
      if (type) {
        values.delete(type);
        const index = types.indexOf(type);
        if (index >= 0) types.splice(index, 1);
      } else {
        values.clear();
        types.splice(0, types.length);
      }
    },
    getData(type) {
      return values.get(type) || "";
    },
    setData(type, value) {
      values.set(type, String(value));
      if (!types.includes(type)) types.push(type);
    },
  };
}

function selectedCardIds() {
  return [...document.querySelectorAll(".game-page .hand-card-wrap:has(.real-card.selected)")]
    .map((wrapper) => {
      const dataTransfer = createDataTransfer();
      const event = new Event("dragstart", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { configurable: true, value: dataTransfer });
      wrapper.dispatchEvent(event);
      return dataTransfer.getData(CARD_ID_TYPE);
    })
    .filter(Boolean);
}

function isLegacyBlackThreeFreeze(room) {
  const pile = room?.publicState?.discardPile || [];
  const top = pile[pile.length - 1];
  return room?.publicState?.discardFrozen && isBlackThree(top);
}

export default function BlackThreeRuleFix() {
  const [uid, setUid] = useState(() => auth?.currentUser?.uid || "");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [hand, setHand] = useState([]);
  const [advisor, setAdvisor] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
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
      setAdvisor(document.querySelector(".game-page .selection-advisor"));
      const nextIds = selectedCardIds();
      setSelectedIds((current) => current.join("|") === nextIds.join("|") ? current : nextIds);
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), async (snapshot) => {
      const value = snapshot.val();
      setRoom(value);
      if (!value || !uid || !value.members?.[uid]) return;

      const needsRuleRepair = value.rules?.freezeOnBlackThree !== false;
      const needsPileRepair = isLegacyBlackThreeFreeze(value);
      if (!needsRuleRepair && !needsPileRepair) return;

      await runTransaction(ref(db, `rooms/${roomCode}`), (current) => {
        if (!current) return current;
        current.rules ||= {};
        current.rules.freezeOnBlackThree = false;
        if (isLegacyBlackThreeFreeze(current)) {
          current.publicState.discardFrozen = false;
          current.publicState.discardFreezeReason = null;
          current.publicState.lastAction = "A black three was discarded. The discard pile remains unfrozen; only twos and Jokers freeze it.";
        }
        return current;
      }, { applyLocally: false });
    });
  }, [roomCode, uid]);

  useEffect(() => {
    if (!roomCode || !uid || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}/privateHands/${uid}`), (snapshot) => {
      setHand(snapshot.val() || []);
    });
  }, [roomCode, uid]);

  const selectedCards = useMemo(
    () => selectedIds.map((id) => hand.find((card) => card.id === id)).filter(Boolean),
    [selectedIds, hand],
  );
  const player = room?.members?.[uid];
  const members = Object.values(room?.members || {}).sort((a, b) => a.seat - b.seat);
  const active = members[Number(room?.publicState?.currentPlayerIndex || 0)];
  const canAct = Boolean(
    uid
    && active?.uid === uid
    && room?.status === "playing"
    && room?.publicState?.phase === "playing"
    && room?.publicState?.turnPhase === "play"
  );
  const blackThreeSelection = selectedCards.length > 0 && selectedCards.every(isBlackThree);
  const teamOpened = Boolean(room?.publicState?.opened?.[player?.team]);
  const plan = blackThreeSelection
    ? blackThreeGoOutPlan(hand, selectedCards, teamOpened)
    : { ok: false, reason: "" };

  useEffect(() => {
    if (!advisor) return undefined;
    const primaryButton = [...advisor.children].find((child) => (
      child.matches?.("button:not(.discard-button):not(.autosort-hand-button)")
    ));
    if (!primaryButton) return undefined;

    primaryButton.hidden = blackThreeSelection;
    advisor.classList.toggle("black-three-go-out-mode", blackThreeSelection);
    return () => {
      primaryButton.hidden = false;
      advisor.classList.remove("black-three-go-out-mode");
    };
  }, [advisor, blackThreeSelection]);

  async function commitGoOut() {
    if (!plan.ok) return;
    setBusy(true);
    setError("");
    try {
      await goOutWithBlackThrees(roomCode, uid, selectedIds);
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  if (!advisor || !blackThreeSelection) return null;

  const status = plan.ok
    ? plan.finalDiscard
      ? `Ready to go out. ${plan.finalDiscard.rank}${plan.finalDiscard.suit} will be discarded automatically after the black-three meld.`
      : "Ready to go out. The black-three meld will empty your hand."
    : plan.reason;

  return createPortal(
    <div className={`black-three-go-out-tools ${plan.ok ? "ready" : "blocked"}`}>
      <div>
        <strong>Black-three go-out</strong>
        <span>{status}</span>
      </div>
      <button type="button" disabled={!canAct || busy || !plan.ok} onClick={commitGoOut}>
        {busy ? "Going out…" : `Go out with ${selectedCards.length} black threes`}
      </button>
      {error && <em role="alert">{error}</em>}
    </div>,
    advisor,
  );
}
