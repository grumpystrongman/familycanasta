import {
  cardPoints,
  isBlackThree,
  isRedThree,
  isWild,
  openingRequirementForTeam,
} from "./engine.js";

function maximumOpeningPoints(hand, top, matchingNaturals, rules = {}) {
  const used = new Set(matchingNaturals.map((card) => card.id));
  const groups = [{ rank: top.rank, cards: [top, ...matchingNaturals], valid: true }];
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
    .filter((card) => isWild(card))
    .sort((left, right) => cardPoints(right) - cardPoints(left));

  for (const pair of pairs) {
    const wild = wildCards.shift();
    if (!wild) break;
    pair.cards.push(wild);
    pair.valid = true;
    groups.push(pair);
  }

  const maxWilds = Number(rules?.maxWildsPerMeld || 3);
  for (const wild of wildCards) {
    const target = groups.find((group) => {
      const naturals = group.cards.filter((card) => !isWild(card)).length;
      const wilds = group.cards.filter(isWild).length;
      return wilds < maxWilds && wilds + 1 < naturals;
    });
    if (!target) break;
    target.cards.push(wild);
  }

  return groups
    .filter((group) => group.valid)
    .flatMap((group) => group.cards)
    .reduce((sum, card) => sum + cardPoints(card), 0);
}

export function validatePendingPickupSelection(pending, selectedCards = []) {
  if (!pending) return "";
  const selectedIds = new Set(selectedCards.map((card) => card.id));
  if (!selectedIds.has(pending.topCardId)) {
    return `Your opening must include the picked-up ${pending.rank}.`;
  }
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
  const board = room.publicState?.teamBoards?.[player.team] || [];
  const existing = board.find((meld) => meld.rank === top.rank);
  if ((existing?.cards?.length || 0) >= 7) {
    throw new Error(`${top.rank}s are already a completed book on your board. This safe discard cannot be picked up.`);
  }

  const matchingNaturals = hand.filter((card) => !isWild(card) && card.rank === top.rank);
  const frozen = room.publicState?.discardFrozen !== false;
  const opened = Boolean(room.publicState?.opened?.[player.team]);

  if (frozen && matchingNaturals.length < 2) {
    throw new Error("The discard pile is frozen. You need two natural cards matching the top discard.");
  }
  if (!frozen && !existing && matchingNaturals.length < 2) {
    throw new Error("You need two natural matches unless that rank is already on your board.");
  }

  if (!opened) {
    if (matchingNaturals.length < 2) {
      throw new Error("Before opening, the top discard must be combined with two natural matches from your hand.");
    }
    const requirement = openingRequirementForTeam(room, player.team);
    const availablePoints = maximumOpeningPoints(hand, top, matchingNaturals, room.rules);
    if (availablePoints < requirement) {
      throw new Error(`Taking this pile cannot produce a legal ${requirement}-point opening. The available legal melds total ${availablePoints}.`);
    }
    return {
      mode: "pending-opening",
      top,
      pile: [...pile],
      rank: top.rank,
      requirement,
      matchingNaturalIds: matchingNaturals.map((card) => card.id),
      requiredNaturalCount: 2,
      availablePoints,
    };
  }

  const requiredNaturals = existing && !frozen ? [] : matchingNaturals.slice(0, 2);
  return {
    mode: "immediate",
    top,
    lowerPile: pile.slice(0, -1),
    existing,
    forcedCards: [top, ...requiredNaturals],
    usedNaturalIds: requiredNaturals.map((card) => card.id),
  };
}
