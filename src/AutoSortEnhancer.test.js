import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainUrl = new URL("./main.jsx", import.meta.url);
const enhancerUrl = new URL("./AutoSortEnhancer.jsx", import.meta.url);

test("loads the hand autosort enhancer with the game", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /import "\.\/autoSort\.css";/);
  assert.match(source, /\["AutoSortEnhancer", \(\) => import\("\.\/AutoSortEnhancer"\)\]/);
});

test("sorts through the existing drag handlers so React hand order stays authoritative", async () => {
  const source = await readFile(enhancerUrl, "utf8");
  assert.match(source, /const RANK_ORDER = \["A", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "3", "2", "JOKER"\]/);
  assert.match(source, /const CARD_ID_TYPE = "text\/card-id"/);
  assert.match(source, /dispatchDragEvent\(targetWrapper, "drop", createDataTransfer\(desired\.id\)\)/);
  assert.match(source, /Auto-sort hand/);
});
