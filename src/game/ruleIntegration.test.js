import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const actionsUrl = new URL("./humanActions.js", import.meta.url);
const homeRulesUrl = new URL("../HomeRulesOptions.jsx", import.meta.url);

test("human plays and discards enforce the canasta go-out requirement", async () => {
  const source = await readFile(actionsUrl, "utf8");
  assert.match(source, /boardCanGoOut\(projectedBoard, room\.rules\)/);
  assert.match(source, /remainingHand\.length < 2/);
  assert.match(source, /hand\.length === 1 && !teamCanGoOut\(room, player\.team\)/);
  assert.match(source, /usedHandCardIds \|\| plan\.usedNaturalIds/);
});

test("custom-game and lobby settings expose classic and modern pickup rules", async () => {
  const source = await readFile(homeRulesUrl, "utf8");
  assert.match(source, /<option value="classic">Classic Canasta<\/option>/);
  assert.match(source, /<option value="modern">Modern American<\/option>/);
  assert.match(source, /discardPickupRule/);
});
