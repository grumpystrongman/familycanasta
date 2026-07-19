import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDiscardFreezeState,
  discardFreezesPile,
  shouldRepairBlackThreeFreeze,
} from "./discardFreezeRules.js";

const card = (rank, color = "black") => ({ id: `${rank}-${color}`, rank, suit: "S", color });

test("the opening discard pile stays frozen even when a black three is on top", () => {
  const room = {
    publicState: {
      discardPile: [card("3", "black")],
      discardFrozen: true,
      discardFreezeReason: "opening",
      discardPileHasBeenTaken: false,
    },
  };

  assert.equal(shouldRepairBlackThreeFreeze(room), false);
  assert.equal(room.publicState.discardFrozen, true);
});

test("an old black-three freeze is repaired only after the pile has been picked up", () => {
  const room = {
    publicState: {
      discardPile: [card("3", "black")],
      discardFrozen: true,
      discardFreezeReason: null,
      discardPileHasBeenTaken: true,
    },
  };

  assert.equal(shouldRepairBlackThreeFreeze(room), true);
});

test("a valid wild-card freeze is never repaired", () => {
  const room = {
    publicState: {
      discardPile: [card("3", "black")],
      discardFrozen: true,
      discardFreezeReason: "wild",
      discardPileHasBeenTaken: true,
    },
  };

  assert.equal(shouldRepairBlackThreeFreeze(room), false);
});

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

test("an ordinary card covering a wild card does not thaw the pile", () => {
  const state = {
    discardFrozen: true,
    discardFreezeReason: "wild",
    discardPileHasBeenTaken: true,
  };

  assert.equal(applyDiscardFreezeState(state, card("10")), false);
  assert.equal(state.discardFrozen, true);
  assert.equal(state.discardFreezeReason, "wild");
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
