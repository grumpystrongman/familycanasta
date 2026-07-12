import test from "node:test";
import assert from "node:assert/strict";
import { planGroupedMelds } from "./multiMeldPlanner.js";

const card = (id, rank, suit = "S") => ({ id, rank, suit });

test("groups multiple opening melds and totals every valid meld", () => {
  const selection = [
    card("8s", "8"), card("8d", "8", "D"), card("8h", "8", "H"),
    card("qs", "Q"), card("qc", "Q", "C"), card("2s", "2"),
    card("as", "A"), card("ad", "A", "D"), card("2h", "2", "H"),
  ];

  const plan = planGroupedMelds(selection, [], { maxWildsPerMeld: 3 });

  assert.equal(plan.valid, true);
  assert.equal(plan.totalPoints, 130);
  assert.deepEqual(plan.groups.map((group) => [group.rank, group.points]), [
    ["8", 30],
    ["Q", 40],
    ["A", 60],
  ]);
});

test("assigns each wild to the nearest selected natural rank", () => {
  const selection = [
    card("8s", "8"), card("8d", "8"), card("8h", "8"),
    card("qs", "Q"), card("qc", "Q", "C"), card("2s", "2"),
    card("as", "A"), card("ad", "A", "D"), card("2h", "2", "H"),
  ];

  const plan = planGroupedMelds(selection);
  const queens = plan.groups.find((group) => group.rank === "Q");
  const aces = plan.groups.find((group) => group.rank === "A");

  assert.equal(queens.cards.some((item) => item.id === "2s"), true);
  assert.equal(aces.cards.some((item) => item.id === "2h"), true);
});

test("reports an error on the individual invalid meld", () => {
  const selection = [
    card("8s", "8"), card("8d", "8"), card("8h", "8"),
    card("qs", "Q"), card("2s", "2"),
  ];

  const plan = planGroupedMelds(selection);
  const eights = plan.groups.find((group) => group.rank === "8");
  const queens = plan.groups.find((group) => group.rank === "Q");

  assert.equal(plan.valid, false);
  assert.equal(eights.error, "");
  assert.match(queens.error, /needs at least three cards|more natural cards than wild cards/);
  assert.equal(plan.totalPoints, 30);
});

test("allows fewer than three selected cards when adding to an existing meld", () => {
  const board = [{ rank: "Q", cards: [card("q1", "Q"), card("q2", "Q"), card("q3", "Q")] }];
  const plan = planGroupedMelds([card("q4", "Q")], board);

  assert.equal(plan.valid, true);
  assert.equal(plan.groups[0].points, 10);
});

test("accepts sixes, nines, and jacks with a nearby wild as separate melds", () => {
  const selection = [
    card("6s", "6"), card("6d", "6", "D"), card("6h", "6", "H"),
    card("9s", "9"), card("9d", "9", "D"), card("9h", "9", "H"),
    card("js", "J"), card("jd", "J", "D"), card("2s", "2"),
  ];

  const plan = planGroupedMelds(selection);

  assert.equal(plan.valid, true);
  assert.equal(plan.totalPoints, 85);
  assert.deepEqual(plan.groups.map((group) => [group.rank, group.points]), [
    ["6", 15],
    ["9", 30],
    ["J", 40],
  ]);
});
