import test from "node:test";
import assert from "node:assert/strict";
import {
  BLACKGLASS_ART_CARRIER,
  BLACKGLASS_ITEM_ASSETS,
  itemAssetStyle,
  itemAssetUrl,
  theoryAssetStyles,
  theoryAssetUrls,
} from "./itemAssets.js";

test("Blackglass exposes every playable evidence item through the stable art carrier", () => {
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.suspects).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.weapons).length, 6);
  assert.equal(Object.keys(BLACKGLASS_ITEM_ASSETS.rooms).length, 9);
  assert.equal(BLACKGLASS_ART_CARRIER, "/games/bloodalibi/items/direct/blank.svg");
  assert.equal(itemAssetUrl("suspect", "mara-voss"), `${BLACKGLASS_ART_CARRIER}#suspects-mara-voss`);
  assert.equal(itemAssetUrl("weapon", "cleaver"), `${BLACKGLASS_ART_CARRIER}#weapons-cleaver`);
  assert.equal(itemAssetUrl("room", "penthouse"), `${BLACKGLASS_ART_CARRIER}#rooms-penthouse`);
});

test("itemAssetUrl preserves domain aliases and gives every card a unique semantic fragment", () => {
  assert.equal(itemAssetUrl("person", "june-mercer"), `${BLACKGLASS_ART_CARRIER}#suspects-june-mercer`);
  assert.equal(itemAssetUrl("killer", "dex-vale"), `${BLACKGLASS_ART_CARRIER}#suspects-dex-vale`);
  assert.equal(itemAssetUrl("method", "revolver"), `${BLACKGLASS_ART_CARRIER}#weapons-revolver`);
  assert.equal(itemAssetUrl("location", "atrium"), `${BLACKGLASS_ART_CARRIER}#rooms-atrium`);

  const urls = Object.values(BLACKGLASS_ITEM_ASSETS).flatMap((bucket) => Object.values(bucket));
  assert.equal(new Set(urls).size, 21);
  for (const src of urls) {
    assert.match(src, /\/games\/bloodalibi\/items\/direct\/blank\.svg#/);
    assert.doesNotMatch(src, /atlas/i);
  }
});

test("item styles crop the polished committed Blackglass atlases without visual grading", () => {
  const suspect = itemAssetStyle("suspect", "dex-vale");
  const weapon = itemAssetStyle("weapon", "cleaver");
  const room = itemAssetStyle("room", "nightclub");

  assert.equal(suspect.backgroundImage, 'url("/blackglass/cast-atlas-polished.webp")');
  assert.equal(suspect.backgroundSize, "600% 100%");
  assert.equal(suspect.backgroundPosition, "20% 50%");

  assert.equal(weapon.backgroundImage, 'url("/blackglass/weapon-atlas-polished.webp")');
  assert.equal(weapon.backgroundSize, "300% 200%");
  assert.equal(weapon.backgroundPosition, "50% 0%");

  assert.equal(room.backgroundImage, 'url("/blackglass/room-atlas-polished.webp")');
  assert.equal(room.backgroundSize, "300% 300%");
  assert.equal(room.backgroundPosition, "50% 100%");
});

test("theory helpers keep the same three semantic cards and polished atlas crops", () => {
  const urls = theoryAssetUrls({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
  const styles = theoryAssetStyles({ suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });

  assert.deepEqual(Object.keys(urls), ["suspect", "weapon", "room"]);
  assert.deepEqual(Object.keys(styles), ["suspect", "weapon", "room"]);
  assert.match(urls.suspect, /blank\.svg#suspects-june-mercer$/);
  assert.match(urls.weapon, /blank\.svg#weapons-revolver$/);
  assert.match(urls.room, /blank\.svg#rooms-penthouse$/);
  assert.match(styles.suspect.backgroundImage, /cast-atlas-polished\.webp/);
  assert.match(styles.weapon.backgroundImage, /weapon-atlas-polished\.webp/);
  assert.match(styles.room.backgroundImage, /room-atlas-polished\.webp/);
});
