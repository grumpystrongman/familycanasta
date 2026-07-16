import test from "node:test";
import assert from "node:assert/strict";
import {
  planDiscardPickup,
  stockExhaustionPickupStatus,
  validatePendingPickupSelection,
} from "./discardPickupPlanner.js";

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

function roomWith({
  hand,
  pile,
  board = [],
  opened = false,
  frozen = true,
  requirement = 50,
  pickupRule = "classic",
}) {
  return {
    rules: { maxWildsPerMeld: 3, discardPickupRule: pickupRule },
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

test("classic unfrozen pickup adds the top card to an existing completed canasta", () => {
  const queens = Array.from({ length: 7 }, (_, index) => card(`q${index}`, "Q"));
  const room = roomWith({
    hand: [card("spare", "6"), card("other", "7")],
    pile: [card("lower", "4"), card("top", "Q", "H")],
    board: [{ rank: "Q", cards: queens }],
    opened: true,
    frozen: false,
    pickupRule: "classic",
  });

  const plan = planDiscardPickup(room, player);

  assert.equal(plan.mode, "immediate");
  assert.equal(plan.pickupMethod, "existing-meld");
  assert.equal(plan.existing.rank, "Q");
  assert.deepEqual(plan.forcedCards.map((item) => item.id), ["top"]);
  assert.deepEqual(plan.usedHandCardIds, []);
  assert.deepEqual(plan.lowerPile.map((item) => item.id), ["lower"]);
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
  assert.deepEqual(plan.requiredSupportCardIds.sort(), ["q1", "q2"]);
  assert.equal(plan.requiredNaturalCount, 2);
  assert.equal(plan.pickupMethod, "two-naturals");
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
  assert.equal(plan.pickupMethod, "two-naturals");
  assert.deepEqual(plan.forcedCards.map((item) => item.id), ["top", "q1", "q2"]);
  assert.deepEqual(plan.usedHandCardIds, ["q1", "q2"]);
  assert.equal(plan.usedHandCardIds.includes("q3"), false);
  assert.deepEqual(plan.lowerPile.map((item) => item.id), ["lower"]);
});

test("classic unfrozen pickup permits one natural match plus one wild card", () => {
  const room = roomWith({
    hand: [card("q1", "Q"), card("wild", "2"), card("spare", "6")],
    pile: [card("lower", "4"), card("top", "Q", "H")],
    opened: true,
    frozen: false,
    pickupRule: "classic",
  });

  const plan = planDiscardPickup(room, player);

  assert.equal(plan.pickupRule, "classic");
  assert.equal(plan.pickupMethod, "natural-wild");
  assert.equal(plan.supportDescription, "one natural Q and one wild card");
  assert.deepEqual(plan.forcedCards.map((item) => item.id), ["top", "q1", "wild"]);
  assert.deepEqual(plan.usedHandCardIds, ["q1", "wild"]);
});

test("classic unfrozen pickup permits two matching natural cards when no board meld exists", () => {
  const room = roomWith({
    hand: [card("q1", "Q"), card("q2", "Q", "C"), card("spare", "6")],
    pile: [card("lower", "4"), card("top", "Q", "H")],
    opened: true,
    frozen: false,
    pickupRule: "classic",
  });

  const plan = planDiscardPickup(room, player);

  assert.equal(plan.pickupMethod, "two-naturals");
  assert.deepEqual(plan.forcedCards.map((item) => item.id), ["top", "q1", "q2"]);
  assert.deepEqual(plan.usedHandCardIds, ["q1", "q2"]);
});

test("classic unfrozen pickup permits a matching natural plus a Joker before opening", () => {
  const room = roomWith({
    hand: [
      card("q1", "Q"),
      card("joker", "JOKER", "J"),
      card("spare", "6"),
    ],
    pile: [card("lower", "4"), card("top", "Q", "H")],
    opened: false,
    frozen: false,
    requirement: 50,
    pickupRule: "classic",
  });

  const plan = planDiscardPickup(room, player);

  assert.equal(plan.mode, "pending-opening");
  assert.equal(plan.pickupMethod, "natural-wild");
  assert.equal(plan.requiredNaturalCount, 1);
  assert.deepEqual(plan.requiredSupportCardIds, ["q1", "joker"]);
  assert.equal(plan.supportDescription, "one natural Q and one wild card");
  assert.ok(plan.availablePoints >= 50);
});

test("a frozen pile still rejects one natural plus one wild card", () => {
  const room = roomWith({
    hand: [card("q1", "Q"), card("wild", "2"), card("spare", "6")],
    pile: [card("top", "Q", "H")],
    opened: true,
    frozen: true,
    pickupRule: "classic",
  });

  assert.throws(() => planDiscardPickup(room, player), /frozen.*two natural/i);
});

test("classic unfrozen pickup uses the matching board meld before hand combinations", () => {
  const room = roomWith({
    hand: [card("q4", "Q"), card("q5", "Q", "C"), card("wild", "2"), card("spare", "6")],
    pile: [card("top", "Q", "H")],
    board: [{ rank: "Q", cards: [card("q1", "Q"), card("q2", "Q"), card("q3", "Q")] }],
    opened: true,
    frozen: false,
    pickupRule: "classic",
  });

  const plan = planDiscardPickup(room, player);

  assert.equal(plan.existing.rank, "Q");
  assert.equal(plan.pickupMethod, "existing-meld");
  assert.deepEqual(plan.forcedCards.map((item) => item.id), ["top"]);
  assert.deepEqual(plan.usedHandCardIds, []);
});

test("modern American pickup always requires two natural matches", () => {
  const room = roomWith({
    hand: [card("q1", "Q"), card("wild", "2"), card("spare", "6")],
    pile: [card("top", "Q", "H")],
    opened: true,
    frozen: false,
    pickupRule: "modern",
  });

  assert.throws(() => planDiscardPickup(room, player), /two natural cards matching/i);
});

test("modern American pickup requires two naturals even for an existing meld", () => {
  const room = roomWith({
    hand: [card("q1", "Q"), card("wild", "2"), card("spare", "6")],
    pile: [card("top", "Q", "H")],
    board: [{ rank: "Q", cards: [card("board-q1", "Q"), card("board-q2", "Q"), card("board-q3", "Q")] }],
    opened: true,
    frozen: false,
    pickupRule: "modern",
  });

  assert.throws(() => planDiscardPickup(room, player), /two natural cards matching/i);
});

test("pending pickup validation requires the top card and the exact support cards", () => {
  const pending = {
    rank: "Q",
    topCardId: "top",
    requiredSupportCardIds: ["q1", "wild"],
    supportDescription: "one natural Q and one wild card",
  };

  assert.match(
    validatePendingPickupSelection(pending, [card("q1", "Q"), card("wild", "2")]),
    /picked-up Q/i,
  );
  assert.match(
    validatePendingPickupSelection(pending, [card("top", "Q"), card("q1", "Q")]),
    /one natural Q and one wild card/i,
  );
  assert.equal(
    validatePendingPickupSelection(pending, [card("top", "Q"), card("q1", "Q"), card("wild", "2")]),
    "",
  );
});

test("stock exhaustion makes an unfrozen matching board meld mandatory", () => {
  const room = roomWith({
    hand: [card("spare", "6"), card("other", "7")],
    pile: [card("top", "Q", "H")],
    board: [{ rank: "Q", cards: [card("q1", "Q"), card("q2", "Q"), card("q3", "Q")] }],
    opened: true,
    frozen: false,
  });

  const status = stockExhaustionPickupStatus(room, player);
  assert.equal(status.canTake, true);
  assert.equal(status.mustTake, true);
});

test("stock exhaustion treats a completed matching canasta as an available board meld", () => {
  const room = roomWith({
    hand: [card("spare", "6"), card("other", "7")],
    pile: [card("top", "Q", "H")],
    board: [{
      rank: "Q",
      cards: Array.from({ length: 7 }, (_, index) => card(`q${index}`, "Q")),
    }],
    opened: true,
    frozen: false,
  });

  const status = stockExhaustionPickupStatus(room, player);
  assert.equal(status.canTake, true);
  assert.equal(status.mustTake, true);
  assert.equal(status.plan.pickupMethod, "existing-meld");
});

test("stock exhaustion permits but does not force a new meld pickup", () => {
  const room = roomWith({
    hand: [card("q1", "Q"), card("q2", "Q", "C"), card("spare", "6"), card("other", "7")],
    pile: [card("top", "Q", "H")],
    opened: true,
    frozen: false,
  });

  const status = stockExhaustionPickupStatus(room, player);
  assert.equal(status.canTake, true);
  assert.equal(status.mustTake, false);
});

test("a black three cannot continue play after the stock is exhausted", () => {
  const room = roomWith({
    hand: [card("only", "6")],
    pile: [card("top", "3", "C")],
    opened: true,
    frozen: false,
  });

  const status = stockExhaustionPickupStatus(room, player);
  assert.equal(status.canTake, false);
  assert.equal(status.mustTake, false);
});
