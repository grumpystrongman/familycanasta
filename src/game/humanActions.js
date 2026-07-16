import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import {
  cardPoints,
  finishRound,
  isBlackThree,
  isRedThree,
  isWild,
  openingRequirementForTeam,
  sortHand,
} from "./engine";
import {
  planDiscardPickup,
  stockExhaustionPickupStatus,
  validatePendingPickupSelection,
} from "./discardPickupPlanner";
import { boardCanGoOut, teamCanGoOut } from "./goOutRules";

function orderedPlayers(room) {
  return Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
}

function activePlayer(room) {
  const players = orderedPlayers(room);
  return { players, player: players[Number(room.publicState?.currentPlayerIndex || 0)] };
}

function assertTurn(room, uid, phase) {
  if (!room || room.status !== "playing" || room.publicState?.phase !== "playing") {
    throw new Error("The game is not ready for a move.");
  }
  const { player } = activePlayer(room);
  if (player?.uid !== uid) throw new Error("It is not your turn.");
  if (room.publicState?.turnPhase !== phase) {
    throw new Error(phase === "draw" ? "You have already drawn. Play cards or discard." : "Draw cards first.");
  }
  return player;
}

function drawOneReplacingRedThrees(room, uid) {
  room.privateHands ||= {};
  room.privateHands[uid] ||= [];
  room.stock ||= [];
  room.publicState.redThrees ||= {};
  room.publicState.redThrees[uid] ||= [];

  let redThreeCount = 0;
  let card = room.stock.pop();
  while (card && isRedThree(card)) {
    room.publicState.redThrees[uid].push(card);
    redThreeCount += 1;
    card = room.stock.pop();
  }

  if (card) room.privateHands[uid].push(card);
  room.privateHands[uid] = sortHand(room.privateHands[uid]);
  room.publicState.handCounts[uid] = room.privateHands[uid].length;
  room.publicState.stockCount = room.stock.length;
  return {
    card,
    redThreeCount,
    missingReplacement: redThreeCount > 0 && !card,
  };
}

function emptyStockMessage(room, player) {
  const status = stockExhaustionPickupStatus(room, player);
  if (!status.canTake) return "";
  return status.mustTake
    ? `The stock is exhausted. ${player.nickname} must take the discard pile.`
    : `The stock is exhausted. ${player.nickname} may take the discard pile or end the round.`;
}

export async function drawFromStock(code, uid) {
  let actionError = "The draw could not be completed.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertTurn(room, uid, "draw");
      if (!room.stock?.length) {
        const status = stockExhaustionPickupStatus(room, player);
        if (status.mustTake) {
          throw new Error("The stock is exhausted. You must take the discard pile because its top card matches your team's open meld.");
        }
        return finishRound(room, null, {
          reason: "stock-exhausted",
          blockedUid: uid,
          declinedPickup: status.canTake,
        });
      }

      const requested = Math.max(1, Number(room.rules?.drawCount || 2));
      let drawn = 0;
      for (let index = 0; index < requested && room.stock.length; index += 1) {
        const outcome = drawOneReplacingRedThrees(room, uid);
        if (outcome.card) drawn += 1;
        if (outcome.missingReplacement) {
          return finishRound(room, null, { reason: "last-red-three", blockedUid: uid });
        }
      }
      room.publicState.turnPhase = "play";
      room.publicState.lastAction = `${player.nickname} drew ${drawn} card${drawn === 1 ? "" : "s"} from the stock.`;
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}

function validateCombinedMeld(cards, rules) {
  if (cards.some((card) => card.rank === "3")) throw new Error("Threes cannot be used in a normal meld.");
  const naturals = cards.filter((card) => !isWild(card));
  const wilds = cards.filter(isWild);
  if (!naturals.length) throw new Error("A meld needs natural cards.");
  if (new Set(naturals.map((card) => card.rank)).size !== 1) throw new Error("All natural cards must have the same rank.");
  if (wilds.length > Number(rules?.maxWildsPerMeld || 3)) throw new Error("Too many wild cards in that meld.");
  if (wilds.length >= naturals.length) throw new Error("A meld must contain more natural cards than wild cards.");
  return naturals[0].rank;
}

