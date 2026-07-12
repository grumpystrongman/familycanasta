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
import { planDiscardPickup, validatePendingPickupSelection } from "./discardPickupPlanner";
import {
  drawOneWithRedThreeReplacement,
  extractRedThreesFromClaimedPile,
} from "./redThreeRules.js";
import {
  activeHouseRules,
  validateDrawAction,
  validateGoOutAction,
  validateMeldAction,
} from "./houseRules.js";

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

function advanceTurnWithoutDiscard(room) {
  const { players } = activePlayer(room);
  room.publicState.currentPlayerIndex = (Number(room.publicState.currentPlayerIndex || 0) + 1) % players.length;
  room.publicState.turnPhase = "draw";
  room.publicState.stockExhausted = true;
  room.publicState.endRoundCheckRequested = true;
}

export async function drawFromStock(code, uid) {
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    const player = assertTurn(room, uid, "draw");
    if (!room.stock?.length) {
      room.publicState.stockExhausted = true;
      room.publicState.endRoundCheckRequested = true;
      room.publicState.lastAction = "The stock is empty. Checking whether the round can continue.";
      return room;
    }

    const requested = validateDrawAction(room, player, "stock").drawCount;
    let drawn = 0;
    let exposed = 0;
    let exhaustedOnRedThree = false;

    for (let index = 0; index < requested && room.stock.length; index += 1) {
      const draw = drawOneWithRedThreeReplacement(room, uid);
      if (draw.card) drawn += 1;
      exposed += draw.exposed.length;
      if (draw.exhaustedOnRedThree) {
        exhaustedOnRedThree = true;
        break;
      }
    }

    if (exhaustedOnRedThree) {
      advanceTurnWithoutDiscard(room);
      room.publicState.lastAction = `${player.nickname} exposed the final stock card as a red three. No replacement was available, so the turn ended without a discard.`;
      return room;
    }

    room.publicState.turnPhase = "play";
    room.publicState.stockExhausted = room.stock.length === 0;
    room.publicState.lastAction = `${player.nickname} drew ${drawn} card${drawn === 1 ? "" : "s"} from the stock${exposed ? ` and exposed ${exposed} red three${exposed === 1 ? "" : "s"}` : ""}.`;
    return room;
  }, { applyLocally: false });
  if (!result.committed) throw new Error("The draw could not be completed.");
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

export async function takeDiscardPile(code, uid) {
  let actionError = "The discard pile cannot be taken with your current hand.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertTurn(room, uid, "draw");
      const houseValidation = validateDrawAction(room, player, "discardPile");
      const plan = planDiscardPickup(room, player);
      const fullPile = room.publicState?.discardPile || [];
      const takeCount = houseValidation.discardTakeCount;
      const pile = fullPile.slice(-takeCount);
      const lowerPile = pile.slice(0, -1);
      const hand = [...(room.privateHands?.[uid] || [])];
      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[player.team] ||= [];
      room.publicState.handCounts ||= {};
      const board = room.publicState.teamBoards[player.team];

      if (plan.mode === "pending-opening") {
        const claimed = extractRedThreesFromClaimedPile(room, uid, pile);
        room.privateHands[uid] = sortHand([...hand, ...claimed.handCards]);
        room.publicState.pendingDiscardPickup = {
          uid,
          team: player.team,
          rank: plan.rank,
          topCardId: plan.top.id,
          matchingNaturalIds: plan.matchingNaturalIds,
          requiredNaturalCount: plan.requiredNaturalCount,
          requirement: plan.requirement,
        };
        room.publicState.lastAction = `${player.nickname} took ${takeCount} discard card${takeCount === 1 ? "" : "s"}. Their opening must include the picked-up ${plan.rank} and two natural ${plan.rank}s.${claimed.exposed.length ? ` ${claimed.exposed.length} buried red three${claimed.exposed.length === 1 ? " was" : "s were"} exposed without replacement.` : ""}`;
      } else {
        if (plan.existing) {
          validateMeldAction(room, plan.existing, plan.forcedCards);
          plan.existing.cards = [...(plan.existing.cards || []), ...plan.forcedCards];
        } else {
          validateMeldAction(room, null, plan.forcedCards);
          board.push({ rank: plan.top.rank, cards: plan.forcedCards });
        }
        const used = new Set(plan.usedNaturalIds);
        const claimed = extractRedThreesFromClaimedPile(room, uid, lowerPile);
        room.privateHands[uid] = sortHand([
          ...hand.filter((card) => !used.has(card.id)),
          ...claimed.handCards,
        ]);
        room.publicState.pendingDiscardPickup = null;
        room.publicState.lastAction = `${player.nickname} took ${takeCount} discard card${takeCount === 1 ? "" : "s"}, played the top ${plan.top.rank}, and kept the remaining cards in hand.${claimed.exposed.length ? ` ${claimed.exposed.length} buried red three${claimed.exposed.length === 1 ? " was" : "s were"} exposed without replacement.` : ""}`;
      }

      room.publicState.discardPile = fullPile.slice(0, Math.max(0, fullPile.length - takeCount));
      room.publicState.discardFrozen = room.publicState.discardPile.length > 0 ? room.publicState.discardFrozen : false;
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

      validateMeldAction(room, existing, selected);
      if (existing) validateCombinedMeld([...(existing.cards || []), ...selected], room.activeRules || room.rules);
      else {
        if (selected.length < 3) throw new Error("A new meld needs at least three cards. To add one or two cards, choose an existing board meld.");
        rank = validateCombinedMeld(selected, room.activeRules || room.rules);
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

      if (existing) existing.cards = [...(existing.cards || []), ...selected];
      else board.push({ rank, cards: selected });
      room.publicState.opened[player.team] = true;
      room.publicState.pendingDiscardPickup = null;
      room.publicState.openingTurnUid = null;
      room.publicState.openingTurnPoints = 0;
      room.privateHands[uid] = hand.filter((card) => !cardIds.includes(card.id));
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.turnPhase = "play";
      room.publicState.lastAction = `${player.nickname} played ${selected.length} card${selected.length === 1 ? "" : "s"} on ${rank}s.`;
      if (room.privateHands[uid].length === 0) {
        validateGoOutAction(room, player, "meld");
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
      if (isRedThree(card)) throw new Error("Red threes cannot be discarded. They must be exposed face-up.");
      if (hand.length === 1) validateGoOutAction(room, player, "discard");
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
      room.publicState.currentPlayerIndex = (Number(room.publicState.currentPlayerIndex || 0) + 1) % players.length;
      room.publicState.turnPhase = "draw";
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}
