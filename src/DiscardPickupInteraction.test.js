import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appUrl = new URL("./App.jsx", import.meta.url);
const actionsUrl = new URL("./game/humanActions.js", import.meta.url);
const applyUrl = new URL("./game/discardPickupApply.js", import.meta.url);
const plannerUrl = new URL("./game/discardPickupPlanner.js", import.meta.url);

test("only performs the human discard pickup when the pile button is clicked", async () => {
  const app = await readFile(appUrl, "utf8");
  const planner = await readFile(plannerUrl, "utf8");

  assert.match(app, /onClick=\{\(\) => act\(\(\) => takeDiscardPile\(roomCode, user\.uid\)\)\}/);
  assert.match(planner, /mustTake:\s*false/);
});

test("applies the top discard and required hand support as one meld", async () => {
  const actions = await readFile(actionsUrl, "utf8");
  const apply = await readFile(applyUrl, "utf8");

  assert.match(actions, /const pickup = applyImmediateDiscardPickup\(hand, board, plan\)/);
  assert.match(actions, /room\.privateHands\[uid\] = sortHand\(pickup\.remainingHand\)/);
  assert.match(apply, /const committedCards = \[plan\.top, \.\.\.supportCards\]/);
  assert.match(apply, /board\.push\(\{ rank: plan\.top\.rank, cards: committedCards \}\)/);
  assert.match(actions, /melded \$\{pickup\.committedCards\.length\}/);
});
