import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("./ScoringDisplayFix.jsx", import.meta.url);

test("scoring repair does not observe its own text mutations", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /setTextIfChanged/);
  assert.doesNotMatch(source, /characterData:\s*true/);
  assert.match(source, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
});
