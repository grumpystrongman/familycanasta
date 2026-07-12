import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import { resolveRedThreesInHand } from "./redThreeRules.js";

function orderedPlayers(room) {
  return Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
}

export async function layDownRedThrees(code, uid) {
  let actionError = "No red threes are available to lay down.";

  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      if (!room || room.status !== "playing" || room.publicState?.phase !== "playing") {
        throw new Error("The game is not ready for this action.");
      }

      const players = orderedPlayers(room);
      const player = players[Number(room.publicState?.currentPlayerIndex || 0)];
      if (player?.uid !== uid) throw new Error("Red threes can only be recovered on your turn.");

      const result = resolveRedThreesInHand(room, uid);
      const laidDown = result.exposed.length;
      if (!laidDown) throw new Error("You do not have a red three to lay down.");

      if (result.exhaustedOnRedThree) {
        room.publicState.stockExhausted = true;
        room.publicState.endRoundCheckRequested = true;
        room.publicState.currentPlayerIndex = (Number(room.publicState.currentPlayerIndex || 0) + 1) % players.length;
        room.publicState.turnPhase = "draw";
        room.publicState.lastAction = `${player.nickname} exposed ${laidDown} red three${laidDown === 1 ? "" : "s"}. The stock ended on a red three, so the turn ended without a discard.`;
      } else {
        room.publicState.lastAction = `${player.nickname} recovered ${laidDown} red three${laidDown === 1 ? "" : "s"} and drew ${result.replacements} replacement card${result.replacements === 1 ? "" : "s"}.`;
      }
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });

  if (!result.committed) throw new Error(actionError);
}
