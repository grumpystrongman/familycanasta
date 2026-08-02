import assert from "node:assert/strict";
import test from "node:test";
import {
  canLayOff,
  cardsPerPlayer,
  classifyMeld,
  reduceRummy,
  rummyCardPoints,
} from "./engine.js";

const values = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14 };
const card = (rank, suit, id = `${rank}-${suit}`) => ({ id, rank, suit, value: values[rank], color: ["hearts", "diamonds"].includes(suit) ? "red" : "black" });
const members = [
  { uid: "a", seat: 0, nickname: "A" },
  { uid: "b", seat: 1, nickname: "B" },
];

test("Rummy deals the standard hand size for each supported player count", () => {
  assert.equal(cardsPerPlayer(2), 10);
  assert.equal(cardsPerPlayer(3), 7);
  assert.equal(cardsPerPlayer(4), 7);
  assert.equal(cardsPerPlayer(5), 6);
  assert.equal(cardsPerPlayer(6), 6);
});

test("Rummy accepts three- and four-card sets but rejects five cards", () => {
  const set = [card("8", "clubs"), card("8", "diamonds"), card("8", "hearts")];
  assert.equal(classifyMeld(set)?.type, "set");
  assert.equal(classifyMeld([...set, card("8", "spades")])?.type, "set");
  assert.equal(classifyMeld([...set, card("8", "spades"), { ...card("8", "clubs"), id: "extra-eight" }]), null);
});

test("Rummy uses ace low only for runs", () => {
  assert.equal(classifyMeld([card("A", "hearts"), card("2", "hearts"), card("3", "hearts")])?.type, "run");
  assert.equal(classifyMeld([card("Q", "hearts"), card("K", "hearts"), card("A", "hearts")]), null);
  assert.equal(classifyMeld([card("K", "hearts"), card("A", "hearts"), card("2", "hearts")]), null);
});

test("Rummy layoffs must preserve the original meld type", () => {
  const set = { type: "set", cards: [card("5", "clubs"), card("5", "diamonds"), card("5", "hearts")] };
  assert.equal(canLayOff(set, [card("5", "spades")]), true);
  assert.equal(canLayOff(set, [card("6", "spades")]), false);
  const run = { type: "run", cards: [card("3", "clubs"), card("4", "clubs"), card("5", "clubs")] };
  assert.equal(canLayOff(run, [card("2", "clubs")]), true);
  assert.equal(canLayOff(run, [card("6", "diamonds")]), false);
});

test("a Rummy turn draws before allowing action", () => {
  const state = {
    phase: "playing",
    turnPhase: "draw",
    currentPlayerIndex: 0,
    roundNumber: 1,
    hands: { a: [card("2", "clubs")], b: [card("K", "clubs")] },
    stock: [card("7", "spades")],
    discardPile: [card("9", "diamonds")],
    melds: [],
    hasMelded: { a: false, b: false },
    scores: { a: 0, b: 0 },
    targetScore: 100,
  };
  const drawn = reduceRummy(state, "a", { type: "draw", source: "discard" }, members);
  assert.equal(drawn.turnPhase, "action");
  assert.equal(drawn.discardPile.length, 0);
  assert.equal(drawn.hands.a.some((value) => value.id === "9-diamonds"), true);
  assert.throws(() => reduceRummy(state, "a", { type: "discard", cardId: "2-clubs" }, members), /draw before playing/i);
});

test("going out scores every opponent deadwood card", () => {
  const winningCards = [card("4", "clubs"), card("4", "diamonds"), card("4", "hearts")];
  const state = {
    phase: "playing",
    turnPhase: "action",
    currentPlayerIndex: 0,
    roundNumber: 1,
    hands: { a: winningCards, b: [card("A", "clubs"), card("K", "clubs"), card("7", "diamonds")] },
    stock: [],
    discardPile: [card("2", "spades")],
    melds: [],
    hasMelded: { a: false, b: false },
    scores: { a: 0, b: 0 },
    roundPoints: { a: 0, b: 0 },
    targetScore: 100,
  };
  const result = reduceRummy(state, "a", { type: "meld", cardIds: winningCards.map((value) => value.id) }, members);
  assert.equal(result.phase, "round-end");
  assert.equal(result.roundPoints.a, 18);
  assert.equal(result.scores.a, 18);
  assert.equal(rummyCardPoints(card("A", "clubs")), 1);
  assert.equal(rummyCardPoints(card("K", "clubs")), 10);
});
