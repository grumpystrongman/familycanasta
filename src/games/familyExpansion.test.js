import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ersSlapReasons } from "./ers/engine.js";
import { hasFourOfAKind } from "./spoons/engine.js";
import { cardsPerPlayerForRound, removedRanksForRound } from "./indians/engine.js";
import { comparePokerHands, evaluatePokerHand } from "./poker/engine.js";
import { scoreGolfGrid } from "./golf/engine.js";

const card = (rank, suit = "clubs") => ({ id: `${suit}-${rank}-${Math.random()}`, rank, suit, value: rank === "A" ? 14 : rank === "K" ? 13 : rank === "Q" ? 12 : rank === "J" ? 11 : Number(rank), color: ["hearts","diamonds"].includes(suit) ? "red" : "black" });

test("ERS recognizes the family table slap patterns", () => {
  assert.ok(ersSlapReasons([card("8"), card("8")]).includes("double"));
  assert.ok(ersSlapReasons([card("4"), card("9"), card("4")]).includes("sandwich"));
  assert.ok(ersSlapReasons([card("3"), card("7")]).includes("tens"));
  assert.ok(ersSlapReasons([card("Q"), card("K")]).includes("marriage"));
  assert.ok(ersSlapReasons([card("Q"), card("K"), card("A"), card("2")]).includes("four-in-a-row"));
});

test("Spoons four-of-a-kind check requires all four ranks to match", () => {
  assert.equal(hasFourOfAKind([card("6"), card("6","hearts"), card("6","spades"), card("6","diamonds")]), true);
  assert.equal(hasFourOfAKind([card("6"), card("6","hearts"), card("7","spades"), card("6","diamonds")]), false);
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
