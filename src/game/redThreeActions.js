import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import { isRedThree, sortHand } from "./engine";

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
      if (player?.uid !== uid) throw new Error("Red threes can only be laid down on your turn.");

      room.privateHands ||= {};
      room.privateHands[uid] ||= [];
      room.stock ||= [];
      room.publicState.redThrees ||= {};
      room.publicState.redThrees[uid] ||= [];
      room.publicState.handCounts ||= {};

      let hand = [...room.privateHands[uid]];
      let laidDown = 0;
      let replacements = 0;
      let changed = true;

      // Every red three in the hand is laid down. Each one earns one replacement.
      // If a replacement is another red three, it is also laid down and replaced.
      while (changed) {
        changed = false;
        const redIndex = hand.findIndex(isRedThree);
        if (redIndex >= 0) {
          const [redThree] = hand.splice(redIndex, 1);
          room.publicState.redThrees[uid].push(redThree);
          laidDown += 1;
          if (room.stock.length) {
            hand.push(room.stock.pop());
            replacements += 1;
          }
          changed = true;
        }
      }

      if (!laidDown) throw new Error("You do not have a red three to lay down.");

      room.privateHands[uid] = sortHand(hand);
      room.publicState.handCounts[uid] = hand.length;
      room.publicState.stockCount = room.stock.length;
      room.publicState.lastAction = `${player.nickname} laid down ${laidDown} red three${laidDown === 1 ? "" : "s"} and drew ${replacements} replacement card${replacements === 1 ? "" : "s"}.`;
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });

  if (!result.committed) throw new Error(actionError);
}
