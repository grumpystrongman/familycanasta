import { createStandardDeck, shuffleCards } from "../../platform/standardDeck.js";

export const GOLF_RULES = Object.freeze({ playersMin: 2, playersMax: 4, holes: 9 });

function cardScore(card) {
  if (!card) return 0;
  if (card.rank === "A") return 1;
  if (card.rank === "2") return -2;
  if (card.rank === "K") return 0;
  if (card.rank === "J" || card.rank === "Q") return 10;
  return Number(card.rank) || 0;
}

export function scoreGolfGrid(cards) {
  if (!cards || cards.length !== 6) return 0;
  let score = 0;
  for (let column = 0; column < 3; column += 1) {
    const top = cards[column]; const bottom = cards[column + 3];
    if (top?.rank === bottom?.rank) continue;
    score += cardScore(top) + cardScore(bottom);
  }
  return score;
}

function dealHole(members, holeNumber, previous = {}, random = Math.random) {
  if (members.length < 2 || members.length > 4) throw new Error("Six Card Golf supports two to four players.");
  const deck = shuffleCards(createStandardDeck(`golf-${holeNumber}`), random);
  const grids = Object.fromEntries(members.map((member) => [member.uid, []]));
  for (let cardIndex = 0; cardIndex < 6; cardIndex += 1) members.forEach((member) => grids[member.uid].push(deck.shift()));
  const dealerIndex = previous.dealerIndex == null ? 0 : (Number(previous.dealerIndex) + 1) % members.length;
  return {
    phase: "reveal", holeNumber, roundNumber: holeNumber, dealerIndex, currentPlayerIndex: (dealerIndex + 1) % members.length,
    grids, faceUp: Object.fromEntries(members.map((member) => [member.uid, []])), stock: deck.slice(1), discardPile: [deck[0]],
    drawnCard: null, drawnFrom: null,
    totals: { ...(previous.totals || Object.fromEntries(members.map((member) => [member.uid, 0]))) },
    holeScores: {}, winnerUid: null, message: "Each player turns two grid cards face up.",
  };
}

export function createGolfGame(members, rules = {}, random = Math.random) { return { ...dealHole(members, 1, {}, random), holes: Number(rules.holes || GOLF_RULES.holes) }; }
function allPlayersRevealed(state, members) { return members.every((member) => (state.faceUp?.[member.uid] || []).length === 2); }

function revealInitial(state, actorUid, indexes, members) {
  if (state.phase !== "reveal") throw new Error("Initial cards are already revealed.");
  if (!Array.isArray(indexes) || indexes.length !== 2 || new Set(indexes).size !== 2 || indexes.some((index) => index < 0 || index > 5)) throw new Error("Choose exactly two grid cards to reveal.");
  if ((state.faceUp?.[actorUid] || []).length) throw new Error("You already revealed your two cards.");
  const faceUp = { ...(state.faceUp || {}), [actorUid]: [...indexes].sort((a, b) => a - b) };
  if (!allPlayersRevealed({ ...state, faceUp }, members)) return { ...state, faceUp, message: "Waiting for everyone to reveal two cards." };
  const first = (Number(state.dealerIndex || 0) + 1) % members.length;
  return { ...state, faceUp, phase: "playing", currentPlayerIndex: first, message: `${members[first].nickname} draws first.` };
}

function replenishStock(stock, discardPile, random = Math.random) {
  if (stock.length) return { stock, discardPile };
  if (discardPile.length <= 1) throw new Error("No cards remain to draw.");
  const top = discardPile.at(-1);
  return { stock: shuffleCards(discardPile.slice(0, -1), random), discardPile: [top] };
}

function draw(state, actorUid, source, members, random = Math.random) {
  if (state.phase !== "playing" || state.drawnCard) throw new Error("Finish the current draw first.");
  if (members[Number(state.currentPlayerIndex || 0)]?.uid !== actorUid) throw new Error("It is not your turn.");
  let stock = [...(state.stock || [])]; let discardPile = [...(state.discardPile || [])]; let card;
  if (source === "discard") { card = discardPile.pop(); if (!card) throw new Error("The discard pile is empty."); }
  else { ({ stock, discardPile } = replenishStock(stock, discardPile, random)); card = stock.shift(); }
  return { ...state, stock, discardPile, drawnCard: card, drawnFrom: source, message: "Swap the drawn card into your grid, or discard it." };
}