function projectedBoardAfterPlay(board, existing, rank, selected) {
  const projected = board.map((meld) => ({ ...meld, cards: [...(meld.cards || [])] }));
  if (existing) {
    const target = projected.find((meld) => meld.rank === existing.rank);
    target.cards.push(...selected);
  } else {
    projected.push({ rank, cards: [...selected] });
  }
  return projected;
}

export async function takeDiscardPile(code, uid) {
  let actionError = "The discard pile cannot be taken with your current hand.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertTurn(room, uid, "draw");
      const plan = planDiscardPickup(room, player);
      const hand = [...(room.privateHands?.[uid] || [])];
      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[player.team] ||= [];
      room.publicState.handCounts ||= {};
      const board = room.publicState.teamBoards[player.team];

      if (plan.mode === "pending-opening") {
        room.privateHands[uid] = sortHand([...hand, ...plan.pile]);
        room.publicState.pendingDiscardPickup = {
          uid,
          team: player.team,
          rank: plan.rank,
          topCardId: plan.top.id,
          matchingNaturalIds: plan.matchingNaturalIds,
          requiredNaturalCount: plan.requiredNaturalCount,
          requiredSupportCardIds: plan.requiredSupportCardIds,
          supportDescription: plan.supportDescription,
          requirement: plan.requirement,
        };
        room.publicState.lastAction = `${player.nickname} took the discard pile. Their opening must include the picked-up ${plan.rank} and ${plan.supportDescription}.`;
      } else {
        if (plan.existing) {
          plan.existing.cards = [...(plan.existing.cards || []), ...plan.forcedCards];
        } else {
          board.push({ rank: plan.top.rank, cards: plan.forcedCards });
        }
        const used = new Set(plan.usedHandCardIds || plan.usedNaturalIds || []);
        room.privateHands[uid] = sortHand([
          ...hand.filter((card) => !used.has(card.id)),
          ...plan.lowerPile,
        ]);
        room.publicState.pendingDiscardPickup = null;
        room.publicState.lastAction = `${player.nickname} took the discard pile using ${plan.supportDescription}, played the top ${plan.top.rank}, and kept the remaining cards in hand.`;
      }

      room.publicState.discardPile = [];
      room.publicState.discardFrozen = false;
      room.publicState.discardPileHasBeenTaken = true;
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.turnPhase = "play";
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}

