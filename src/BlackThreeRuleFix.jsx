import { useEffect, useState } from "react";
import { onValue, ref, runTransaction } from "firebase/database";
import { auth, db } from "./firebase";

function isBlackThree(card) {
  return card?.rank === "3" && (card?.suit === "S" || card?.suit === "C");
}

export default function BlackThreeRuleFix() {
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    const locate = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), async (snapshot) => {
      const room = snapshot.val();
      const uid = auth?.currentUser?.uid;
      if (!room || !uid || !room.members?.[uid]) return;

      const pile = room.publicState?.discardPile || [];
      const top = pile[pile.length - 1];
      const needsRuleRepair = room.rules?.freezeOnBlackThree !== false;
      const needsPileRepair = Boolean(room.publicState?.discardFrozen && isBlackThree(top));
      if (!needsRuleRepair && !needsPileRepair) return;

      await runTransaction(ref(db, `rooms/${roomCode}`), (current) => {
        if (!current) return current;
        current.rules ||= {};
        current.rules.freezeOnBlackThree = false;
        const currentPile = current.publicState?.discardPile || [];
        const currentTop = currentPile[currentPile.length - 1];
        if (current.publicState?.discardFrozen && isBlackThree(currentTop)) {
          current.publicState.discardFrozen = false;
          current.publicState.discardFreezeReason = null;
          current.publicState.lastAction = "A black three was discarded. The discard pile remains unfrozen; only twos and Jokers freeze it.";
        }
        return current;
      }, { applyLocally: false });
    });
  }, [roomCode]);

  return null;
}
