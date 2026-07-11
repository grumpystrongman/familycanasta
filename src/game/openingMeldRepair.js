import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import { sortHand } from "./engine";

function orderedPlayers(room) {
  return Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
}

export async function repairAbandonedOpening(code, hostUid) {
  let actionError = "The unfinished opening meld could not be repaired.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      if (!room || room.hostUid !== hostUid) return room;

      const openingUid = room.publicState?.openingTurnUid;
      if (!openingUid) return room;

      const players = orderedPlayers(room);
      const active = players[Number(room.publicState?.currentPlayerIndex || 0)];
      if (active?.uid === openingUid) return room;

      const openingPlayer = room.members?.[openingUid];
      if (!openingPlayer) {
        room.publicState.openingTurnUid = null;
        room.publicState.openingTurnPoints = 0;
        room.publicState.undoPlay = null;
        return room;
      }

      const team = Number(openingPlayer.team);
      if (room.publicState?.opened?.[team]) {
        room.publicState.openingTurnUid = null;
        room.publicState.openingTurnPoints = 0;
        room.publicState.undoPlay = null;
        return room;
      }

      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[team] ||= [];
      const stagedCards = room.publicState.teamBoards[team]
        .flatMap((meld) => meld.cards || []);

      room.privateHands ||= {};
      room.privateHands[openingUid] = sortHand([
        ...(room.privateHands[openingUid] || []),
        ...stagedCards,
      ]);
      room.publicState.teamBoards[team] = [];
      room.publicState.openingTurnUid = null;
      room.publicState.openingTurnPoints = 0;
      room.publicState.undoPlay = null;
      room.publicState.handCounts ||= {};
      room.publicState.handCounts[openingUid] = room.privateHands[openingUid].length;
      room.publicState.lastAction = `${openingPlayer.nickname}'s incomplete opening meld was returned to their hand.`;
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });

  if (!result.committed) throw new Error(actionError);
}
