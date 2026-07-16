import test from "node:test";
import assert from "node:assert/strict";
import { applyDiscardFreezeState, discardFreezesPile } from "./discardFreezeRules.js";

const card = (rank, color = "black") => ({ id: `${rank}-${color}`, rank, suit: "S", color });

test("a picked-up pile stays unfrozen after an ordinary discard", () => {
  const state = {
    discardFrozen: false,
    discardFreezeReason: null,
    discardPileHasBeenTaken: true,
  };

  assert.equal(applyDiscardFreezeState(state, card("Q")), false);
  assert.equal(state.discardFrozen, false);
  assert.equal(state.discardFreezeReason, null);
});

test("a black three does not refreeze a pile that was picked up", () => {
  const state = {
    discardFrozen: false,
    discardFreezeReason: null,
    discardPileHasBeenTaken: true,
  };

  assert.equal(applyDiscardFreezeState(state, card("3", "black"), { freezeOnBlackThree: true }), false);
  assert.equal(state.discardFrozen, false);
  assert.equal(state.discardFreezeReason, null);
});

test("a two or Joker freezes the pile after pickup", () => {
  for (const wild of [card("2"), card("JOKER")]) {
    const state = {
      discardFrozen: false,
      discardFreezeReason: null,
      discardPileHasBeenTaken: true,
    };

    assert.equal(applyDiscardFreezeState(state, wild), true);
    assert.equal(state.discardFrozen, true);
    assert.equal(state.discardFreezeReason, "wild");
  }
});

test("the wild freeze rule can still be disabled explicitly", () => {
  assert.equal(discardFreezesPile(card("2"), { freezeOnWild: false }), false);
});
