import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const actionUrl = new URL("./blackThreeGoOutAction.js", import.meta.url);
const enhancerUrl = new URL("../BlackThreeRuleFix.jsx", import.meta.url);

test("commits the black-three meld and round end in one transaction", async () => {
  const source = await readFile(actionUrl, "utf8");
  assert.match(source, /runTransaction/);
  assert.match(source, /blackThreeGoOutPlan\(hand, selected, teamOpened\)/);
  assert.match(source, /blackThreeMeld: true/);
  assert.match(source, /room\.privateHands\[uid\] = \[\]/);
  assert.match(source, /return finishRound\(room, uid\)/);
});

test("automatically handles the one legal final discard", async () => {
  const source = await readFile(actionUrl, "utf8");
  assert.match(source, /if \(plan\.finalDiscard\)/);
  assert.match(source, /discardPile\.push\(plan\.finalDiscard\)/);
});

test("shows a dedicated go-out action instead of the normal meld action", async () => {
  const source = await readFile(enhancerUrl, "utf8");
  assert.match(source, /primaryButton\.hidden = blackThreeSelection/);
  assert.match(source, /Go out with \$\{selectedCards\.length\} black threes/);
});
