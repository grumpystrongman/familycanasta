import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canastaDisplayType, meldCardCount } from "./boardMeldDisplay.js";

const enhancerUrl = new URL("./BoardMeldDisplayEnhancer.jsx", import.meta.url);
const cssUrl = new URL("./boardMeldDisplay.css", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("classifies clean and dirty canastas from the board status", () => {
  assert.equal(canastaDisplayType("7 cards · CLEAN BOOK"), "clean");
  assert.equal(canastaDisplayType("9 cards · DIRTY BOOK"), "dirty");
  assert.equal(canastaDisplayType("6 cards"), null);
  assert.equal(meldCardCount("12 cards · CLEAN BOOK"), 12);
});

test("keeps normal melds as overlapped card stacks", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /board-meld:not\(\.canasta-complete\)/);
  assert.match(css, /margin-left:\s*-39px/);
  assert.match(css, /real-card:first-child[\s\S]*margin-left:\s*0/);
});

test("collapses completed canastas to one red or black summary card", async () => {
  const enhancer = await readFile(enhancerUrl, "utf8");
  const css = await readFile(cssUrl, "utf8");
  assert.match(enhancer, /canasta-summary-card \$\{type\}/);
  assert.match(enhancer, /type === "clean" \? "CLEAN" : "DIRTY"/);
  assert.match(enhancer, /appendChild\(createCanastaCard/);
  assert.match(css, /canasta-complete > div > \.real-card[\s\S]*display:\s*none !important/);
  assert.match(css, /canasta-summary-card\.clean[\s\S]*#d83d4c/);
  assert.match(css, /canasta-summary-card\.dirty[\s\S]*#070809/);
});

test("loads the board meld display enhancer with the game", async () => {
  const main = await readFile(mainUrl, "utf8");
  assert.match(main, /import "\.\/boardMeldDisplay\.css";/);
  assert.match(main, /\["BoardMeldDisplayEnhancer", \(\) => import\("\.\/BoardMeldDisplayEnhancer"\)\]/);
});
