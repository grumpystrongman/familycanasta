import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cssUrl = new URL("./handControlsSeparation.css", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("loads the hand separation rules after all other layout styles", async () => {
  const source = await readFile(mainUrl, "utf8");
  const separationIndex = source.indexOf('import "./handControlsSeparation.css";');
  const isolationIndex = source.indexOf('import "./playSurfaceIsolation.css";');

  assert.ok(separationIndex > isolationIndex);
});

test("keeps controls in their own row above a full-height card rail", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /grid-template-rows:\s*auto auto var\(--canasta-hand-card-rail-height\) !important/);
  assert.match(css, /--canasta-hand-card-rail-height:\s*224px/);
  assert.match(css, /\.responsive-board-ready \.hand \.cards\s*\{[^}]*height:\s*var\(--canasta-hand-card-rail-height\) !important[^}]*overflow-y:\s*hidden !important/s);
  assert.match(css, /\.responsive-board-ready \.hand \.real-card\.selected\s*\{[^}]*translateY\(-14px\)/s);
});

test("stops the hand before the score and table-actions sidebar", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /--canasta-sidebar-width:\s*300px/);
  assert.match(css, /--canasta-sidebar-gutter:\s*14px/);
  assert.match(css, /inset:\s*auto calc\(var\(--canasta-sidebar-width\) \+ var\(--canasta-sidebar-gutter\)\) 0 0 !important/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) var\(--canasta-sidebar-width\) !important/);
});
