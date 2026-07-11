import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import { finishRound, openingRequirementForTeam, sortHand } from "./engine";
import { planGroupedMelds } from "./multiMeldPlanner";
import { validatePendingPickupSelection } from "./discardPickupPlanner";

function orderedPlayers(room) {
  return Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
}

function assertPlayTurn(room, uid) {
  if (!room || room.status !== "playing" || room.publicState?.phase !== "playing") throw new Error("The game is not ready for a play.");
  const players = orderedPlayers(room);
  const player = players[Number(room.publicState?.currentPlayerIndex || 0)];
  if (player?.uid !== uid) throw new Error("It is not your turn.");
  if (room.publicState?.turnPhase !== "play") throw new Error("Draw cards first.");
  return player;
}

export async function playGroupedMelds(code, uid, orderedCardIds) {
  if (!orderedCardIds?.length) throw new Error("Select cards to play.");
  let actionError = "The grouped meld could not be completed.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertPlayTurn(room, uid);
      const hand = [...(room.privateHands?.[uid] || [])];
      const selected = orderedCardIds.map((id) => hand.find((card) => card.id === id));
      if (selected.some((card) => !card)) throw new Error("One selected card is no longer in your hand.");

      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[player.team] ||= [];
      room.publicState.opened ||= {};
      room.publicState.handCounts ||= {};
      const board = room.publicState.teamBoards[player.team];
      const plan = planGroupedMelds(selected, board, room.rules);
      if (!plan.valid) {
        const invalidMeld = plan.groups.find((group) => group.error);
        throw new Error(invalidMeld?.error || plan.error || "The selected cards cannot be divided into legal melds.");
      }

      const groups = plan.groups.map((group) => ({ rank: group.rank, cards: group.cards }));
      const selectedPoints = plan.totalPoints;
      const alreadyOpened = Boolean(room.publicState.opened[player.team]);
      const pending = room.publicState?.pendingDiscardPickup || null;
      if (pending && pending.uid !== uid) throw new Error("Another player has an unfinished discard-pile opening.");

      if (!alreadyOpened) {
        const pendingError = validatePendingPickupSelection(pending, selected);
        if (pendingError) throw new Error(pendingError);
        const need = openingRequirementForTeam(room, player.team);
        if (selectedPoints < need) {
          throw new Error(`Your opening play must be committed at once for ${need} points; these melds total ${selectedPoints}.`);
        }
      }

      room.publicState.undoPlay = {
        uid,
        playerIndex: Number(room.publicState.currentPlayerIndex || 0),
        privateHand: hand,
        team: player.team,
        teamBoard: structuredClone(board),
        opened: alreadyOpened,
        pendingDiscardPickup: pending ? structuredClone(pending) : null,
        handCount: hand.length,
        lastAction: room.publicState.lastAction || "",
      };

      for (const group of groups) {
        const existing = board.find((meld) => meld.rank === group.rank);
        if (existing) existing.cards = [...(existing.cards || []), ...group.cards];
        else board.push({ rank: group.rank, cards: group.cards });
      }

      room.publicState.opened[player.team] = true;
      room.publicState.pendingDiscardPickup = null;
      room.publicState.openingTurnUid = null;
      room.publicState.openingTurnPoints = 0;
      const used = new Set(orderedCardIds);
      room.privateHands[uid] = sortHand(hand.filter((card) => !used.has(card.id)));
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.turnPhase = "play";
      const groupText = groups.map((group) => `${group.rank}s`).join(", ");
      room.publicState.lastAction = `${player.nickname} played ${groups.length} meld${groups.length === 1 ? "" : "s"}: ${groupText} for ${selectedPoints} points.`;

      if (room.privateHands[uid].length === 0) return finishRound(room, uid);
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}

export async function undoLastPlay(code, uid) {
  let actionError = "There is no play to undo.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertPlayTurn(room, uid);
      const undo = room.publicState?.undoPlay;
      if (!undo || undo.uid !== uid || Number(undo.playerIndex) !== Number(room.publicState.currentPlayerIndex || 0)) throw new Error("Only your most recent play in this turn can be undone.");
      room.privateHands[uid] = undo.privateHand;
      room.publicState.teamBoards[player.team] = undo.teamBoard;
      room.publicState.opened[player.team] = undo.opened;
      room.publicState.pendingDiscardPickup = undo.pendingDiscardPickup || null;
      room.publicState.openingTurnUid = null;
      room.publicState.openingTurnPoints = 0;
      room.publicState.handCounts[uid] = undo.handCount;
      room.publicState.lastAction = `${player.nickname} undid the previous play.`;
      room.publicState.undoPlay = null;
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}
