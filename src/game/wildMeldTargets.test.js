import test from "node:test";
import assert from "node:assert/strict";
import { wildMeldTargetOptions, wildMeldTargetState } from "./wildMeldTargets.js";

const card = (id, rank) => ({ id, rank, suit: rank === "JOKER" ? "J" : "S" });

test("blocks a second wild card when a meld only has two natural cards", () => {
  const state = wildMeldTargetState({
    rank: "Q",
    cards: [card("q1", "Q"), card("q2", "Q"), card("w1", "JOKER")],
  }, 1, { maxWildsPerMeld: 3 });

  assert.equal(state.legal, false);
  assert.equal(state.naturalCount, 2);
  assert.equal(state.totalWildCount, 2);
  assert.match(state.reason, /Add 1 more natural Q/);
});

test("allows a wild card when natural cards still outnumber wild cards", () => {
  const state = wildMeldTargetState({
    rank: "8",
    cards: [card("8a", "8"), card("8b", "8"), card("8c", "8"), card("w1", "2")],
  }, 1, { maxWildsPerMeld: 3 });

  assert.equal(state.legal, true);
  assert.equal(state.naturalCount, 3);
  assert.equal(state.totalWildCount, 2);
  assert.equal(state.reason, "");
});

test("blocks a target that would exceed the configured wild-card limit", () => {
  const state = wildMeldTargetState({
    rank: "K",
    cards: [
      card("k1", "K"), card("k2", "K"), card("k3", "K"), card("k4", "K"),
      card("w1", "2"), card("w2", "JOKER"), card("w3", "2"),
    ],
  }, 1, { maxWildsPerMeld: 3 });

  assert.equal(state.legal, false);
  assert.match(state.reason, /limit is 3/);
});

test("returns a status for every available board meld", () => {
  const options = wildMeldTargetOptions([
    { rank: "Q", cards: [card("q1", "Q"), card("q2", "Q"), card("w1", "JOKER")] },
    { rank: "9", cards: [card("9a", "9"), card("9b", "9"), card("9c", "9")] },
  ], 1, { maxWildsPerMeld: 3 });

  assert.deepEqual(options.map(({ rank, legal }) => ({ rank, legal })), [
    { rank: "Q", legal: false },
    { rank: "9", legal: true },
  ]);
});
