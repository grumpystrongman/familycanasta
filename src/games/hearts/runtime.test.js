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

test("Hearts rotates passing left, right, across, then hold", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(engine.passDirection), ["left", "right", "across", "hold", "left"]);
  assert.equal(engine.passRecipientIndex(0, "left"), 1);
  assert.equal(engine.passRecipientIndex(0, "right"), 3);
  assert.equal(engine.passRecipientIndex(1, "across"), 3);
});

test("Hearts follows suit and prevents an unbroken heart lead", () => {
  const followState = {
    phase: "playing",
    currentPlayerIndex: 0,
    completedTricks: 2,
    heartsBroken: false,
    currentTrick: [{ uid: "d", card: card("10", "clubs") }],
    hands: { a: [card("5", "clubs"), card("A", "hearts")] },
  };
  assert.deepEqual(engine.legalHeartsCards(followState, "a", members).map((value) => value.id), ["5-clubs"]);

  const leadState = { ...followState, currentTrick: [], hands: { a: [card("5", "hearts"), card("7", "diamonds")] } };
  assert.deepEqual(engine.legalHeartsCards(leadState, "a", members).map((value) => value.id), ["7-diamonds"]);
});

test("Hearts blocks first-trick penalty dumps when a safe card exists", () => {
  const state = {
    phase: "playing",
    currentPlayerIndex: 0,
    completedTricks: 0,
    heartsBroken: false,
    currentTrick: [{ uid: "d", card: card("2", "clubs") }],
    hands: { a: [card("Q", "spades"), card("4", "hearts"), card("9", "diamonds")] },
  };
  assert.deepEqual(engine.legalHeartsCards(state, "a", members).map((value) => value.id), ["9-diamonds"]);
});

test("Hearts trick winner is the highest card of the led suit", () => {
  const trick = [
    { uid: "a", card: card("8", "clubs") },
    { uid: "b", card: card("K", "clubs") },
    { uid: "c", card: card("A", "spades") },
    { uid: "d", card: card("Q", "clubs") },
  ];
  assert.equal(engine.trickWinnerIndex(trick, members), 1);
});

test("Hearts scores a complete moon shot as 26 points to every opponent", () => {
  const hearts = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"].map((rank) => card(rank, "hearts", `heart-${rank}`));
  const result = engine.heartsRoundScore({ a: [...hearts, card("Q", "spades", "queen-spades")], b: [], c: [], d: [] }, members.map((member) => member.uid));
  assert.equal(result.shooterUid, "a");
  assert.deepEqual(result.points, { a: 0, b: 26, c: 26, d: 26 });
});
