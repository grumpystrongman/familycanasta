import {
  cardPoints,
  isBlackThree,
  isRedThree,
  isWild,
  openingRequirementForTeam,
} from "./engine.js";
import { boardCanGoOut } from "./goOutRules.js";

function discardPickupRule(room) {
  return room.rules?.discardPickupRule === "modern" ? "modern" : "classic";
}

function maximumOpeningPoints(hand, top, supportCards) {
  const used = new Set(supportCards.map((card) => card.id));
  const topNaturals = hand.filter((card) => (
    !used.has(card.id)
    && !isWild(card)
    && card.rank === top.rank
  ));
  topNaturals.forEach((card) => used.add(card.id));

  const groups = [{ rank: top.rank, cards: [top, ...supportCards, ...topNaturals], valid: true }];
  const pairs = [];
  const byRank = hand.reduce((result, card) => {
    if (!used.has(card.id) && !isWild(card) && card.rank !== "3") {
      (result[card.rank] ||= []).push(card);
    }
    return result;
  }, {});

  for (const [rank, cards] of Object.entries(byRank)) {
    if (cards.length >= 3) groups.push({ rank, cards: [...cards], valid: true });
    else if (cards.length === 2) pairs.push({ rank, cards: [...cards], valid: false });
  }

  const wildCards = hand
    .filter((card) => isWild(card) && !used.has(card.id))
    .sort((left, right) => cardPoints(right) - cardPoints(left));

  for (const pair of pairs) {
    const wild = wildCards.shift();
    if (!wild) break;
    pair.cards.push(wild);
    pair.valid = true;
    groups.push(pair);
  }

  for (const wild of wildCards) {
    const target = groups.find((group) => {
      const naturals = group.cards.filter((card) => !isWild(card)).length;
      const wilds = group.cards.filter(isWild).length;
      return wilds + 1 <= naturals;
    });
    if (!target) break;
    target.cards.push(wild);
  }

  return groups
    .filter((group) => group.valid)
    .flatMap((group) => group.cards)
    .reduce((sum, card) => sum + cardPoints(card), 0);
}

function selectPickupSupport({ hand, top, frozen, existing, rule }) {
  const matchingNaturals = hand.filter((card) => !isWild(card) && card.rank === top.rank);
  const wildCards = hand.filter(isWild);
  const requiresTwoNaturals = frozen || rule === "modern";

  if (requiresTwoNaturals) {
    if (matchingNaturals.length < 2) {
      throw new Error(rule === "modern"
        ? "Modern American Canasta requires two natural cards matching the top discard, whether the pile is frozen or unfrozen."
        : "The discard pile is frozen. You need two natural cards matching the top discard, even when that rank is already melded on your board.");
    }
    return {
      supportCards: matchingNaturals.slice(0, 2),
      matchingNaturals,
      description: `two natural ${top.rank}s`,
      method: "two-naturals",
    };
  }

  // Classic Canasta only: after the player explicitly clicks an UNFROZEN
  // discard pile, the top card may be added directly to a matching board meld.
  if (existing) {
    return {
      supportCards: [],
      matchingNaturals,
      description: `your existing ${top.rank} meld`,
      method: "existing-meld",
    };
  }

  if (matchingNaturals.length >= 2) {
    return {
      supportCards: matchingNaturals.slice(0, 2),
      matchingNaturals,
      description: `two natural ${top.rank}s`,
      method: "two-naturals",
    };
  }

  // Otherwise, the top discard plus one matching natural and one wild card
  // form the required three-card meld for an unfrozen Classic Canasta pile.
  if (matchingNaturals.length >= 1 && wildCards.length >= 1) {
    return {
      supportCards: [matchingNaturals[0], wildCards[0]],
      matchingNaturals,
      description: `one natural ${top.rank} and one wild card`,
      method: "natural-wild",
    };
  }

  throw new Error(`Classic Canasta needs an existing ${top.rank} meld, two natural ${top.rank}s, or one natural ${top.rank} plus one wild card to take an unfrozen pile.`);
}

function projectedBoardAfterPickup(board, existing, top, supportCards) {
  const projected = board.map((meld) => ({ ...meld, cards: [...(meld.cards || [])] }));
  if (existing) {
    const target = projected.find((meld) => meld.rank === existing.rank);
    target.cards.push(top, ...supportCards);
  } else {
    projected.push({ rank: top.rank, cards: [top, ...supportCards] });
  }
  return projected;
}

