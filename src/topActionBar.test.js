import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainUrl = new URL("./main.jsx", import.meta.url);
const stylesUrl = new URL("./topActionBar.css", import.meta.url);

test("loads the top action bar styles with the core game", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /import "\.\/topActionBar\.css";/);
});

test("places draw controls before boards and enlarges action text", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /\.enhanced-game \.center\s*\{[^}]*order:\s*-20/s);
  assert.match(styles, /\.enhanced-game \.shared-boards\s*\{[^}]*order:\s*0/s);
  assert.match(styles, /\.enhanced-game \.dealer-orb span\s*\{[^}]*font-size:/s);
  assert.match(styles, /@media \(max-height: 620px\)/);
});
