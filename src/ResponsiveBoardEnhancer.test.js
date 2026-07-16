import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const enhancerUrl = new URL("./ResponsiveBoardEnhancer.jsx", import.meta.url);
const cssUrl = new URL("./responsiveBoard.css", import.meta.url);
const compactCssUrl = new URL("./classicCanastaLayout.css", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("loads the responsive board enhancer", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /import "\.\/responsiveBoard\.css";/);
  assert.match(source, /import "\.\/classicCanastaLayout\.css";/);
  assert.match(source, /\["ResponsiveBoardEnhancer", \(\) => import\("\.\/ResponsiveBoardEnhancer"\)\]/);
});

test("defaults to a focused board view and preserves compact and full controls", async () => {
  const source = await readFile(enhancerUrl, "utf8");
  assert.match(source, /localStorage\.getItem\(VIEW_KEY\) \|\| "focus"/);
  assert.match(source, /\["focus", "My board"/);
  assert.match(source, /\["compact", "Compact all"/);
  assert.match(source, /\["full", "Full boards"/);
});

test("detects multi-player individual games and annotates meld counts", async () => {
  const source = await readFile(enhancerUrl, "utf8");
  assert.match(source, /boards\.length > 2 && playerCount === boards\.length/);
  assert.match(source, /meld\.dataset\.cardCount = String\(cards\.length\)/);
  assert.match(source, /clean-canasta/);
  assert.match(source, /dirty-canasta/);
});

test("keeps board view controls below the top discard area", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /\.board-view-bar\s*\{[^}]*top:\s*140px/s);
  assert.match(css, /\.responsive-board-ready \.center\s*\{[^}]*z-index:\s*100/s);
  assert.doesNotMatch(css, /\.board-view-bar\s*\{[^}]*top:\s*78px/s);
});

test("removes the oversized opponent circles and gives the boards the flexible row", async () => {
  const compactCss = await readFile(compactCssUrl, "utf8");
  assert.match(compactCss, /\.enhanced-game \.opponents\s*\{[^}]*display:\s*none !important/s);
  assert.match(compactCss, /grid-template-rows:\s*auto minmax\(240px, 1fr\) auto/);
  assert.match(compactCss, /\.responsive-board-ready \.shared-boards\s*\{[^}]*height:\s*100%/s);
});

test("shows one collapsed card with a count bubble and canasta colors", async () => {
  const compactCss = await readFile(compactCssUrl, "utf8");
  assert.match(compactCss, /\.real-card:first-child\s*\{[^}]*display:\s*block/s);
  assert.match(compactCss, /content:\s*attr\(data-card-count\)/);
  assert.match(compactCss, /\.board-meld\.clean-canasta\s*\{[^}]*border-color:\s*#e04652/s);
  assert.match(compactCss, /\.board-meld\.dirty-canasta\s*\{[^}]*border-color:\s*#9a6543/s);
});

test("keeps actions reachable and supports the original responsive board styles", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /\.responsive-board-ready \.hand \{[\s\S]*position: relative !important/);
  assert.match(css, /board-meld:has\(\.real-card:nth-child\(7\)\)/);
  assert.match(css, /aria-label\^="JOKER "/);
});
