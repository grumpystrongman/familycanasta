import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const enhancerUrl = new URL("./ResponsiveBoardEnhancer.jsx", import.meta.url);
const cssUrl = new URL("./responsiveBoard.css", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("loads the responsive board enhancer", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /import "\.\/responsiveBoard\.css";/);
  assert.match(source, /\["ResponsiveBoardEnhancer", \(\) => import\("\.\/ResponsiveBoardEnhancer"\)\]/);
});

test("defaults to a focused board view and preserves compact and full controls", async () => {
  const source = await readFile(enhancerUrl, "utf8");
  assert.match(source, /localStorage\.getItem\(VIEW_KEY\) \|\| "focus"/);
  assert.match(source, /\["focus", "My board"/);
  assert.match(source, /\["compact", "Compact all"/);
  assert.match(source, /\["full", "Full boards"/);
});

test("keeps actions reachable and summarizes completed books", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /grid-template-rows: auto minmax\(110px, 1fr\) auto auto/);
  assert.match(css, /\.responsive-board-ready \.hand \{[\s\S]*position: relative !important/);
  assert.match(css, /board-meld:has\(\.real-card:nth-child\(7\)\)/);
  assert.match(css, /aria-label\^="JOKER "/);
});
