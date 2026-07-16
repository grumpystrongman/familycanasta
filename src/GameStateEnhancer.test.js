import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("./GameStateEnhancer.jsx", import.meta.url);

test("explains the classic unfrozen pickup decision order", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /use a matching board meld; otherwise two matches or one match \+ wild/);
  assert.match(source, /Modern American still requires two natural matches/);
  assert.match(source, /FROZEN — two natural matches required/);
});
