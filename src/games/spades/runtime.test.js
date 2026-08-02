import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

async function loadEngine() {
  const source = readFileSync(new URL("./engine.js", import.meta.url), "utf8")
    .replace('"../../platform/StandardCard"', JSON.stringify(new URL("../../platform/standardDeck.js", import.meta.url).href));
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const engine = await loadEngine();
const members = ["a", "b", "c", "d"].map((uid, seat) => ({ uid, seat, nickname: uid.toUpperCase() }));
const values = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14 };
const card = (rank, suit, id = `${rank}-${suit}`) => ({ id, rank, suit, value: values[rank], color: ["hearts", "diamonds"].includes(suit) ? "red" : "black" });

test("Spades cannot be led before breaking when another suit is available", () => {
  const state = {
    phase: "playing",
    currentPlayerIndex: 0,
    spadesBroken: false,
    currentTrick: [],
    hands: { a: [card("A", "spades"), card("4", "clubs")] },
  };
  assert.deepEqual(engine.legalSpadesCards(state, "a", members).map((value) => value.id), ["4-clubs"]);
});

test("Spades requires following suit", () => {
  const state = {
    phase: "playing",
    currentPlayerIndex: 0,
    spadesBroken: true,
    currentTrick: [{ uid: "d", card: card("7", "hearts") }],
    hands: { a: [card("3", "hearts"), card("A", "spades")] },
  };
  assert.deepEqual(engine.legalSpadesCards(state, "a", members).map((value) => value.id), ["3-hearts"]);
});

test("a spade trumps every card of the led suit", () => {
  const trick = [
    { uid: "a", card: card("A", "clubs") },
    { uid: "b", card: card("2", "spades") },
    { uid: "c", card: card("K", "clubs") },
    { uid: "d", card: card("Q", "spades") },
  ];
  assert.equal(engine.spadesTrickWinnerIndex(trick, members), 3);
});

test("Spades scores contracts, overtricks, and a successful nil", () => {
  const scored = engine.scoreSpadesRound({
    bids: { a: 3, b: 0, c: 2, d: 4 },
    playerTricks: { a: 3, b: 0, c: 3, d: 4 },
    teamBags: { 0: 0, 1: 0 },
  }, members);
  assert.deepEqual(scored.roundScore, { 0: 51, 1: 140 });
  assert.deepEqual(scored.teamBags, { 0: 1, 1: 0 });
});

test("ten bags apply a 100 point sandbag penalty and retain remainder", () => {
  const scored = engine.scoreSpadesRound({
    bids: { a: 2, b: 3, c: 2, d: 3 },
    playerTricks: { a: 3, b: 3, c: 2, d: 3 },
    teamBags: { 0: 9, 1: 0 },
  }, members);
  assert.equal(scored.roundScore[0], -59);
  assert.equal(scored.teamBags[0], 0);
});
