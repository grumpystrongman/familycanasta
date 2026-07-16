import test from "node:test";
import assert from "node:assert/strict";
import { planDiscardPickup } from "./discardPickupPlanner.js";

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

function roomWith(hand) {
  return {
    rules: { maxWildsPerMeld: 3, discardPickupRule: "classic" },
    privateHands: { player: hand },
    publicState: {
      discardPile: [card("lower", "5"), card("top", "Q", "H")],
      discardFrozen: true,
      teamBoards: {
        0: [{ rank: "Q", cards: [card("board-q1", "Q"), card("board-q2", "Q", "C"), card("board-q3", "Q", "D")] }],
      },
      opened: { 0: true },
      openingRequirements: { 0: 50 },
      teamScores: { 0: 0 },
    },
  };
}

const player = { uid: "player", team: 0 };

test("a frozen pile cannot be claimed solely by a matching board meld", () => {
  const room = roomWith([card("spare", "6"), card("other", "7")]);

  assert.throws(
    () => planDiscardPickup(room, player),
    /frozen.*two natural.*even when that rank is already melded/i,
  );
});

test("a frozen pile rejects one matching natural plus one wild even with a board meld", () => {
  const room = roomWith([card("q4", "Q"), card("wild", "2"), card("spare", "6")]);

  assert.throws(() => planDiscardPickup(room, player), /frozen.*two natural/i);
});

test("a frozen pile with a board meld still requires and consumes two natural matches", () => {
  const room = roomWith([card("q4", "Q"), card("q5", "Q", "C"), card("spare", "6")]);

  const plan = planDiscardPickup(room, player);

  assert.equal(plan.pickupMethod, "two-naturals");
  assert.deepEqual(plan.usedHandCardIds, ["q4", "q5"]);
  assert.deepEqual(plan.forcedCards.map((item) => item.id), ["top", "q4", "q5"]);
  assert.equal(plan.existing.rank, "Q");
  assert.deepEqual(plan.lowerPile.map((item) => item.id), ["lower"]);
});
