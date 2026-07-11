import test from "node:test";
import assert from "node:assert/strict";
import { planDiscardPickup, validatePendingPickupSelection } from "./discardPickupPlanner.js";

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

function roomWith({ hand, pile, board = [], opened = false, frozen = true, requirement = 50 }) {
  return {
    rules: { maxWildsPerMeld: 3 },
    privateHands: { player: hand },
    publicState: {
      discardPile: pile,
      discardFrozen: frozen,
      teamBoards: { 0: board },
      opened: { 0: opened },
      openingRequirements: { 0: requirement },
      teamScores: { 0: 0 },
    },
  };
}

const player = { uid: "player", team: 0 };

test("rejects a safe discard when the matching book is complete", () => {
  const queens = Array.from({ length: 7 }, (_, index) => card(`q${index}`, "Q"));
  const room = roomWith({
    hand: [card("q8", "Q"), card("q9", "Q")],
    pile: [card("top", "Q", "H")],
    board: [{ rank: "Q", cards: queens }],
    opened: true,
    frozen: false,
  });

  assert.throws(() => planDiscardPickup(room, player), /completed book|safe discard/i);
});

test("puts an unopened pickup into pending state instead of auto-playing the hand", () => {
  const hand = [
    card("q1", "Q"),
    card("q2", "Q", "C"),
    card("a1", "A"),
    card("a2", "A", "D"),
    card("a3", "A", "H"),
  ];
  const pile = [card("lower", "5"), card("top", "Q", "H")];
  const room = roomWith({ hand, pile, requirement: 90 });

  const plan = planDiscardPickup(room, player);

  assert.equal(plan.mode, "pending-opening");
  assert.equal(plan.top.id, "top");
  assert.deepEqual(plan.pile.map((item) => item.id), ["lower", "top"]);
  assert.deepEqual(plan.matchingNaturalIds.sort(), ["q1", "q2"]);
  assert.equal(plan.requiredNaturalCount, 2);
  assert.ok(plan.availablePoints >= 90);
  assert.equal("forcedCards" in plan, false);
});

test("an opened frozen pickup forces only two natural matches", () => {
  const hand = [card("q1", "Q"), card("q2", "Q", "C"), card("q3", "Q", "D")];
  const room = roomWith({
    hand,
    pile: [card("lower", "4"), card("top", "Q", "H")],
    opened: true,
    frozen: true,
  });

  const plan = planDiscardPickup(room, player);

  assert.equal(plan.mode, "immediate");
  assert.deepEqual(plan.forcedCards.map((item) => item.id), ["top", "q1", "q2"]);
  assert.deepEqual(plan.usedNaturalIds, ["q1", "q2"]);
  assert.equal(plan.usedNaturalIds.includes("q3"), false);
  assert.deepEqual(plan.lowerPile.map((item) => item.id), ["lower"]);
});

test("pending pickup validation requires the top card and two original matches", () => {
  const pending = {
    rank: "Q",
    topCardId: "top",
    matchingNaturalIds: ["q1", "q2", "q3"],
    requiredNaturalCount: 2,
  };

  assert.match(
    validatePendingPickupSelection(pending, [card("q1", "Q"), card("q2", "Q")]),
    /picked-up Q/i,
  );
  assert.match(
    validatePendingPickupSelection(pending, [card("top", "Q"), card("q1", "Q")]),
    /two natural Qs/i,
  );
  assert.equal(
    validatePendingPickupSelection(pending, [card("top", "Q"), card("q1", "Q"), card("q3", "Q")]),
    "",
  );
});
