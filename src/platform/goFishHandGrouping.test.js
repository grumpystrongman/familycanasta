import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { groupGoFishHand } from "./goFishCore.js";

const card = (rank, suit) => ({ id: `${rank}-${suit}`, rank, suit });

test("Go Fish hand grouping keeps matching ranks together in stable rank order", () => {
  const groups = groupGoFishHand([
    card("9", "hearts"),
    card("2", "spades"),
    card("9", "clubs"),
    card("K", "diamonds"),
    card("2", "clubs"),
    card("9", "diamonds"),
  ]);

  assert.deepEqual(groups.map((group) => group.rank), ["2", "9", "K"]);
  assert.deepEqual(groups.map((group) => group.cards.length), [2, 3, 1]);
  assert.deepEqual(groups[0].cards.map((entry) => entry.suit), ["clubs", "spades"]);
  assert.deepEqual(groups[1].cards.map((entry) => entry.suit), ["clubs", "diamonds", "hearts"]);
});

test("Go Fish table renders each matching rank as one visual hand group", async () => {
  const source = await readFile(new URL("./GoFishModule.jsx", import.meta.url), "utf8");
  assert.match(source, /groupGoFishHand\(rawHand\)/);
  assert.match(source, /fish-hand-group/);
  assert.match(source, /matching cards stay together automatically/);
  assert.match(source, /group\.cards\.length}\\/4/);
});
