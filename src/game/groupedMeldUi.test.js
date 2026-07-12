import test from "node:test";
import assert from "node:assert/strict";
import { groupedMeldUiState, naturalMeldRanks } from "./groupedMeldUi.js";

const card = (id, rank, suit = "S") => ({ id, rank, suit });

const groupedCards = [
  card("6s-1", "6"), card("6d", "6", "D"), card("6h", "6", "H"),
  card("9s", "9"), card("9d", "9", "D"), card("9h", "9", "H"),
  card("js", "J"), card("jd", "J", "D"), card("2s", "2"),
];

const groupedPlan = {
  valid: true,
  totalPoints: 85,
  groups: [
    { rank: "6", cards: groupedCards.slice(0, 3), points: 15, error: "" },
    { rank: "9", cards: groupedCards.slice(3, 6), points: 30, error: "" },
    { rank: "J", cards: groupedCards.slice(6), points: 40, error: "" },
  ],
};

test("recognizes several natural ranks as a grouped play", () => {
  assert.deepEqual(naturalMeldRanks(groupedCards), ["6", "9", "J"]);
});

test("explains exactly what is missing from a 90-point opening", () => {
  const state = groupedMeldUiState({
    cards: groupedCards,
    plan: groupedPlan,
    openingNeed: 90,
  });

  assert.equal(state.grouped, true);
  assert.equal(state.canCommit, false);
  assert.equal(state.remaining, 5);
  assert.equal(state.buttonText, "Need 5 more · 85/90 pts");
  assert.match(state.statusText, /Add 5 more points/);
});

test("enables one atomic grouped opening when the combined total is enough", () => {
  const state = groupedMeldUiState({
    cards: groupedCards,
    plan: { ...groupedPlan, totalPoints: 125 },
    openingNeed: 120,
  });

  assert.equal(state.canCommit, true);
  assert.equal(state.remaining, 0);
  assert.equal(state.buttonText, "Open with 3 melds together · 125 pts");
});

test("keeps incomplete rank groups from being committed", () => {
  const state = groupedMeldUiState({
    cards: groupedCards,
    plan: { ...groupedPlan, valid: false },
    openingNeed: 90,
  });

  assert.equal(state.canCommit, false);
  assert.equal(state.buttonText, "Fix incomplete melds");
  assert.match(state.statusText, /at least three cards/);
});
