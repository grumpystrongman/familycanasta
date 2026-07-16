import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainUrl = new URL("./main.jsx", import.meta.url);
const stylesUrl = new URL("./topActionBar.css", import.meta.url);
const layoutUrl = new URL("./classicCanastaLayout.css", import.meta.url);

test("loads the compact top action bar and board layout styles", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /import "\.\/topActionBar\.css";/);
  assert.match(source, /import "\.\/classicCanastaLayout\.css";/);
});

test("places compact rectangular draw controls before the boards", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /\.enhanced-game \.center\s*\{[^}]*order:\s*-20/s);
  assert.match(styles, /\.enhanced-game \.shared-boards\s*\{[^}]*order:\s*0/s);
  assert.match(styles, /\.enhanced-game \.pile-action\s*\{[^}]*border-radius:\s*10px/s);
  assert.match(styles, /\.enhanced-game \.pile-action \.pile\s*\{[^}]*width:\s*34px/s);
  assert.doesNotMatch(styles, /min-height:\s*154px/);
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
