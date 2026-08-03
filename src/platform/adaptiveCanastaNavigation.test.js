import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const component = fs.readFileSync("src/platform/AdaptiveCanastaNavigation.jsx", "utf8");
const css = fs.readFileSync("src/platform/adaptiveCanastaNavigation.css", "utf8");
const main = fs.readFileSync("src/main.jsx", "utf8");

test("adaptive Canasta exposes task-based Hand, Board, Score, Chat, and More views", () => {
  for (const label of ["Hand", "Board", "Score", "Chat", "More"]) {
    assert.match(component, new RegExp(`\\[\\"[a-z]+\\", \\"${label}\\"\\]`));
  }
  assert.match(component, /game\.dataset\.adaptiveView = view/);
  assert.match(component, /dataset\.gameLayout === "adaptive"/);
});

test("adaptive Canasta keeps the game within one viewport", () => {
  assert.match(css, /height:\s*100dvh !important/);
  assert.match(css, /overflow:\s*hidden !important/);
  assert.match(css, /grid-template-rows:\s*70px minmax\(0, 1fr\) !important/);
  assert.match(css, /adaptive-canasta-navigation-active body/);
});

test("hand and board views reserve separate task surfaces", () => {
  assert.match(css, /data-adaptive-view="hand"[\s\S]*?\.shared-boards[\s\S]*?display:\s*none !important/);
  assert.match(css, /data-adaptive-view="board"[\s\S]*?\.hand[\s\S]*?display:\s*none !important/);
  assert.match(css, /data-adaptive-view="board"[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important/);
});

test("score information is compact on iPad and single-column on phones", () => {
  assert.match(css, /data-adaptive-view="score"[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?data-adaptive-view="score"[\s\S]*?grid-template-columns:\s*1fr/);
});

test("the adaptive navigation enhancement is mounted only through the Canasta enhancement pipeline", () => {
  assert.match(main, /\["AdaptiveCanastaNavigation", \(\) => import\("\.\/platform\/AdaptiveCanastaNavigation"\)\]/);
});
