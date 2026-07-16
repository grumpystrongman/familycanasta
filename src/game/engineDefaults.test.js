import test from "node:test";
import assert from "node:assert/strict";
import { planDiscardPickup } from "./discardPickupPlanner.js";

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

test("legacy rooms without a pickup setting use classic Canasta", () => {
  const room = {
    rules: { maxWildsPerMeld: 3 },
    privateHands: {
      player: [card("q1", "Q"), card("wild", "2"), card("spare", "6")],
    },
    publicState: {
      discardPile: [card("lower", "4"), card("top", "Q", "H")],
      discardFrozen: false,
      teamBoards: { 0: [] },
      opened: { 0: true },
      openingRequirements: { 0: 50 },
      teamScores: { 0: 0 },
    },
  };

  const plan = planDiscardPickup(room, { uid: "player", team: 0 });
  assert.equal(plan.pickupRule, "classic");
  assert.deepEqual(plan.usedHandCardIds, ["q1", "wild"]);
});