function finishHole(state, members) {
  const faceUp = Object.fromEntries(members.map((member) => [member.uid, [0,1,2,3,4,5]]));
  const holeScores = Object.fromEntries(members.map((member) => [member.uid, scoreGolfGrid(state.grids?.[member.uid] || [])]));
  const totals = { ...(state.totals || {}) };
  members.forEach((member) => { totals[member.uid] = Number(totals[member.uid] || 0) + holeScores[member.uid]; });
  const finalHole = Number(state.holeNumber || 1) >= Number(state.holes || GOLF_RULES.holes);
  const winnerUid = finalHole ? [...members].sort((a, b) => totals[a.uid] - totals[b.uid])[0]?.uid || null : null;
  return { ...state, faceUp, holeScores, totals, phase: finalHole ? "game-over" : "hole-end", winnerUid, message: finalHole ? `${members.find((member) => member.uid === winnerUid)?.nickname} wins with the lowest nine-hole total.` : `Hole ${state.holeNumber} is complete.` };
}

function advanceTurn(state, members) {
  const next = (Number(state.currentPlayerIndex || 0) + 1) % members.length;
  return { ...state, currentPlayerIndex: next, drawnCard: null, drawnFrom: null, message: `${members[next].nickname} draws next.` };
}

function swap(state, actorUid, index, members) {
  if (state.phase !== "playing" || !state.drawnCard) throw new Error("Draw a card first.");
  if (members[Number(state.currentPlayerIndex || 0)]?.uid !== actorUid) throw new Error("It is not your turn.");
  if (!Number.isInteger(index) || index < 0 || index > 5) throw new Error("Choose one of your six grid positions.");
  const grids = { ...(state.grids || {}) }; const grid = [...(grids[actorUid] || [])]; const replaced = grid[index];
  grid[index] = state.drawnCard; grids[actorUid] = grid;
  const faceUp = { ...(state.faceUp || {}) }; faceUp[actorUid] = [...new Set([...(faceUp[actorUid] || []), index])].sort((a, b) => a - b);
  const nextState = { ...state, grids, faceUp, discardPile: [...(state.discardPile || []), replaced] };
  if (faceUp[actorUid].length === 6) return finishHole({ ...nextState, drawnCard: null, drawnFrom: null }, members);
  return advanceTurn(nextState, members);
}

function discardDrawn(state, actorUid, members) {
  if (state.phase !== "playing" || !state.drawnCard) throw new Error("Draw a card first.");
  if (members[Number(state.currentPlayerIndex || 0)]?.uid !== actorUid) throw new Error("It is not your turn.");
  return advanceTurn({ ...state, discardPile: [...(state.discardPile || []), state.drawnCard] }, members);
}

export function reduceGolf(state, actorUid, action, members, rules = {}) {
  if (action.type === "reveal") return revealInitial(state, actorUid, action.indexes, members);
  if (action.type === "draw") return draw(state, actorUid, action.source, members);
  if (action.type === "swap") return swap(state, actorUid, Number(action.index), members);
  if (action.type === "discard-drawn") return discardDrawn(state, actorUid, members);
  if (action.type === "next-hole") {
    if (state.phase !== "hole-end") throw new Error("The current hole is not finished.");
    return { ...dealHole(members, Number(state.holeNumber || 1) + 1, state), holes: Number(rules.holes || state.holes || GOLF_RULES.holes) };
  }
  throw new Error("Unknown Six Card Golf action.");
}

export function chooseGolfRobotMove(state, members) {
  if (state.phase === "reveal") {
    const robot = members.find((member) => member.isRobot && !(state.faceUp?.[member.uid] || []).length);
    return robot ? { uid: robot.uid, action: { type: "reveal", indexes: [0, 1] }, key: `reveal:${state.holeNumber}:${robot.uid}` } : null;
  }
  if (state.phase !== "playing") return null;
  const active = members[Number(state.currentPlayerIndex || 0)]; if (!active?.isRobot) return null;
  if (!state.drawnCard) return { uid: active.uid, action: { type: "draw", source: "stock" }, key: `draw:${state.holeNumber}:${active.uid}:${state.stock?.length || 0}` };
  const grid = state.grids?.[active.uid] || []; const hidden = [0,1,2,3,4,5].filter((index) => !(state.faceUp?.[active.uid] || []).includes(index));
  const target = hidden[0] ?? grid.map((card, index) => ({ index, score: cardScore(card) })).sort((a, b) => b.score - a.score)[0]?.index ?? 0;
  return { uid: active.uid, action: { type: "swap", index: target }, key: `swap:${state.holeNumber}:${active.uid}:${state.drawnCard.id}` };
}
