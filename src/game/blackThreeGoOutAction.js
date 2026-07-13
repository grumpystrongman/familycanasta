import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import { finishRound, isBlackThree, isWild } from "./engine";
import { blackThreeGoOutPlan } from "./blackThreeGoOutRules";

function orderedPlayers(room) {
  return Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
}

function activePlayer(room) {
  const players = orderedPlayers(room);
  return players[Number(room.publicState?.currentPlayerIndex || 0)];
}

function assertPlayTurn(room, uid) {
  if (room?.status !== "playing" || room.publicState?.phase !== "playing") {
    throw new Error("The game is not ready for a move.");
  }
  const player = activePlayer(room);
  if (player?.uid !== uid) throw new Error("It is not your turn.");
  if (room.publicState?.turnPhase !== "play") throw new Error("Draw cards first.");
  return player;
}

export async function goOutWithBlackThrees(code, uid, cardIds) {
  if (!cardIds?.length) throw new Error("Select three or four black threes.");

  let actionError = "The black-three go-out play could not be completed.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertPlayTurn(room, uid);
      const pendingPickup = room.publicState?.pendingDiscardPickup;
      if (pendingPickup?.uid === uid) {
        throw new Error(`Complete the opening with the picked-up ${pendingPickup.rank} before going out.`);
      }
      if (room.publicState?.openingTurnUid === uid) {
        throw new Error("Complete or undo the unfinished opening before going out.");
      }

      const hand = room.privateHands?.[uid] || [];
      const selected = hand.filter((card) => cardIds.includes(card.id));
      if (selected.length !== cardIds.length) {
        throw new Error("One of the selected black threes is no longer in your hand.");
      }
      if (!selected.every(isBlackThree)) {
        throw new Error("This action can only meld natural black threes.");
      }

      const teamOpened = Boolean(room.publicState?.opened?.[player.team]);
      const plan = blackThreeGoOutPlan(hand, selected, teamOpened);
      if (!plan.ok) throw new Error(plan.reason);

      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[player.team] ||= [];
      room.publicState.teamBoards[player.team].push({
        rank: "3",
        cards: selected,
        blackThreeMeld: true,
      });

      room.publicState.discardPile ||= [];
      if (plan.finalDiscard) {
        room.publicState.discardPile.push(plan.finalDiscard);
        const freezesPile = (isWild(plan.finalDiscard) && room.rules?.freezeOnWild !== false)
          || (isBlackThree(plan.finalDiscard) && room.rules?.freezeOnBlackThree !== false);
        if (freezesPile) room.publicState.discardFrozen = true;
      }

      room.privateHands[uid] = [];
      room.publicState.handCounts ||= {};
      room.publicState.handCounts[uid] = 0;
      room.publicState.pendingDiscardPickup = null;
      room.publicState.openingTurnUid = null;
      room.publicState.openingTurnPoints = 0;
      room.publicState.blackThreeGoOut = {
        uid,
        team: Number(player.team),
        count: selected.length,
        finalDiscard: plan.finalDiscard || null,
      };
      room.publicState.lastAction = plan.finalDiscard
        ? `${player.nickname} melded ${selected.length} black threes, discarded ${plan.finalDiscard.rank}${plan.finalDiscard.suit}, and went out.`
        : `${player.nickname} melded ${selected.length} black threes and went out.`;

      return finishRound(room, uid);
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });

  if (!result.committed) throw new Error(actionError);
}
