import test from "node:test";
import assert from "node:assert/strict";
import { BLACKGLASS_ITEM_ASSETS, itemAssetStyle, itemAssetUrl, theoryAssetStyles, theoryAssetUrls } from "./itemAssets.js";

test("Blackglass exposes every playable evidence item through the stable art carrier", () => {
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.suspects).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.weapons).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.rooms).length, 9);
  assert.equal(itemAssetUrl("suspect", "mara-voss"), "/games/bloodalibi/items/direct/blank.svg#suspects-mara-voss");
  assert.equal(itemAssetUrl("weapon", "cleaver"), "/games/bloodalibi/items/direct/blank.svg#weapons-cleaver");
  assert.equal(itemAssetUrl("room", "penthouse"), "/games/bloodalibi/items/direct/blank.svg#rooms-penthouse");
});

test("itemAssetUrl preserves domain aliases and gives every card a unique semantic fragment", () => {
  assert.equal(itemAssetUrl("person", "june-mercer"), "/games/bloodalibi/items/direct/blank.svg#suspects-june-mercer");
  assert.equal(itemAssetUrl("killer", "dex-vale"), "/games/bloodalibi/items/direct/blank.svg#suspects-dex-vale");
  assert.equal(itemAssetUrl("method", "revolver"), "/games/bloodalibi/items/direct/blank.svg#weapons-revolver");
  assert.equal(itemAssetUrl("location", "atrium"), "/games/bloodalibi/items/direct/blank.svg#rooms-atrium");
});

test("item styles crop the committed HD Blackglass assets without visual grading", () => {
  const suspect = itemAssetStyle("suspect", "dex-vale");
  const weapon = itemAssetStyle("weapon", "cleaver");
  const room = itemAssetStyle("room", "nightclub");
  assert.match(suspect.backgroundImage, /cast-atlas-hd\.webp/);
  assert.match(weapon.backgroundImage, /weapon-atlas-hd\.svg/);
  assert.match(room.backgroundImage, /room-atlas-hd\.webp/);
  assert.equal(suspect.backgroundSize, "600% 100%");
  assert.equal(weapon.backgroundSize, "300% 200%");
  assert.equal(room.backgroundSize, "300% 300%");
  assert.equal(suspect.backgroundPosition, "20% 50%");
});

test("theory helpers keep the same three semantic cards and HD crops", () => {
  const urls = theoryAssetUrls({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  const styles = theoryAssetStyles({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  assert.deepEqual(Object.keys(urls), ["suspect", "weapon", "room"]);
  assert.deepEqual(Object.keys(styles), ["suspect", "weapon", "room"]);
  assert.match(urls.suspect, /#suspects-june-mercer$/);
  assert.match(urls.weapon, /#weapons-revolver$/);
  assert.match(urls.room, /#rooms-penthouse$/);
  assert.match(styles.suspect.backgroundImage, /cast-atlas-hd\.webp/);
  assert.match(styles.weapon.backgroundImage, /weapon-atlas-hd\.svg/);
  assert.match(styles.room.backgroundImage, /room-atlas-hd\.webp/);
});
