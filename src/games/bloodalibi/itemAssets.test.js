import test from "node:test";
import assert from "node:assert/strict";
import { BLACKGLASS_ITEM_ASSETS, itemAssetStyle, itemAssetUrl, theoryAssetStyles, theoryAssetUrls } from "./itemAssets.js";

test("Blackglass has direct asset references for every playable suspect, weapon, and room", () => {
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.suspects).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.weapons).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.rooms).length, 9);
  assert.equal(itemAssetUrl("suspect", "mara-voss"), "/games/bloodalibi/items/direct/suspects/mara-voss.webp");
  assert.equal(itemAssetUrl("weapon", "cleaver"), "/games/bloodalibi/items/direct/weapons/cleaver.webp");
  assert.equal(itemAssetUrl("room", "penthouse"), "/games/bloodalibi/items/direct/rooms/penthouse.webp");
});

test("itemAssetUrl preserves domain aliases without raster crop fragments", () => {
  assert.equal(itemAssetUrl("person", "june-mercer"), "/games/bloodalibi/items/direct/suspects/june-mercer.webp");
  assert.equal(itemAssetUrl("killer", "dex-vale"), "/games/bloodalibi/items/direct/suspects/dex-vale.webp");
  assert.equal(itemAssetUrl("method", "revolver"), "/games/bloodalibi/items/direct/weapons/revolver.webp");
  assert.equal(itemAssetUrl("location", "atrium"), "/games/bloodalibi/items/direct/rooms/atrium.webp");
  for (const bucket of Object.values(BLACKGLASS_ITEM_ASSETS)) {
    for (const src of Object.values(bucket)) {
      assert.match(src, /\.webp$/);
      assert.doesNotMatch(src, /#/);
      assert.doesNotMatch(src, /atlas/i);
    }
  }
});

test("item styles reference the same direct image instead of atlas background positions", () => {
  const suspect = itemAssetStyle("suspect", "dex-vale");
  const weapon = itemAssetStyle("weapon", "cleaver");
  const room = itemAssetStyle("room", "nightclub");
  assert.match(suspect.backgroundImage, /direct\/suspects\/dex-vale\.webp/);
  assert.match(weapon.backgroundImage, /direct\/weapons\/cleaver\.webp/);
  assert.match(room.backgroundImage, /direct\/rooms\/nightclub\.webp/);
  assert.equal(suspect.backgroundSize, "cover");
  assert.equal("backgroundPositionX" in suspect, false);
});

test("theory asset helpers return exactly the three direct scenario visuals", () => {
  const urls = theoryAssetUrls({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  const styles = theoryAssetStyles({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  assert.deepEqual(Object.keys(urls), ["suspect", "weapon", "room"]);
  assert.deepEqual(Object.keys(styles), ["suspect", "weapon", "room"]);
  assert.match(urls.suspect, /direct\/suspects\/june-mercer\.webp$/);
  assert.match(urls.weapon, /direct\/weapons\/revolver\.webp$/);
  assert.match(urls.room, /direct\/rooms\/penthouse\.webp$/);
});
