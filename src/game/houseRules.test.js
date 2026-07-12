import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_HOUSE_RULES,
  countCanastas,
  goOutRequirementStatus,
  normalizeHouseRules,
  validateDrawAction,
  validateGoOutAction,
  validateMeldAction,
  variantProfile,
} from "./houseRules.js";

const card = (id, rank) => ({ id, rank, suit: "S", color: "black" });
const wild = (id = "w") => card(id, "2");

function roomWith(houseRules, patch = {}) {
  return {
    activeRules: normalizeHouseRules(houseRules),
    stock: Array.from({ length: 20 }, (_, index) => card(`s${index}`, "4")),
    privateHands: { p1: [] },
    publicState: { discardPile: [], teamBoards: { 0: [] } },
    ...patch,
  };
}

const player = { uid: "p1", team: 0 };

test("normalizes invalid values to safe defaults", () => {
  const rules = normalizeHouseRules({
    drawAndDiscard: { drawCount: 99, discardTakeLimit: 12 },
    deckVariation: { variant: "Unknown" },
  });
  assert.equal(rules.drawAndDiscard.drawCount, 2);
  assert.equal(rules.drawAndDiscard.discardTakeLimit, "entirePack");
  assert.equal(rules.deckVariation.variant, "Classic");
});

test("draw validator enforces configured stock count", () => {
  const room = roomWith({
    ...DEFAULT_HOUSE_RULES,
    drawAndDiscard: { ...DEFAULT_HOUSE_RULES.drawAndDiscard, drawCount: 1 },
  });
  assert.equal(validateDrawAction(room, player, "stock").drawCount, 1);
});

test("discard pickup requires a natural pair when enabled", () => {
  const room = roomWith(DEFAULT_HOUSE_RULES, {
    privateHands: { p1: [card("a", "K")] },
    publicState: { discardPile: [card("top", "K")], teamBoards: { 0: [] } },
  });
  assert.throws(() => validateDrawAction(room, player, "discardPile"), /Two natural Ks/);
});

test("discard pickup respects the seven-card limit", () => {
  const pile = Array.from({ length: 12 }, (_, index) => card(`d${index}`, index === 11 ? "K" : "4"));
  const room = roomWith({
    ...DEFAULT_HOUSE_RULES,
    drawAndDiscard: {
      drawCount: 2,
      discardTakeLimit: 7,
      requiresNaturalPairForPack: true,
    },
  }, {
    privateHands: { p1: [card("k1", "K"), card("k2", "K")] },
    publicState: { discardPile: pile, teamBoards: { 0: [] } },
  });
  assert.equal(validateDrawAction(room, player, "discardPile").discardTakeCount, 7);
});

test("Rule of Five rejects early wild cards", () => {
  const room = roomWith({
    ...DEFAULT_HOUSE_RULES,
    meldConstraints: { ruleOfFiveActive: true, pureSevensMandatory: false, pureAcesRule: false },
  });
  assert.throws(
    () => validateMeldAction(room, null, [card("a", "8"), card("b", "8"), wild()]),
    /Rule of Five/,
  );
});

test("pure sevens and pure aces reject wild cards", () => {
  const room = roomWith({
    ...DEFAULT_HOUSE_RULES,
    meldConstraints: { ruleOfFiveActive: false, pureSevensMandatory: true, pureAcesRule: true },
  });
  assert.throws(() => validateMeldAction(room, null, [card("7a", "7"), card("7b", "7"), wild()]), /Seven melds/);
  assert.throws(() => validateMeldAction(room, null, [card("aa", "A"), card("ab", "A"), wild()]), /Ace melds/);
});

test("canasta counting distinguishes clean, dirty, and wild", () => {
  const seven = (rank, prefix) => Array.from({ length: 7 }, (_, index) => card(`${prefix}${index}`, rank));
  const counts = countCanastas([
    { rank: "4", cards: seven("4", "c") },
    { rank: "5", cards: [...seven("5", "d").slice(0, 6), wild("dw")] },
    { rank: "2", cards: Array.from({ length: 7 }, (_, index) => wild(`w${index}`)) },
  ]);
  assert.deepEqual(counts, { clean: 1, dirty: 1, wild: 1 });
});

test("go-out status safely handles an unloaded room", () => {
  const status = goOutRequirementStatus(null, 0);

  assert.equal(status.eligible, false);
  assert.deepEqual(status.actual, {
    clean: 0,
    dirty: 0,
    wild: 0,
  });
  assert.equal(status.totalMissing, 1);
});

test("go out validator enforces canasta mix and final discard rule", () => {
  const rules = {
    ...DEFAULT_HOUSE_RULES,
    winConditions: {
      canastasRequiredToGoOut: { clean: 1, dirty: 0, wild: 0 },
      allowFinalDiscardToGoOut: false,
    },
  };
  const clean = Array.from({ length: 7 }, (_, index) => card(`c${index}`, "9"));
  const room = roomWith(rules, {
    publicState: { discardPile: [], teamBoards: { 0: [{ rank: "9", cards: clean }] } },
  });
  assert.equal(validateGoOutAction(room, player, "meld"), true);
  assert.throws(() => validateGoOutAction(room, player, "discard"), /final discard is disabled/);
});

test("variant profiles define foot and knee piles", () => {
  assert.deepEqual(variantProfile("Classic").sequence, ["hand"]);
  assert.deepEqual(variantProfile("HandAndFoot").sequence, ["hand", "foot"]);
  assert.deepEqual(variantProfile("TriplePlay").sequence, ["hand", "foot", "knee"]);
});


test("default go-out rules accept any completed canasta and honor the total requirement", () => {
  const clean = (prefix, rank) => ({
    rank,
    cards: Array.from({ length: 7 }, (_, index) => card(`${prefix}${index}`, rank)),
  });
  const room = roomWith(DEFAULT_HOUSE_RULES, {
    rules: { canastasToGoOut: 2 },
    publicState: {
      discardPile: [],
      teamBoards: { 0: [clean("a", "8"), clean("b", "9")] },
    },
  });

  const status = goOutRequirementStatus(room, 0);
  assert.equal(status.eligible, true);
  assert.equal(status.totalActual, 2);
  assert.equal(validateGoOutAction(room, player, "discard"), true);
});