export function validatePendingPickupSelection(pending, selectedCards = []) {
  if (!pending) return "";
  const selectedIds = new Set(selectedCards.map((card) => card.id));
  if (!selectedIds.has(pending.topCardId)) {
    return `Your opening must include the picked-up ${pending.rank}.`;
  }

  const requiredSupportCardIds = pending.requiredSupportCardIds || [];
  if (requiredSupportCardIds.length) {
    const missingSupport = requiredSupportCardIds.some((id) => !selectedIds.has(id));
    if (missingSupport) {
      return `Your opening must include ${pending.supportDescription || "the cards used to claim the discard pile"}.`;
    }
    return "";
  }

  // Legacy pending pickups stored only the natural-card requirement.
  const naturalMatches = (pending.matchingNaturalIds || [])
    .filter((id) => selectedIds.has(id))
    .length;
  if (naturalMatches < Number(pending.requiredNaturalCount || 2)) {
    return `Your opening must include two natural ${pending.rank}s that were already in your hand.`;
  }
  return "";
}

export function planDiscardPickup(room, player) {
  const pile = room.publicState?.discardPile || [];
  const top = pile[pile.length - 1];
  if (!top || isWild(top) || isRedThree(top) || isBlackThree(top)) {
    throw new Error("The top discard cannot be used to take the pile.");
  }

  const hand = room.privateHands?.[player.uid] || [];
  if (hand.length === 1 && pile.length === 1) {
    throw new Error("A one-card hand cannot take a one-card discard pile.");
  }

  const board = room.publicState?.teamBoards?.[player.team] || [];
  const existing = board.find((meld) => meld.rank === top.rank);
  const frozen = room.publicState?.discardFrozen !== false;
  const opened = Boolean(room.publicState?.opened?.[player.team]);
  const rule = discardPickupRule(room);
  const directBoardMeld = !frozen && rule === "classic" && opened ? existing : null;
  const support = selectPickupSupport({
    hand,
    top,
    frozen,
    existing: directBoardMeld,
    rule,
  });

  if (!opened) {
    const requirement = openingRequirementForTeam(room, player.team);
    const availablePoints = maximumOpeningPoints(hand, top, support.supportCards);
    if (availablePoints < requirement) {
      throw new Error(`Taking this pile cannot produce a legal ${requirement}-point opening. The available legal melds total ${availablePoints}.`);
    }
    return {
      mode: "pending-opening",
      top,
      pile: [...pile],
      rank: top.rank,
      requirement,
      matchingNaturalIds: support.matchingNaturals.map((card) => card.id),
      requiredNaturalCount: support.supportCards.filter((card) => !isWild(card)).length,
      requiredSupportCardIds: support.supportCards.map((card) => card.id),
      supportDescription: support.description,
      pickupMethod: support.method,
      availablePoints,
      pickupRule: rule,
    };
  }

  const lowerPile = pile.slice(0, -1);
  const remainingHandCount = hand.length - support.supportCards.length + lowerPile.length;
  const projectedBoard = projectedBoardAfterPickup(board, existing, top, support.supportCards);
  if (!boardCanGoOut(projectedBoard, room.rules) && remainingHandCount < 2) {
    throw new Error("Taking this discard pile would leave too few cards to complete the turn. Until your team has a canasta, you must keep one card after discarding.");
  }

  return {
    mode: "immediate",
    top,
    lowerPile,
    existing,
    forcedCards: [top, ...support.supportCards],
    usedHandCardIds: support.supportCards.map((card) => card.id),
    usedNaturalIds: support.supportCards.filter((card) => !isWild(card)).map((card) => card.id),
    pickupRule: rule,
    pickupMethod: support.method,
    supportDescription: support.description,
  };
}

export function stockExhaustionPickupStatus(room, player) {
  try {
    const plan = planDiscardPickup(room, player);
    return {
      canTake: true,
      // Even with a matching board meld, taking the pile is a player choice.
      // The player must explicitly click the discard pile to perform the pickup.
      mustTake: false,
      plan,
      reason: "",
    };
  } catch (error) {
    return {
      canTake: false,
      mustTake: false,
      plan: null,
      reason: error.message,
    };
  }
}
