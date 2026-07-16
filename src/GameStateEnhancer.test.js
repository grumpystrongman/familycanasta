import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("./GameStateEnhancer.jsx", import.meta.url);

test("explains that direct board-meld pickup is unfrozen only", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /UNFROZEN ONLY — click to take: top card to matching meld, rest to hand; otherwise two matches or one match \+ wild/);
  assert.match(source, /Modern American still requires two natural matches/);
  assert.match(source, /FROZEN — two natural matches required, even with a matching board meld/);
});
