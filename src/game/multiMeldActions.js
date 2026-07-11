import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import { cardPoints, finishRound, isWild, openingRequirement, sortHand } from "./engine";

function orderedPlayers(room) {
  return Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
}

function assertPlayTurn(room, uid) {
  if (!room || room.status !== "playing" || room.publicState?.phase !== "playing") {
    throw new Error("The game is not ready for a play.");
  }
  const players = orderedPlayers(room);
  const player = players[Number(room.publicState?.currentPlayerIndex || 0)];
  if (player?.uid !== uid) throw new Error("It is not your turn.");
  if (room.publicState?.turnPhase !== "play") throw new Error("Draw cards first.");
  return player;
}

function assignWildsByPosition(cards) {
  const groups = new Map();
  const naturalPositions = [];

  cards.forEach((card, index) => {
    if (isWild(card)) return;
    if (card.rank === "3") throw new Error("Threes cannot be used in a normal meld.");
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
    naturalPositions.push({ index, rank: card.rank });
  });

  if (!naturalPositions.length) throw new Error("Select at least one natural rank with the wild cards.");

  cards.forEach((card, index) => {
    if (!isWild(card)) return;
    let nearest = naturalPositions[0];
    for (const candidate of naturalPositions) {
      const candidateDistance = Math.abs(candidate.index - index);
      const nearestDistance = Math.abs(nearest.index - index);
      if (candidateDistance < nearestDistance || (candidateDistance === nearestDistance && candidate.index < nearest.index)) {
        nearest = candidate;
      }
    }
    groups.get(nearest.rank).push(card);
  });

  return [...groups.entries()].map(([rank, groupCards]) => ({ rank, cards: groupCards }));
}

function validateGroup(existingCards, selectedCards, rules, rank) {
  const combined = [...existingCards, ...selectedCards];
  const naturals = combined.filter((card) => !isWild(card));
  const wilds = combined.filter(isWild);
  if (!naturals.length || naturals.some((card) => card.rank !== rank)) {
    throw new Error(`The ${rank} meld contains a card of another rank.`);
  }
  if (wilds.length > Number(rules?.maxWildsPerMeld || 3)) {
    throw new Error(`The ${rank} meld has too many wild cards.`);
  }
  if (wilds.length >= naturals.length) {
    throw new Error(`The ${rank} meld must have more natural cards than wild cards.`);
  }
  if (!existingCards.length && selectedCards.length < 3) {
    throw new Error(`A new ${rank} meld needs at least three cards.`);
  }
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

      const groups = assignWildsByPosition(selected);
      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[player.team] ||= [];
      room.publicState.opened ||= {};
      room.publicState.handCounts ||= {};
      const board = room.publicState.teamBoards[player.team];

      for (const group of groups) {
        const existing = board.find((meld) => meld.rank === group.rank);
        validateGroup(existing?.cards || [], group.cards, room.rules, group.rank);
      }

      const selectedPoints = selected.reduce((sum, card) => sum + cardPoints(card), 0);
      if (!room.publicState.opened[player.team]) {
        const need = openingRequirement(Number(room.publicState.teamScores?.[player.team] || 0));
        if (selectedPoints < need) {
          throw new Error(`Your combined opening meld needs ${need} points; these groups total ${selectedPoints}.`);
        }
      }

      room.publicState.undoPlay = {
        uid,
        playerIndex: Number(room.publicState.currentPlayerIndex || 0),
        privateHand: hand,
        team: player.team,
        teamBoard: structuredClone(board),
        opened: Boolean(room.publicState.opened[player.team]),
        handCount: hand.length,
        lastAction: room.publicState.lastAction || "",
      };

      for (const group of groups) {
        const existing = board.find((meld) => meld.rank === group.rank);
        if (existing) existing.cards = [...(existing.cards || []), ...group.cards];
        else board.push({ rank: group.rank, cards: group.cards });
      }

      const used = new Set(orderedCardIds);
      room.privateHands[uid] = sortHand(hand.filter((card) => !used.has(card.id)));
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.opened[player.team] = true;
      room.publicState.turnPhase = "play";
      room.publicState.lastAction = `${player.nickname} played ${groups.length} meld${groups.length === 1 ? "" : "s"}: ${groups.map((group) => `${group.rank}s`).join(", ")}.`;

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
      if (!undo || undo.uid !== uid || Number(undo.playerIndex) !== Number(room.publicState.currentPlayerIndex || 0)) {
        throw new Error("Only your most recent play in this turn can be undone.");
      }
      room.privateHands[uid] = undo.privateHand;
      room.publicState.teamBoards[player.team] = undo.teamBoard;
      room.publicState.opened[player.team] = undo.opened;
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
