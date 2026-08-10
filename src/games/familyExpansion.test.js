import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ersSlapReasons, reduceERS } from "./ers/engine.js";
import { hasFourOfAKind, reduceSpoons } from "./spoons/engine.js";
import { cardsPerPlayerForRound, removedRanksForRound } from "./indians/engine.js";
import { comparePokerHands, evaluatePokerHand, reducePoker } from "./poker/engine.js";
import { scoreGolfGrid } from "./golf/engine.js";

const card = (rank, suit = "clubs") => ({ id: `${suit}-${rank}-${Math.random()}`, rank, suit, value: rank === "A" ? 14 : rank === "K" ? 13 : rank === "Q" ? 12 : rank === "J" ? 11 : Number(rank), color: ["hearts","diamonds"].includes(suit) ? "red" : "black" });
const members = [
  { uid: "a", nickname: "A", seat: 0 },
  { uid: "b", nickname: "B", seat: 1 },
  { uid: "c", nickname: "C", seat: 2 },
];

test("ERS recognizes the family table slap patterns", () => {
  assert.ok(ersSlapReasons([card("8"), card("8")]).includes("double"));
  assert.ok(ersSlapReasons([card("4"), card("9"), card("4")]).includes("sandwich"));
  assert.ok(ersSlapReasons([card("3"), card("7")]).includes("tens"));
  assert.ok(ersSlapReasons([card("Q"), card("K")]).includes("marriage"));
  assert.ok(ersSlapReasons([card("Q"), card("K"), card("A"), card("2")]).includes("four-in-a-row"));
});

test("ERS players eliminated by a bad empty-handed slap cannot slap back in", () => {
  const state = {
    phase: "playing",
    hands: { a: [], b: [card("7")] },
    pile: [card("4"), card("9")],
    out: { a: true },
    currentPlayerIndex: 1,
  };
  assert.throws(() => reduceERS(state, "a", { type: "slap" }, members.slice(0, 2)), /eliminated/);
});

test("Spoons four-of-a-kind check requires all four ranks to match", () => {
  assert.equal(hasFourOfAKind([card("6"), card("6","hearts"), card("6","spades"), card("6","diamonds")]), true);
  assert.equal(hasFourOfAKind([card("6"), card("6","hearts"), card("7","spades"), card("6","diamonds")]), false);
});

test("the player who completes four of a kind takes the first spoon before the scramble", () => {
  const sixes = [card("6"), card("6","hearts"), card("6","spades")];
  const throwaway = card("2");
  const incoming = card("6","diamonds");
  const state = {
    phase: "passing",
    roundNumber: 1,
    hands: { a: [...sixes, throwaway], b: [], c: [] },
    drawPile: [card("3")],
    trash: [],
    flowOrder: ["a","b","c"],
    passPosition: 0,
    currentPlayerIndex: 0,
    incomingCard: incoming,
    spoonsRemaining: 2,
    grabbed: {},
    letters: {},
    eliminated: {},
    lettersToLose: 5,
  };
  const next = reduceSpoons(state, "a", { type: "pass", cardId: throwaway.id }, members);
  assert.equal(next.phase, "grabbing");
  assert.equal(next.grabbed.a, true);
  assert.equal(next.spoonsRemaining, 1);
});

test("Indians removes one complete low rank per hand down to five cards each", () => {
  assert.deepEqual(removedRanksForRound(1), []);
  assert.deepEqual(removedRanksForRound(4), ["2","3","4"]);
  assert.deepEqual(removedRanksForRound(9), ["2","3","4","5","6","7","8","9"]);
  assert.equal(cardsPerPlayerForRound(1), 13);
  assert.equal(cardsPerPlayerForRound(9), 5);
  assert.equal(cardsPerPlayerForRound(20), 5);
});

test("Poker evaluator follows standard five-card hand order", () => {
  const straightFlush = [card("10","hearts"), card("J","hearts"), card("Q","hearts"), card("K","hearts"), card("A","hearts")];
  const quads = [card("9"), card("9","hearts"), card("9","spades"), card("9","diamonds"), card("2")];
  const fullHouse = [card("8"), card("8","hearts"), card("8","spades"), card("3"), card("3","hearts")];
  assert.equal(evaluatePokerHand(straightFlush).name, "Straight flush");
  assert.ok(comparePokerHands(straightFlush, quads) > 0);
  assert.ok(comparePokerHands(quads, fullHouse) > 0);
});

test("family Poker never accepts a partial call without side-pot accounting", () => {
  const state = {
    phase: "betting-1",
    currentPlayerIndex: 0,
    inHand: { a: true, b: true },
    folded: {},
    balances: { a: 0, b: 10 },
    pot: 2,
    currentBet: 1,
    bettingContrib: { a: 0, b: 1 },
    acted: { b: true },
    raises: 0,
    maxRaises: 3,
  };
  assert.throws(() => reducePoker(state, "a", { type: "bet", move: "call" }, members.slice(0, 2)), /Not enough points/);
});

test("Six Card Golf scores matching vertical pairs as zero", () => {
  const grid = [card("K"), card("5"), card("Q"), card("K","hearts"), card("5","hearts"), card("2")];
  assert.equal(scoreGolfGrid(grid), 8);
});

test("every new game stays in its own folder and avoids sibling game imports", async () => {
  const gameIds = ["ers","spoons","indians","poker","golf"];
  for (const gameId of gameIds) {
    const source = await readFile(new URL(`./${gameId}/index.jsx`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\.\.\/(ers|spoons|indians|poker|golf)\//);
    assert.match(source, /standardCards\.css/);
  }
});

test("all nine card-room games have learn-to-play content", async () => {
  const learning = await readFile(new URL("../platform/GameLearningCenter.jsx", import.meta.url), "utf8");
  for (const gameId of ["canasta","hearts","spades","rummy","ers","spoons","indians","poker","golf"]) {
    assert.match(learning, new RegExp(`\\b${gameId}:\\s*\\{`));
  }
  assert.match(learning, /Learn to play/);
  assert.match(learning, /Full rules/);
});

test("new game styles do not introduce horizontal hand scrolling", async () => {
  const gameIds = ["ers","spoons","indians","poker","golf"];
  for (const gameId of gameIds) {
    const styles = await readFile(new URL(`./${gameId}/styles.css`, import.meta.url), "utf8");
    assert.doesNotMatch(styles, /overflow-x\s*:\s*auto/);
  }
});

test("ERS shows one active card and a separate non-overlapping recent-card row", async () => {
  const source = await readFile(new URL("./ers/ERSGame.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./ers/styles.css", import.meta.url), "utf8");
  assert.match(source, /ers-active-card/);
  assert.match(source, /ers-recent-row/);
  assert.match(source, /Reveal top card/);
  assert.match(source, /chooseRobotMove:\s*chooseERSRobotMove/);
  assert.doesNotMatch(source, /ers-depth-/);
  assert.doesNotMatch(styles, /\.ers-pile-card/);
});
