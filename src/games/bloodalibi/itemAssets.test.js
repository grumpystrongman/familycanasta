import test from "node:test";
import assert from "node:assert/strict";
import { BLACKGLASS_ITEM_ASSETS, itemAssetUrl, theoryAssetUrls } from "./itemAssets.js";

test("Blackglass has one asset for every suspect, weapon, and room", () => {
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.suspects).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.weapons).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.rooms).length, 9);
});

test("itemAssetUrl accepts game-domain aliases and points at production art", () => {
  assert.equal(itemAssetUrl("person", "june-mercer"), "/games/bloodalibi/items/suspects/june-mercer.svg");
  assert.equal(itemAssetUrl("killer", "dex-vale"), "/games/bloodalibi/items/suspects/dex-vale.svg");
  assert.equal(itemAssetUrl("method", "revolver"), "/games/bloodalibi/items/weapons/revolver.svg");
  assert.equal(itemAssetUrl("location", "atrium"), "/games/bloodalibi/items/rooms/atrium.svg");
  assert.equal(itemAssetUrl("person", "mara-voss"), "/games/bloodalibi/items/suspects/mara-voss.webp");
});

test("theoryAssetUrls returns exactly the three scenario images", () => {
  const assets = theoryAssetUrls({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  assert.deepEqual(Object.keys(assets), ["suspect", "weapon", "room"]);
  assert.equal(assets.suspect, "/games/bloodalibi/items/suspects/june-mercer.svg");
  assert.equal(assets.weapon, "/games/bloodalibi/items/weapons/revolver.svg");
  assert.equal(assets.room, "/games/bloodalibi/items/rooms/penthouse.svg");
});
