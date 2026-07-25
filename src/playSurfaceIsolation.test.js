import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesUrl = new URL("./playSurfaceIsolation.css", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("loads the play surface isolation rules after the other layout styles", async () => {
  const source = await readFile(mainUrl, "utf8");
  const isolationIndex = source.indexOf('import "./playSurfaceIsolation.css";');
  const responsiveIndex = source.indexOf('import "./responsiveBoard.css";');
  const actionIndex = source.indexOf('import "./topActionBar.css";');

  assert.ok(isolationIndex > responsiveIndex);
  assert.ok(isolationIndex > actionIndex);
});

test("prevents the top actions from expanding into the hand", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.responsive-board-ready \.center\s*\{[^}]*max-height:\s*var\(--canasta-draw-row-height\) !important[^}]*overflow-x:\s*auto !important[^}]*overflow-y:\s*hidden !important/s);
  assert.match(styles, /\.game-page\.responsive-board-ready \.hand\s*\{[^}]*position:\s*fixed !important[^}]*inset:\s*auto 300px 0 0 !important/s);
});

test("supports twenty or more cards without shrinking or wrapping", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.responsive-board-ready \.hand \.cards\s*\{[^}]*flex-flow:\s*row nowrap !important[^}]*overflow-x:\s*auto !important/s);
  assert.match(styles, /\.responsive-board-ready \.hand \.hand-card-wrap\s*\{[^}]*flex:\s*0 0 124px !important[^}]*min-width:\s*124px !important[^}]*max-width:\s*124px !important/s);
  assert.match(styles, /\.responsive-board-ready \.hand \.real-card\s*\{[^}]*flex:\s*0 0 124px !important[^}]*min-width:\s*124px !important[^}]*height:\s*178px !important/s);
});
