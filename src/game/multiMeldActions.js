import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import { cardPoints, finishRound, isWild, openingRequirement, sortHand } from "./engine";

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

function validateGroup(existingCards, selectedCards, rules, rank) {
  const combined = [...existingCards, ...selectedCards];
  const naturals = combined.filter((card) => !isWild(card));
  const wilds = combined.filter(isWild);
  if (!naturals.length || naturals.some((card) => card.rank !== rank)) throw new Error(`The ${rank} meld contains a card of another rank.`);
  if (wilds.length > Number(rules?.maxWildsPerMeld || 3)) throw new Error(`The ${rank} meld has too many wild cards.`);
  if (wilds.length >= naturals.length) throw new Error(`The ${rank} meld must have more natural cards than wild cards.`);
  if (!existingCards.length && selectedCards.length < 3) throw new Error(`A new ${rank} meld needs at least three cards.`);
}

function buildValidGroups(cards, board, rules) {
  const groups = new Map();
  const naturalPositions = [];
  const wildEntries = [];

  cards.forEach((card, index) => {
    if (isWild(card)) {
      wildEntries.push({ card, index });
      return;
    }
    if (card.rank === "3") throw new Error("Threes cannot be used in a normal meld.");
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
    naturalPositions.push({ index, rank: card.rank });
  });

  if (!naturalPositions.length) throw new Error("Select at least one natural rank with the wild cards.");

  const ranks = [...groups.keys()];
  const candidateRanks = wildEntries.map(({ index }) => [...ranks].sort((left, right) => {
    const leftDistance = Math.min(...naturalPositions.filter((item) => item.rank === left).map((item) => Math.abs(item.index - index)));
    const rightDistance = Math.min(...naturalPositions.filter((item) => item.rank === right).map((item) => Math.abs(item.index - index)));
    return leftDistance - rightDistance;
  }));

  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  function search(wildIndex, working, distance) {
    if (distance >= bestDistance) return;
    if (wildIndex >= wildEntries.length) {
      const result = [...working.entries()].map(([rank, groupCards]) => ({ rank, cards: groupCards }));
      try {
        for (const group of result) {
          const existing = board.find((meld) => meld.rank === group.rank);
          validateGroup(existing?.cards || [], group.cards, rules, group.rank);
        }
        best = result;
        bestDistance = distance;
      } catch {
        // Keep searching for a legal assignment of the selected wild cards.
      }
      return;
    }

    const entry = wildEntries[wildIndex];
    for (const rank of candidateRanks[wildIndex]) {
      const naturals = naturalPositions.filter((item) => item.rank === rank);
      const nearestDistance = Math.min(...naturals.map((item) => Math.abs(item.index - entry.index)));
      const next = new Map([...working.entries()].map(([key, value]) => [key, [...value]]));
      next.get(rank).push(entry.card);
      search(wildIndex + 1, next, distance + nearestDistance);
    }
  }

  search(0, new Map([...groups.entries()].map(([rank, groupCards]) => [rank, [...groupCards]])), 0);

  if (!best) {
    throw new Error("The selected cards cannot be divided into legal melds. Each meld needs at least three cards and more natural cards than wild cards.");
  }
  return best;
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
      const groups = buildValidGroups(selected, board, room.rules);

      const selectedPoints = selected.reduce((sum, card) => sum + cardPoints(card), 0);
      const alreadyOpened = Boolean(room.publicState.opened[player.team]);
      const stagedBefore = Number(room.publicState.openingTurnPoints || 0);
      const need = openingRequirement(Number(room.publicState.teamScores?.[player.team] || 0));
      const stagedAfter = alreadyOpened ? 0 : stagedBefore + selectedPoints;

      if (!alreadyOpened && room.publicState.openingTurnUid && room.publicState.openingTurnUid !== uid) {
        throw new Error("Another player has an unfinished opening meld.");
      }

      room.publicState.undoPlay = {
        uid,
        playerIndex: Number(room.publicState.currentPlayerIndex || 0),
        privateHand: hand,
        team: player.team,
        teamBoard: structuredClone(board),
        opened: alreadyOpened,
        openingTurnUid: room.publicState.openingTurnUid || null,
        openingTurnPoints: stagedBefore,
        handCount: hand.length,
        lastAction: room.publicState.lastAction || "",
      };

      for (const group of groups) {
        const existing = board.find((meld) => meld.rank === group.rank);
        if (existing) existing.cards = [...(existing.cards || []), ...group.cards];
        else board.push({ rank: group.rank, cards: group.cards });
      }

      let openingComplete = alreadyOpened;
      if (!alreadyOpened) {
        room.publicState.openingTurnUid = uid;
        room.publicState.openingTurnPoints = stagedAfter;
        if (stagedAfter >= need) {
          room.publicState.opened[player.team] = true;
          room.publicState.openingTurnUid = null;
          room.publicState.openingTurnPoints = 0;
          openingComplete = true;
        }
      }

      const used = new Set(orderedCardIds);
      room.privateHands[uid] = sortHand(hand.filter((card) => !used.has(card.id)));
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.turnPhase = "play";
      const groupText = groups.map((group) => `${group.rank}s`).join(", ");
      room.publicState.lastAction = openingComplete
        ? `${player.nickname} played ${groups.length} meld${groups.length === 1 ? "" : "s"}: ${groupText} for ${selectedPoints} points.`
        : `${player.nickname} staged ${groupText}; opening total is now ${stagedAfter} of ${need} points.`;

      if (room.privateHands[uid].length === 0) {
        if (!openingComplete) throw new Error("You cannot go out until the opening meld requirement is complete.");
        return finishRound(room, uid);
      }
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
      room.publicState.openingTurnUid = undo.openingTurnUid;
      room.publicState.openingTurnPoints = undo.openingTurnPoints;
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
