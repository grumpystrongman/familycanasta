import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainUrl = new URL("./main.jsx", import.meta.url);
const stylesUrl = new URL("./topActionBar.css", import.meta.url);
const layoutUrl = new URL("./classicCanastaLayout.css", import.meta.url);

test("loads the top action bar and board layout styles", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /import "\.\/topActionBar\.css";/);
  assert.match(source, /import "\.\/classicCanastaLayout\.css";/);
});

test("makes the draw row about ten percent of the game viewport", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /--canasta-draw-row-height:\s*clamp\(72px, 10vh, 120px\)/);
  assert.match(styles, /\.enhanced-game \.center\s*\{[^}]*flex:\s*0 0 var\(--canasta-draw-row-height\)[^}]*height:\s*var\(--canasta-draw-row-height\)/s);
  assert.match(styles, /\.enhanced-game \.shared-boards\s*\{[^}]*order:\s*0/s);
});

test("uses larger, easier-to-hit stock and discard controls", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /\.enhanced-game \.pile-action\s*\{[^}]*min-width:\s*190px[^}]*border-radius:\s*12px/s);
  assert.match(styles, /\.enhanced-game \.pile-action \.pile\s*\{[^}]*width:\s*48px[^}]*height:\s*68px/s);
  assert.match(styles, /\.enhanced-game \.pile-action > b\s*\{[^}]*font-size:\s*14px/s);
});

test("centers the discard pile in the top action bar", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /grid-template-columns:\s*1fr auto 1fr/);
  assert.match(styles, /grid-template-areas:\s*"stock discard status"/);
  assert.match(styles, /\.center > \.pile-action:last-child\s*\{[^}]*grid-area:\s*discard[^}]*justify-self:\s*center/s);
});

test("assigns the flexible table row to the shared boards without an opponent row", async () => {
  const layout = await readFile(layoutUrl, "utf8");
  assert.match(layout, /grid-template-rows:\s*auto minmax\(240px, 1fr\) auto/);
  assert.match(layout, /\.enhanced-game \.opponents\s*\{[^}]*display:\s*none !important/s);
  assert.match(layout, /\.responsive-board-ready \.shared-boards\s*\{[^}]*min-height:\s*240px/s);
});
