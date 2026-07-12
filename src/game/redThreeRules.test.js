import test from "node:test";
import assert from "node:assert/strict";
import {
  drawOneWithRedThreeReplacement,
  expectedRedThreeCount,
  extractRedThreesFromClaimedPile,
  hiddenRedThreePenalty,
  initialDiscardIsFrozen,
  redThreeScoreForTeam,
  resolveRedThreesInHand,
} from "./redThreeRules.js";

const redThree = (id, suit = "H") => ({ id, rank: "3", suit, color: "red" });
const card = (id, rank = "A", suit = "S") => ({ id, rank, suit, color: suit === "H" || suit === "D" ? "red" : "black" });

function roomWithStock(stock = []) {
  return {
    rules: { deckCount: 2 },
    members: { p1: { uid: "p1", team: 0 } },
    privateHands: { p1: [] },
    stock: [...stock],
    publicState: {
      redThrees: { p1: [] },
      handCounts: { p1: 0 },
      opened: { 0: false },
      stockCount: stock.length,
    },
  };
}

test("supports exactly four red threes for two decks and six for three decks", () => {
  assert.equal(expectedRedThreeCount(2), 4);
  assert.equal(expectedRedThreeCount(3), 6);
  assert.throws(() => expectedRedThreeCount(4), /requires 2 or 3 decks/);
});

test("consecutive red threes are exposed until a replacement card is drawn", () => {
  const replacement = card("ace");
  const room = roomWithStock([replacement, redThree("r2", "D"), redThree("r1")]);
  const result = drawOneWithRedThreeReplacement(room, "p1");

  assert.equal(result.card.id, "ace");
  assert.deepEqual(result.exposed.map((item) => item.id), ["r1", "r2"]);
  assert.deepEqual(room.privateHands.p1.map((item) => item.id), ["ace"]);
  assert.equal(room.publicState.redThrees.p1.length, 2);
  assert.equal(room.stock.length, 0);
  assert.equal(result.exhaustedOnRedThree, false);
});

test("a final stock red three is exposed without drawing or throwing", () => {
  const room = roomWithStock([redThree("last")]);
  const result = drawOneWithRedThreeReplacement(room, "p1");

  assert.equal(result.card, null);
  assert.equal(result.exposed.length, 1);
  assert.equal(result.stockExhausted, true);
  assert.equal(result.exhaustedOnRedThree, true);
  assert.equal(room.privateHands.p1.length, 0);
});

test("resolving a red three already in hand draws chained replacements", () => {
  const room = roomWithStock([card("replacement"), redThree("chain", "D")]);
  room.privateHands.p1 = [redThree("dealt")];
  const result = resolveRedThreesInHand(room, "p1");

  assert.equal(result.exposed.length, 2);
  assert.equal(result.replacements, 1);
  assert.deepEqual(room.privateHands.p1.map((item) => item.id), ["replacement"]);
});

test("red threes in a claimed discard pile are exposed without stock replacement", () => {
  const room = roomWithStock([card("untouched-stock", "K")]);
  const result = extractRedThreesFromClaimedPile(room, "p1", [
    redThree("bottom"),
    card("middle", "7", "C"),
  ]);

  assert.deepEqual(result.exposed.map((item) => item.id), ["bottom"]);
  assert.deepEqual(result.handCards.map((item) => item.id), ["middle"]);
  assert.equal(room.stock.length, 1);
});

test("an initial red three freezes the discard pile", () => {
  assert.equal(initialDiscardIsFrozen(redThree("upcard"), { freezeOnWild: true }), true);
  assert.equal(initialDiscardIsFrozen(card("normal", "9", "C"), { freezeOnWild: true }), false);
});

test("two-deck all-red-three score is +800 when opened and -800 when unopened", () => {
  const room = roomWithStock();
  room.publicState.redThrees.p1 = [
    redThree("1"), redThree("2", "D"), redThree("3"), redThree("4", "D"),
  ];

  room.publicState.opened[0] = true;
  assert.deepEqual(redThreeScoreForTeam(room, 0), {
    count: 4,
    hasAll: true,
    opened: true,
    points: 800,
  });

  room.publicState.opened[0] = false;
  assert.equal(redThreeScoreForTeam(room, 0).points, -800);
});

test("three-deck five red threes score base points, while all six score 1000", () => {
  const room = roomWithStock();
  room.rules.deckCount = 3;
  room.publicState.opened[0] = true;
  room.publicState.redThrees.p1 = [1, 2, 3, 4, 5].map((value) => redThree(String(value), value % 2 ? "H" : "D"));
  assert.equal(redThreeScoreForTeam(room, 0).points, 500);

  room.publicState.redThrees.p1.push(redThree("6", "D"));
  assert.equal(redThreeScoreForTeam(room, 0).points, 1000);
});

test("a red three left in hand receives a separate 200 point penalty", () => {
  const room = roomWithStock();
  room.privateHands.p1 = [redThree("hidden")];
  assert.deepEqual(hiddenRedThreePenalty(room, 0), { count: 1, points: -200 });
});