export async function meldSelectedCards(code, uid, cardIds, targetRank = null) {
  if (!cardIds?.length) throw new Error("Select cards to play.");
  let actionError = "The play could not be completed.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertTurn(room, uid, "play");
      const hand = room.privateHands?.[uid] || [];
      const selected = hand.filter((card) => cardIds.includes(card.id));
      if (selected.length !== cardIds.length) throw new Error("One of the selected cards is no longer in your hand.");
      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[player.team] ||= [];
      room.publicState.opened ||= {};
      const board = room.publicState.teamBoards[player.team];
      const naturalRanks = [...new Set(selected.filter((card) => !isWild(card)).map((card) => card.rank))];
      let rank = targetRank || (naturalRanks.length === 1 ? naturalRanks[0] : null);
      let existing = rank ? board.find((meld) => meld.rank === rank) : null;

      if (selected.every(isWild)) {
        if (!targetRank) throw new Error("Choose which board meld receives the wild card.");
        existing = board.find((meld) => meld.rank === targetRank);
        if (!existing) throw new Error(`There is no ${targetRank} meld on your board.`);
        rank = targetRank;
      }

      if (existing) validateCombinedMeld([...(existing.cards || []), ...selected], room.rules);
      else {
        if (selected.length < 3) throw new Error("A new meld needs at least three cards. To add one or two cards, choose an existing board meld.");
        rank = validateCombinedMeld(selected, room.rules);
      }

      const alreadyOpened = Boolean(room.publicState.opened[player.team]);
      if (!alreadyOpened) {
        const pending = room.publicState?.pendingDiscardPickup?.uid === uid
          ? room.publicState.pendingDiscardPickup
          : null;
        const pendingError = validatePendingPickupSelection(pending, selected);
        if (pendingError) throw new Error(pendingError);
        const value = selected.reduce((sum, card) => sum + cardPoints(card), 0);
        const requirement = openingRequirementForTeam(room, player.team);
        if (value < requirement) {
          throw new Error(`Your opening play must be committed at once for ${requirement} points; selected cards total ${value}.`);
        }
      }

      const remainingHand = hand.filter((card) => !cardIds.includes(card.id));
      const projectedBoard = projectedBoardAfterPlay(board, existing, rank, selected);
      if (!boardCanGoOut(projectedBoard, room.rules) && remainingHand.length < 2) {
        throw new Error("Your team needs a canasta before going out. Keep at least two cards before the discard so one card remains after your turn.");
      }

      if (existing) existing.cards = [...(existing.cards || []), ...selected];
      else board.push({ rank, cards: selected });
      room.publicState.opened[player.team] = true;
      room.publicState.pendingDiscardPickup = null;
      room.publicState.openingTurnUid = null;
      room.publicState.openingTurnPoints = 0;
      room.privateHands[uid] = remainingHand;
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.turnPhase = "play";
      room.publicState.lastAction = `${player.nickname} played ${selected.length} card${selected.length === 1 ? "" : "s"} on ${rank}s.`;
      if (room.privateHands[uid].length === 0) return finishRound(room, uid);
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}

export async function discardSelectedCard(code, uid, cardId) {
  let actionError = "The discard could not be completed.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertTurn(room, uid, "play");
      const pending = room.publicState?.pendingDiscardPickup;
      if (pending?.uid === uid) {
        throw new Error(`Complete the opening with the picked-up ${pending.rank} before discarding.`);
      }
      if (room.publicState?.openingTurnUid === uid) {
        throw new Error("Complete or undo the unfinished opening before discarding.");
      }
      const hand = room.privateHands?.[uid] || [];
      const card = hand.find((item) => item.id === cardId);
      if (!card) throw new Error("That card is no longer in your hand.");
      if (isRedThree(card)) throw new Error("Red threes are laid down automatically and replaced.");
      if (hand.length === 1 && !teamCanGoOut(room, player.team)) {
        throw new Error("Your team needs a canasta before going out. You must keep at least one card in your hand.");
      }
      room.privateHands[uid] = hand.filter((item) => item.id !== cardId);
      room.publicState.discardPile ||= [];
      room.publicState.discardPile.push(card);
      const freezesPile = (isWild(card) && room.rules?.freezeOnWild !== false)
        || (isBlackThree(card) && room.rules?.freezeOnBlackThree !== false);
      if (freezesPile) room.publicState.discardFrozen = true;
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.lastAction = `${player.nickname} discarded ${card.rank}${card.suit}${freezesPile ? " and froze the discard pile" : ""}.`;
      if (room.privateHands[uid].length === 0) return finishRound(room, uid);

      const { players } = activePlayer(room);
      const nextIndex = (Number(room.publicState.currentPlayerIndex || 0) + 1) % players.length;
      const nextPlayer = players[nextIndex];
      room.publicState.currentPlayerIndex = nextIndex;
      room.publicState.turnPhase = "draw";

      if (!room.stock?.length) {
        const status = stockExhaustionPickupStatus(room, nextPlayer);
        if (!status.canTake) {
          return finishRound(room, null, { reason: "stock-exhausted", blockedUid: nextPlayer.uid });
        }
        room.publicState.lastAction = `${room.publicState.lastAction} ${emptyStockMessage(room, nextPlayer)}`;
      }
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}
