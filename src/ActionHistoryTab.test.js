import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("./ActionHistoryEnhancer.jsx", import.meta.url);

test("keeps public hand counts on score and moves actions to their own target", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /setScoreTarget\(document\.querySelector\("\.score-sidebar-content"\)\)/);
  assert.match(source, /setActionTarget\(document\.querySelector\("\.table-actions-tab-content"\)\)/);
  assert.match(source, /scoreTarget && createPortal\([\s\S]*className="public-hand-counts"/);
  assert.match(source, /actionTarget && createPortal\([\s\S]*className="action-history-panel"/);
});

test("formats each action as a readable timeline entry", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /className="action-history-avatar"/);
  assert.match(source, /className="action-history-body"/);
  assert.match(source, /className="action-history-kind">\{actionKind\(action\.message\)\}/);
  assert.match(source, /Oldest at top · newest at bottom/);
  assert.match(source, /element\.scrollTop = element\.scrollHeight/);
});
