import test from "node:test";
import assert from "node:assert/strict";
import { BLACKGLASS_ITEM_ASSETS, itemAssetStyle, itemAssetUrl, theoryAssetStyles, theoryAssetUrls } from "./itemAssets.js";

function expectSvgDataUrl(value) {
  assert.match(value, /^data:image\/svg\+xml;charset=utf-8,/);
  assert.ok(value.length > 500, "artwork data URL is unexpectedly small");
}

test("Blackglass exposes crisp direct artwork for every playable evidence item", () => {
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.suspects).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.weapons).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.rooms).length, 9);
  expectSvgDataUrl(itemAssetUrl("suspect", "mara-voss"));
  expectSvgDataUrl(itemAssetUrl("weapon", "cleaver"));
  expectSvgDataUrl(itemAssetUrl("room", "penthouse"));
});

test("itemAssetUrl preserves domain aliases and keeps every item visually distinct", () => {
  expectSvgDataUrl(itemAssetUrl("person", "june-mercer"));
  expectSvgDataUrl(itemAssetUrl("killer", "dex-vale"));
  expectSvgDataUrl(itemAssetUrl("method", "revolver"));
  expectSvgDataUrl(itemAssetUrl("location", "atrium"));
  const urls = Object.values(BLACKGLASS_ITEM_ASSETS).flatMap((bucket) => Object.values(bucket));
  assert.equal(new Set(urls).size, 21);
});

test("item styles render each direct source at full quality without atlas cropping", () => {
  const suspect = itemAssetStyle("suspect", "dex-vale");
  const weapon = itemAssetStyle("weapon", "cleaver");
  const room = itemAssetStyle("room", "nightclub");
  assert.match(suspect.backgroundImage, /^url\("data:image\/svg\+xml/);
  assert.match(weapon.backgroundImage, /^url\("data:image\/svg\+xml/);
  assert.match(room.backgroundImage, /^url\("data:image\/svg\+xml/);
  assert.equal(suspect.backgroundSize, "cover");
  assert.equal(weapon.backgroundSize, "cover");
  assert.equal(room.backgroundSize, "cover");
  assert.equal(suspect.backgroundPosition, "center");
});

test("theory helpers keep the same three semantic cards with direct noir artwork", () => {
  const urls = theoryAssetUrls({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  const styles = theoryAssetStyles({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  assert.deepEqual(Object.keys(urls), ["suspect", "weapon", "room"]);
  assert.deepEqual(Object.keys(styles), ["suspect", "weapon", "room"]);
  expectSvgDataUrl(urls.suspect);
  expectSvgDataUrl(urls.weapon);
  expectSvgDataUrl(urls.room);
  assert.match(styles.suspect.backgroundImage, /^url\("data:image\/svg\+xml/);
  assert.match(styles.weapon.backgroundImage, /^url\("data:image\/svg\+xml/);
  assert.match(styles.room.backgroundImage, /^url\("data:image\/svg\+xml/);
});
