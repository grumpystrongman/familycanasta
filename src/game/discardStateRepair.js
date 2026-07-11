import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";

export async function guaranteePileUnfrozenAfterPickup(code) {
  if (!code) return false;
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room?.publicState) return room;
    const lastAction = String(room.publicState.lastAction || "").toLowerCase();
    const wasPickedUp = room.publicState.discardPileHasBeenTaken === true
      && (lastAction.includes("took the discard pile") || lastAction.includes("drew from the discard pile"));
    if (!wasPickedUp || room.publicState.discardFrozen === false) return room;
    room.publicState.discardFrozen = false;
    room.publicState.discardFreezeReason = null;
    room.publicState.lastAction = `${room.publicState.lastAction} The discard pile is now unfrozen.`;
    return room;
  }, { applyLocally: false });
  return result.committed;
}
