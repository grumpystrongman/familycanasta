import { isWild } from "./engine.js";

export function requiredCanastasToGoOut(rules = {}) {
  return Math.max(1, Number(rules.canastasToGoOut || 1));
}

export function countCanastas(board = []) {
  return board.filter((meld) => (meld.cards || []).length >= 7).length;
}

export function boardCanGoOut(board = [], rules = {}) {
  return countCanastas(board) >= requiredCanastasToGoOut(rules);
}

export function teamCanGoOut(room, team) {
  const board = room?.publicState?.teamBoards?.[team] || [];
  return boardCanGoOut(board, room?.rules || {});
}

function validMeld(cards, rules = {}) {
  if (cards.length < 3 || cards.some((card) => card.rank === "3")) return false;
  const naturals = cards.filter((card) => !isWild(card));
  const wilds = cards.filter(isWild);
  return naturals.length > 0
    && new Set(naturals.map((card) => card.rank)).size === 1
    && wilds.length < naturals.length
    && wilds.length <= Number(rules.maxWildsPerMeld || 3);
}

function uniqueSelectedCards(selected, hand) {
  const handIds = new Set(hand.map((card) => card.id));
  const used = new Set();
  const cards = [];
  for (const candidate of selected) {
    for (const card of candidate.cards || []) {
      if (!handIds.has(card.id) || used.has(card.id)) continue;
      used.add(card.id);
      cards.push(card);
    }
  }
  return cards;
}

function projectedBoard(currentMelds, selected) {
  const board = currentMelds.map((meld) => ({ ...meld, cards: [...(meld.cards || [])] }));
  for (const candidate of selected) {
    const existing = board.find((meld) => meld.rank === candidate.rank);
    if (existing) existing.cards.push(...(candidate.cards || []));
    else board.push({ rank: candidate.rank, cards: [...(candidate.cards || [])] });
  }
  return board;
}

function removeOnePlayableCard(selected, currentMelds, rules) {
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const candidate = selected[index];
    const isExisting = candidate.existing
      || currentMelds.some((meld) => meld.rank === candidate.rank);
    if (!isExisting || !(candidate.cards || []).length) continue;
    candidate.cards = candidate.cards.slice(0, -1);
    if (!candidate.cards.length) selected.splice(index, 1);
    return true;
  }

  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const candidate = selected[index];
    if (candidate.existing || currentMelds.some((meld) => meld.rank === candidate.rank)) continue;
    for (let cardIndex = candidate.cards.length - 1; cardIndex >= 0; cardIndex -= 1) {
      const remaining = candidate.cards.filter((_, current) => current !== cardIndex);
      if (!validMeld(remaining, rules)) continue;
      candidate.cards = remaining;
      return true;
    }
  }

  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const candidate = selected[index];
    if (candidate.existing || currentMelds.some((meld) => meld.rank === candidate.rank)) continue;
    selected.splice(index, 1);
    return true;
  }

  if (selected.length) {
    selected.pop();
    return true;
  }
  return false;
}

export function preserveCardsUntilCanasta(hand = [], currentMelds = [], candidates = [], rules = {}) {
  const selected = candidates.map((candidate) => ({
    ...candidate,
    cards: [...(candidate.cards || [])],
  }));

  if (boardCanGoOut(projectedBoard(currentMelds, selected), rules)) return selected;

  // A normal turn must still end with a discard. Until a canasta exists,
  // keep two cards before discarding so at least one remains afterward.
  const maximumPlayable = Math.max(0, hand.length - 2);
  let selectedCount = uniqueSelectedCards(selected, hand).length;
  let safety = 100;
  while (selectedCount > maximumPlayable && safety > 0) {
    safety -= 1;
    if (!removeOnePlayableCard(selected, currentMelds, rules)) break;
    selectedCount = uniqueSelectedCards(selected, hand).length;
  }
  return selected;
}
