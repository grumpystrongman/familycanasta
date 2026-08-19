import test from "node:test";
import assert from "node:assert/strict";
import { BLACKGLASS_ITEM_ASSETS, itemAssetUrl, theoryAssetUrls } from "./itemAssets.js";

test("Blackglass has one asset for every suspect, weapon, and room", () => {
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.suspects).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.weapons).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.rooms).length, 9);
});

test("itemAssetUrl accepts game-domain aliases", () => {
  assert.equal(itemAssetUrl("person", "june-mercer"), "/games/bloodalibi/items/suspects/june-mercer.webp");
  assert.equal(itemAssetUrl("killer", "dex-vale"), "/games/bloodalibi/items/suspects/dex-vale.webp");
  assert.equal(itemAssetUrl("method", "revolver"), "/games/bloodalibi/items/weapons/revolver.webp");
  assert.equal(itemAssetUrl("location", "atrium"), "/games/bloodalibi/items/rooms/atrium.webp");
});

test("theoryAssetUrls returns exactly the three scenario images", () => {
  const assets = theoryAssetUrls({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  assert.deepEqual(Object.keys(assets), ["suspect", "weapon", "room"]);
  assert.equal(assets.suspect, "/games/bloodalibi/items/suspects/june-mercer.webp");
  assert.equal(assets.weapon, "/games/bloodalibi/items/weapons/revolver.webp");
  assert.equal(assets.room, "/games/bloodalibi/items/rooms/penthouse.webp");
});
