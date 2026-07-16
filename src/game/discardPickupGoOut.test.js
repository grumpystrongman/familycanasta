import test from "node:test";
import assert from "node:assert/strict";
import { planDiscardPickup } from "./discardPickupPlanner.js";

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

const player = { uid: "player", team: 0 };

function room({ hand, pile, board = [], frozen = false }) {
  return {
    rules: { discardPickupRule: "classic", maxWildsPerMeld: 3, canastasToGoOut: 1 },
    privateHands: { player: hand },
    publicState: {
      discardPile: pile,
      discardFrozen: frozen,
      teamBoards: { 0: board },
      opened: { 0: true },
      openingRequirements: { 0: 50 },
      teamScores: { 0: 0 },
    },
  };
}

test("rejects an immediate pickup that would leave no card for the discard before a canasta", () => {
  const state = room({
    hand: [card("q1", "Q"), card("q2", "Q")],
    pile: [card("top", "Q", "H")],
  });

  assert.throws(() => planDiscardPickup(state, player), /leave too few cards|keep one card/i);
});

test("allows the same pickup when it completes a canasta", () => {
  const state = room({
    hand: [card("q1", "Q"), card("q2", "Q")],
    pile: [card("top", "Q", "H")],
    board: [{
      rank: "Q",
      cards: [card("b1", "Q"), card("b2", "Q"), card("b3", "Q"), card("b4", "Q")],
    }],
    frozen: true,
  });

  const plan = planDiscardPickup(state, player);
  assert.equal(plan.mode, "immediate");
  assert.equal(plan.forcedCards.length, 3);
});
