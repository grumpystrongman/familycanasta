import test from "node:test";
import assert from "node:assert/strict";
import { blackThreeGoOutPlan } from "./blackThreeGoOutRules.js";

const blackThree = (id, suit = "S") => ({ id, rank: "3", suit, color: "black" });
const card = (id, rank = "K", suit = "H") => ({ id, rank, suit, color: suit === "H" || suit === "D" ? "red" : "black" });

test("allows three natural black threes to empty the hand", () => {
  const hand = [blackThree("a"), blackThree("b", "C"), blackThree("c")];
  const plan = blackThreeGoOutPlan(hand, hand, true);
  assert.equal(plan.ok, true);
  assert.equal(plan.finalDiscard, null);
});

test("allows four natural black threes with one automatic final discard", () => {
  const threes = [blackThree("a"), blackThree("b", "C"), blackThree("c"), blackThree("d", "C")];
  const finalDiscard = card("e", "K", "H");
  const plan = blackThreeGoOutPlan([...threes, finalDiscard], threes, true);
  assert.equal(plan.ok, true);
  assert.equal(plan.finalDiscard.id, "e");
});

test("rejects wild cards and mixed selections", () => {
  const hand = [blackThree("a"), blackThree("b", "C"), card("wild", "2", "S")];
  const plan = blackThreeGoOutPlan(hand, hand, true);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /only black threes/i);
});

test("rejects the meld when more than one card would remain", () => {
  const threes = [blackThree("a"), blackThree("b", "C"), blackThree("c")];
  const plan = blackThreeGoOutPlan([...threes, card("d"), card("e", "Q")], threes, true);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /at most one final discard/i);
});

test("requires the team to have completed its opening", () => {
  const hand = [blackThree("a"), blackThree("b", "C"), blackThree("c")];
  const plan = blackThreeGoOutPlan(hand, hand, false);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /opening/i);
});
