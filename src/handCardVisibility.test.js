import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesUrl = new URL("./cardAccessibility.css", import.meta.url);

test("keeps player hand cards large enough to read", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /--canasta-hand-hover-height:\s*clamp\(350px, 38vh, 402px\) !important/);
  assert.match(styles, /\.responsive-board-ready \.hand \.real-card\s*\{[^}]*width:\s*124px !important[^}]*height:\s*178px !important/s);
  assert.match(styles, /\.responsive-board-ready \.hand \.hand-card-wrap\s*\{[^}]*margin-left:\s*-38px/s);
  assert.match(styles, /\.responsive-board-ready \.hand \.cards\s*\{[^}]*padding:\s*68px 28px 8px !important/s);
  assert.match(styles, /\.responsive-board-ready \.hand \.card-corner b\s*\{[^}]*font-size:\s*23px/s);
  assert.match(styles, /\.responsive-board-ready \.hand \.pip-field > span\s*\{[^}]*font-size:\s*34px/s);
});

test("does not collapse hand cards on narrower screens", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /@media \(max-width: 850px\)[\s\S]*\.responsive-board-ready \.hand \.real-card\s*\{[^}]*width:\s*112px !important[^}]*height:\s*160px !important/s);
});
