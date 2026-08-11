import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gameSource = await readFile(new URL("./GameBoard.jsx", import.meta.url), "utf8");
const indexSource = await readFile(new URL("./index.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("./n64-overrides.css", import.meta.url), "utf8");

test("Slum Lord is a local full-board module with no party-stage dependency", () => {
  assert.match(indexSource, /GameBoard/);
  assert.doesNotMatch(gameSource, /PartyStage|partyRoom|usePartyRoom|phone|controller/i);
  assert.doesNotMatch(gameSource, /firebase/i);
});

test("Slum Lord maps its 36 spaces to a ten-by-ten perimeter", () => {
  assert.match(gameSource, /gridRow:\s*10,\s*gridColumn:\s*10\s*-\s*id/);
  assert.match(gameSource, /gridColumn:\s*10\s*}/);
  assert.match(styles, /repeat\(8,\s*1fr\)/);
});

test("Slum Lord exposes the primary board-game interactions on one screen", () => {
  for (const label of ["Roll dice", "End turn", "Trade", "Auction", "Mortgage", "Upgrade"]) {
    assert.match(gameSource, new RegExp(label, "i"));
  }
});
