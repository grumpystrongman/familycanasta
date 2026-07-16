import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const enhancerUrl = new URL("./EmoteEnhancer.jsx", import.meta.url);
const stylesUrl = new URL("./emotes.css", import.meta.url);

test("runs the synchronized Evelyn table flip for exactly 1.5 seconds", async () => {
  const source = await readFile(enhancerUrl, "utf8");
  assert.match(source, /TABLE_FLIP_DURATION_MS = 1500/);
  assert.match(source, /activeEmote\?\.id !== "table-flip"/);
  assert.match(source, /game\.classList\.add\("evelyn-table-flipping"\)/);
  assert.match(source, /window\.setTimeout\(\(\) => \{[\s\S]*game\.classList\.remove\("evelyn-table-flipping"\);[\s\S]*\}, TABLE_FLIP_DURATION_MS\)/);
});

test("makes hand, board, stock, and discard cards fly while the screen shakes", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /\.game-page\.evelyn-table-flipping\s*\{[^}]*evelynScreenShake 1500ms/s);
  assert.match(styles, /\.game-page\.evelyn-table-flipping \.hand-card-wrap/);
  assert.match(styles, /\.game-page\.evelyn-table-flipping \.board-meld \.real-card/);
  assert.match(styles, /\.game-page\.evelyn-table-flipping \.pile-action \.pile/);
  assert.match(styles, /animation:\s*evelynCardScatter 1500ms/);
  assert.match(styles, /@keyframes evelynCardScatter/);
});

test("restores every card to its original visual position after the flip", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /100%\s*\{\s*transform:\s*translate3d\(0, 0, 0\) rotate\(0\) scale\(1\);\s*opacity:\s*1;/s);
  assert.match(styles, /overflow:\s*visible !important/);
});

test("honors reduced-motion preferences", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.game-page\.evelyn-table-flipping[\s\S]*animation-duration:\s*1ms !important/s);
});
