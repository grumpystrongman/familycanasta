import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appUrl = new URL("./App.jsx", import.meta.url);
const actionsUrl = new URL("./game/humanActions.js", import.meta.url);
const plannerUrl = new URL("./game/discardPickupPlanner.js", import.meta.url);

test("only performs the human discard pickup when the pile button is clicked", async () => {
  const app = await readFile(appUrl, "utf8");
  const planner = await readFile(plannerUrl, "utf8");

  assert.match(app, /onClick=\{\(\) => act\(\(\) => takeDiscardPile\(roomCode, user\.uid\)\)\}/);
  assert.match(planner, /mustTake:\s*false/);
});

test("puts the top card on the existing board meld and the lower pile in hand", async () => {
  const actions = await readFile(actionsUrl, "utf8");

  assert.match(actions, /if \(plan\.existing\) \{[\s\S]*plan\.existing\.cards = \[\.\.\.\(plan\.existing\.cards \|\| \[\]\), \.\.\.plan\.forcedCards\]/);
  assert.match(actions, /room\.privateHands\[uid\] = sortHand\(\[[\s\S]*\.\.\.plan\.lowerPile/);
  assert.match(actions, /kept the remaining cards in hand/);
});
