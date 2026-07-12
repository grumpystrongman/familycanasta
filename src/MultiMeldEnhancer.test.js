import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const enhancerUrl = new URL("./MultiMeldEnhancer.jsx", import.meta.url);
const stylesUrl = new URL("./multiMeld.css", import.meta.url);

test("uses a dedicated grouped-play button instead of racing the core disabled button", async () => {
  const source = await readFile(enhancerUrl, "utf8");

  assert.match(source, /className="multi-meld-button"/);
  assert.match(source, /playGroupedMelds\(roomCode, uid, selectedIds\)/);
  assert.match(source, /primaryButton\.hidden = true/);
  assert.doesNotMatch(source, /primaryButton\.disabled\s*=/);
  assert.doesNotMatch(source, /primaryButton\.addEventListener\("click"/);
});

test("tracks authentication and preserves exact selected card identities", async () => {
  const source = await readFile(enhancerUrl, "utf8");

  assert.match(source, /onAuthStateChanged/);
  assert.match(source, /wrap\.dataset\.cardId/);
  assert.match(source, /selectedIdsFromRenderedHand/);
});

test("gives grouped controls their own full-width responsive layout", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.selection-advisor\.grouped-meld-mode > \.multi-meld-tools\s*\{/);
  assert.match(styles, /\.multi-meld-button\s*\{[^}]*flex:\s*1 1 280px/s);
  assert.match(styles, /@media \(max-width: 850px\)/);
});
