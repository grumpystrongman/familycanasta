import test from "node:test";
import assert from "node:assert/strict";
import { BLACKGLASS_ITEM_ASSETS, itemAssetUrl, theoryAssetUrls } from "./itemAssets.js";

test("Blackglass has one asset reference for every suspect, weapon, and room", () => {
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.suspects).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.weapons).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.rooms).length, 9);
});

test("itemAssetUrl preserves domain aliases and stable crop tags", () => {
  assert.match(itemAssetUrl("person", "june-mercer"), /#blackglass-june-mercer$/);
  assert.match(itemAssetUrl("killer", "dex-vale"), /#blackglass-dex-vale$/);
  assert.match(itemAssetUrl("method", "revolver"), /#blackglass-revolver$/);
  assert.match(itemAssetUrl("location", "atrium"), /#blackglass-atrium$/);
  assert.equal(itemAssetUrl("person", "mara-voss"), "/games/bloodalibi/items/suspects/mara-voss.webp");
});

test("theoryAssetUrls returns exactly the three scenario image references", () => {
  const assets = theoryAssetUrls({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  assert.deepEqual(Object.keys(assets), ["suspect", "weapon", "room"]);
  assert.match(assets.suspect, /#blackglass-june-mercer$/);
  assert.match(assets.weapon, /#blackglass-revolver$/);
  assert.match(assets.room, /#blackglass-penthouse$/);
});
