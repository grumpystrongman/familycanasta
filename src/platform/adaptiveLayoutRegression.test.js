import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync("src/platform/layoutMode.css", "utf8");
const boardEnhancer = fs.readFileSync("src/ResponsiveBoardEnhancer.jsx", "utf8");
const emoteEnhancer = fs.readFileSync("src/EmoteEnhancer.jsx", "utf8");

test("adaptive Canasta overrides the desktop two-column and fixed-hand layout", () => {
  assert.match(
    css,
    /html\[data-game-layout="adaptive"\] \.game-page\.responsive-board-ready\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/,
  );
  assert.match(
    css,
    /html\[data-game-layout="adaptive"\] \.responsive-board-ready \.hand\s*\{[\s\S]*?position:\s*relative !important;/,
  );
  assert.match(
    css,
    /html\[data-game-layout="adaptive"\] \.game-page \.score-chat-sidebar\s*\{[\s\S]*?grid-column:\s*1 !important;/,
  );
});

test("adaptive Canasta presents actions, hand, board controls, and boards in flow order", () => {
  assert.match(css, /\.responsive-board-ready \.center\s*\{[\s\S]*?order:\s*0 !important;/);
  assert.match(css, /\.responsive-board-ready \.hand\s*\{[\s\S]*?order:\s*1 !important;/);
  assert.match(css, /\.board-view-bar\s*\{[\s\S]*?order:\s*2 !important;/);
  assert.match(css, /\.responsive-board-ready \.shared-boards\s*\{[\s\S]*?order:\s*3 !important;/);
  assert.match(boardEnhancer, /game\.querySelector\("\.table"\) \|\| document\.body/);
});

test("phone layout uses compact cards and moves reminder chrome away from controls", () => {
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.hand \.real-card\s*\{\s*width:\s*68px;\s*height:\s*97px;/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.turn-reminder-timer\s*\{[\s\S]*?right:\s*8px;[\s\S]*?transform:\s*none;/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.standard-card\s*\{\s*width:\s*64px;\s*height:\s*91px;/);
});

test("optional emote chrome starts collapsed on adaptive devices", () => {
  assert.match(emoteEnhancer, /function shouldCollapseEmoteDock\(\)/);
  assert.match(emoteEnhancer, /useState\(shouldCollapseEmoteDock\)/);
  assert.match(emoteEnhancer, /dataset\.gameLayout === "adaptive"/);
});
