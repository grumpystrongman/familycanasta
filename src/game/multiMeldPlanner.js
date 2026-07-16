import { cardPoints, isWild } from "./engine.js";

function pointsFor(cards) {
  return cards.reduce((sum, card) => sum + cardPoints(card), 0);
}

export function meldValidationError(existingCards = [], selectedCards = [], rules = {}, rank) {
  if (rank === "3") return "Threes cannot be used in a normal meld.";

  const combined = [...existingCards, ...selectedCards];
  const naturals = combined.filter((card) => !isWild(card));
  const wilds = combined.filter(isWild);

  if (!naturals.length || naturals.some((card) => card.rank !== rank)) {
    return `The ${rank} meld contains a card of another rank.`;
  }
  if (wilds.length > naturals.length) {
    return `The ${rank} meld cannot have more wild cards than natural cards.`;
  }
  if (!existingCards.length && selectedCards.length < 3) {
    return `A new ${rank} meld needs at least three cards.`;
  }
  return "";
}

function cloneGroups(groups) {
  return new Map([...groups.entries()].map(([rank, cards]) => [rank, [...cards]]));
}

function nearestDistance(rank, index, naturalPositions) {
  return Math.min(
    ...naturalPositions
      .filter((entry) => entry.rank === rank)
      .map((entry) => Math.abs(entry.index - index)),
  );
}

function evaluateGroups(groups, board, rules) {
  return [...groups.entries()].map(([rank, cards]) => {
    const existing = board.find((meld) => meld.rank === rank);
    return {
      rank,
      cards,
      points: pointsFor(cards),
      error: meldValidationError(existing?.cards || [], cards, rules, rank),
    };
  });
}

export function planGroupedMelds(cards = [], board = [], rules = {}) {
  const selected = cards.filter(Boolean);
  if (!selected.length) {
    return {
      groups: [],
      totalPoints: 0,
      selectedPoints: 0,
      valid: false,
      error: "Select cards to play.",
    };
  }

  const groups = new Map();
  const naturalPositions = [];
  const wildEntries = [];
  const threes = [];

  selected.forEach((card, index) => {
    if (isWild(card)) {
      wildEntries.push({ card, index });
      return;
    }
    if (card.rank === "3") {
      threes.push(card);
      return;
    }
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
    naturalPositions.push({ index, rank: card.rank });
  });

  const invalidStandaloneGroups = threes.length
    ? [{ rank: "3", cards: threes, points: pointsFor(threes), error: "Threes cannot be used in a normal meld." }]
    : [];

  if (!naturalPositions.length) {
    const wildGroup = wildEntries.length
      ? [{
        rank: "Wild",
        cards: wildEntries.map((entry) => entry.card),
        points: pointsFor(wildEntries.map((entry) => entry.card)),
        error: "Wild cards must be selected with at least one natural rank.",
      }]
      : [];
    return {
      groups: [...invalidStandaloneGroups, ...wildGroup],
      totalPoints: 0,
      selectedPoints: pointsFor(selected),
      valid: false,
      error: "Select at least one natural rank with the wild cards.",
    };
  }

  const ranks = [...groups.keys()];
  const firstPosition = Object.fromEntries(ranks.map((rank) => [
    rank,
    Math.min(...naturalPositions.filter((entry) => entry.rank === rank).map((entry) => entry.index)),
  ]));
  const candidateRanks = wildEntries.map(({ index }) => [...ranks].sort((left, right) => {
    const distance = nearestDistance(left, index, naturalPositions) - nearestDistance(right, index, naturalPositions);
    return distance || firstPosition[left] - firstPosition[right];
  }));

  const nearestGroups = cloneGroups(groups);
  wildEntries.forEach((entry, index) => nearestGroups.get(candidateRanks[index][0]).push(entry.card));
  const nearestEvaluation = evaluateGroups(nearestGroups, board, rules);
  const nearestIsValid = nearestEvaluation.every((group) => !group.error);

  let chosenGroups = nearestGroups;
  if (!nearestIsValid && wildEntries.length) {
    let bestGroups = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const assignedCounts = Object.fromEntries(ranks.map((rank) => [rank, 0]));
    const maxAssigned = Object.fromEntries(ranks.map((rank) => {
      const existing = board.find((meld) => meld.rank === rank)?.cards || [];
      const combinedNaturals = [...existing, ...groups.get(rank)].filter((card) => !isWild(card)).length;
      const existingWilds = existing.filter(isWild).length;
      const naturalBalanceLimit = combinedNaturals - existingWilds;
      return [rank, Math.max(0, naturalBalanceLimit)];
    }));

    function search(wildIndex, working, distance) {
      if (distance >= bestDistance) return;
      if (wildIndex >= wildEntries.length) {
        const evaluated = evaluateGroups(working, board, rules);
        if (evaluated.every((group) => !group.error)) {
          bestGroups = cloneGroups(working);
          bestDistance = distance;
        }
        return;
      }

      const entry = wildEntries[wildIndex];
      for (const rank of candidateRanks[wildIndex]) {
        if (assignedCounts[rank] >= maxAssigned[rank]) continue;
        assignedCounts[rank] += 1;
        working.get(rank).push(entry.card);
        search(
          wildIndex + 1,
          working,
          distance + nearestDistance(rank, entry.index, naturalPositions),
        );
        working.get(rank).pop();
        assignedCounts[rank] -= 1;
      }
    }

    search(0, cloneGroups(groups), 0);
    if (bestGroups) chosenGroups = bestGroups;
  }

  const plannedGroups = evaluateGroups(chosenGroups, board, rules);
  const allGroups = [...plannedGroups, ...invalidStandaloneGroups];
  const valid = allGroups.length > 0 && allGroups.every((group) => !group.error);

  return {
    groups: allGroups,
    totalPoints: allGroups.filter((group) => !group.error).reduce((sum, group) => sum + group.points, 0),
    selectedPoints: pointsFor(selected),
    valid,
    error: valid ? "" : "One or more proposed melds are invalid.",
  };
}
