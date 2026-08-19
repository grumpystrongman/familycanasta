import test from "node:test";
import assert from "node:assert/strict";
import { buildDeductionGroups, matchingAlibiCards, theoryCardIds } from "./deduction.js";

const suspects = [{ id: "mara" }, { id: "dex" }, { id: "imani" }];
const methods = [{ id: "axe" }, { id: "rope" }];
const locations = [{ id: "atrium" }, { id: "suite" }];

test("matching alibi cards returns only cards that can refute the current theory", () => {
  const theory = { suspectId: "mara", methodId: "axe", locationId: "atrium" };
  assert.deepEqual(theoryCardIds(theory), ["suspect:mara", "method:axe", "location:atrium"]);
  assert.deepEqual(
    matchingAlibiCards(["location:suite", "method:axe", "suspect:mara"], theory),
    ["method:axe", "suspect:mara"],
  );
});

test("deduction resolves the only remaining card in a category", () => {
  const groups = buildDeductionGroups({
    known: ["suspect:mara"],
    notebook: { "suspect:dex": "cleared", "method:axe": "watch" },
    suspects,
    methods,
    locations,
  });
  const suspectGroup = groups.find((group) => group.kind === "suspect");
  const methodGroup = groups.find((group) => group.kind === "method");
  assert.equal(suspectGroup.resolvedCardId, "suspect:imani");
  assert.equal(suspectGroup.remaining.length, 1);
  assert.equal(methodGroup.resolvedCardId, null);
  assert.equal(methodGroup.remaining.length, 2);
});
