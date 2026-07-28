import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const enhancerUrl = new URL("./TableActionsTabEnhancer.jsx", import.meta.url);
const stylesUrl = new URL("./tableActionsTab.css", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("adds Table actions as a third sidebar tab", async () => {
  const source = await readFile(enhancerUrl, "utf8");

  assert.match(source, /className={`table-actions-tab-button/);
  assert.match(source, />\s*Table actions\s*<\/button>/s);
  assert.match(source, /className="table-actions-tab-content"/);
  assert.match(source, /button:not\(\.table-actions-tab-button\)/);
});

test("keeps the actions tab inside browser and sidebar boundaries", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\) !important/);
  assert.match(styles, /\.table-actions-tab-pane\s*\{[^}]*min-height:\s*0[^}]*max-width:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.table-actions-tab-content\s*\{[^}]*flex:\s*1 1 auto[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.table-actions-tab-pane \.action-history-list\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /height:\s*calc\(100dvh - 70px\)/);
  assert.match(styles, /max-height:\s*calc\(100dvh - 70px\)/);
});

test("loads the tab before action history and its CSS last", async () => {
  const main = await readFile(mainUrl, "utf8");
  const tabLoader = main.indexOf('["TableActionsTabEnhancer"');
  const historyLoader = main.indexOf('["ActionHistoryEnhancer"');
  const tabStyles = main.indexOf('import "./tableActionsTab.css";');
  const historyStyles = main.indexOf('import "./actionHistory.css";');

  assert.ok(tabLoader >= 0 && tabLoader < historyLoader);
  assert.ok(tabStyles > historyStyles);
});
