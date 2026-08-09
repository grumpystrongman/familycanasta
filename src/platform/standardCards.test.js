import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesUrl = new URL("./standardCards.css", import.meta.url);
const heartsUrl = new URL("../games/hearts/HeartsGame.jsx", import.meta.url);
const spadesUrl = new URL("../games/spades/SpadesGame.jsx", import.meta.url);
const rummyUrl = new URL("../games/rummy/RummyGame.jsx", import.meta.url);

test("shared modular hands reflow instead of hiding cards off the right edge", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.modular-hand\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(60px,\s*1fr\)\)[^}]*overflow:\s*visible/s);
  assert.match(styles, /\.modular-hand \.standard-card\s*\{[^}]*width:\s*100%[^}]*max-width:\s*82px[^}]*aspect-ratio:\s*82\s*\/\s*116/s);
  assert.doesNotMatch(styles, /\.modular-hand\s*\{[^}]*overflow-x:\s*auto/s);
});

test("Hearts, Spades, and Rummy all use the shared visible-hand layout", async () => {
  const sources = await Promise.all([heartsUrl, spadesUrl, rummyUrl].map((url) => readFile(url, "utf8")));

  for (const source of sources) {
    assert.match(source, /className="modular-hand"/);
  }
});
