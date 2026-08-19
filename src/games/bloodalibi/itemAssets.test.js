import test from "node:test";
import assert from "node:assert/strict";
import { BLACKGLASS_ITEM_ASSETS, itemAssetStyle, itemAssetUrl, theoryAssetStyles, theoryAssetUrls } from "./itemAssets.js";

test("Blackglass has asset references for the full current cast, weapons, and rooms", () => {
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.suspects).length, 7);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.weapons).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.rooms).length, 9);
  assert.match(itemAssetUrl("suspect", "ruby-ash"), /#blackglass-ruby-ash$/);
});

test("itemAssetUrl preserves domain aliases and stable crop tags", () => {
  assert.match(itemAssetUrl("person", "june-mercer"), /#blackglass-june-mercer$/);
  assert.match(itemAssetUrl("killer", "dex-vale"), /#blackglass-dex-vale$/);
  assert.match(itemAssetUrl("method", "revolver"), /#blackglass-revolver$/);
  assert.match(itemAssetUrl("location", "atrium"), /room-atlas-polished\.webp#blackglass-atrium$/);
  assert.equal(itemAssetUrl("person", "mara-voss"), "/games/bloodalibi/items/suspects/mara-voss.webp");
});

test("sprite styles crop the canonical atlases instead of exposing placeholder pixels", () => {
  assert.match(itemAssetStyle("suspect", "dex-vale").backgroundImage, /canonical-cast-atlas\.jpg/);
  assert.equal(itemAssetStyle("suspect", "dex-vale").backgroundSize, "700% 100%");
  assert.match(itemAssetStyle("weapon", "cleaver").backgroundImage, /weapon-atlas\.jpg/);
  assert.equal(itemAssetStyle("weapon", "cleaver").backgroundPosition, "50% 0%");
  assert.match(itemAssetStyle("room", "nightclub").backgroundImage, /room-atlas-polished\.webp/);
  assert.equal(itemAssetStyle("room", "nightclub").backgroundPosition, "50% 100%");
});

test("theory asset helpers return exactly the three scenario visuals", () => {
  const urls = theoryAssetUrls({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  const styles = theoryAssetStyles({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  assert.deepEqual(Object.keys(urls), ["suspect", "weapon", "room"]);
  assert.deepEqual(Object.keys(styles), ["suspect", "weapon", "room"]);
  assert.match(urls.suspect, /#blackglass-june-mercer$/);
  assert.match(urls.weapon, /#blackglass-revolver$/);
  assert.match(urls.room, /#blackglass-penthouse$/);
});
