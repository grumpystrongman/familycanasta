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

test("assigns the flexible table row to the shared boards", async () => {
  const layout = await readFile(layoutUrl, "utf8");
  assert.match(layout, /grid-template-rows:\s*auto auto minmax\(180px, 1fr\) auto/);
  assert.match(layout, /\.responsive-board-ready \.shared-boards\s*\{[^}]*min-height:\s*180px/s);
});
