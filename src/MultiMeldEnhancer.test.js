import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const enhancerUrl = new URL("./MultiMeldEnhancer.jsx", import.meta.url);
const stylesUrl = new URL("./multiMeld.css", import.meta.url);

test("uses a dedicated grouped-play button and only adjusts the core button for single-rank melds", async () => {
  const source = await readFile(enhancerUrl, "utf8");

  assert.match(source, /className="multi-meld-button"/);
  assert.match(source, /playGroupedMelds\(roomCode, uid, selectedIds\)/);
  assert.match(source, /primaryButton\.hidden = true/);
  assert.match(source, /if \(!usesGroupedAction\)[\s\S]*primaryButton\.disabled = !canAct \|\| busy/s);
  assert.match(source, /combinedWilds\.length <= combinedNaturals\.length/);
  assert.doesNotMatch(source, /primaryButton\.addEventListener\("click"/);
});

test("tracks authentication and preserves exact selected card identities", async () => {
  const source = await readFile(enhancerUrl, "utf8");

  assert.match(source, /onAuthStateChanged/);
  assert.match(source, /wrap\.dataset\.cardId/);
  assert.match(source, /selectedIdsFromRenderedHand/);
});

test("shows the actual support cards required for a pending discard pickup", async () => {
  const source = await readFile(enhancerUrl, "utf8");

  assert.match(source, /pendingPickup\?\.supportDescription/);
  assert.match(source, /\{pendingSupportDescription\} from your original hand/);
  assert.doesNotMatch(source, /picked-up \{pendingPickup\.rank\}, two natural \{pendingPickup\.rank\}s/);
});

test("gives grouped controls their own full-width responsive layout", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.selection-advisor\.grouped-meld-mode > \.multi-meld-tools\s*\{/);
  assert.match(styles, /\.multi-meld-button\s*\{[^}]*flex:\s*1 1 280px/s);
  assert.match(styles, /@media \(max-width: 850px\)/);
});
