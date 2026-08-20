import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ART_CSS = fs.readFileSync(new URL("./noirArt.css", import.meta.url), "utf8");
const ART_JS = fs.readFileSync(new URL("./noirArtwork.js", import.meta.url), "utf8");

const suspects = ["mara-voss", "dex-vale", "imani-cross", "theo-rook", "june-mercer", "elias-flint"];
const weapons = ["nail-gun", "cleaver", "garrote", "revolver", "poison", "fire-axe"];
const rooms = ["greenhouse", "penthouse", "security", "laundry", "atrium", "kitchen", "garage", "nightclub", "boiler"];

test("Blackglass artwork is generated as resolution-independent SVG rather than tiny raster atlases", () => {
  assert.match(ART_JS, /data:image\/svg\+xml/);
  assert.match(ART_JS, /viewBox="0 0 420 300"/);
  assert.match(ART_JS, /viewBox="0 0 240 320"/);
  assert.match(ART_JS, /viewBox="0 0 250 250"/);
  assert.doesNotMatch(ART_JS, /atlas-polished|atlas-hd|\.webp/);
});

test("all nine rooms have unique illustrated builders with integrated noir plaques", () => {
  for (const id of rooms) assert.match(ART_JS, new RegExp(`function ${id}\\(`));
  assert.match(ART_JS, /ROOFTOP","GREENHOUSE/);
  assert.match(ART_JS, /PENTHOUSE","SUITE/);
  assert.match(ART_JS, /SECURITY","OFFICE/);
  assert.match(ART_JS, /LAUNDRY","TUNNEL/);
  assert.match(ART_JS, /GLASS","ATRIUM/);
  assert.match(ART_JS, /SERVICE","KITCHEN/);
  assert.match(ART_JS, /PARKING","GARAGE/);
  assert.match(ART_JS, /BASEMENT","NIGHTCLUB/);
  assert.match(ART_JS, /BOILER","ROOM/);
});

test("all suspects and weapons are present as crisp direct vector artwork", () => {
  for (const id of suspects) assert.match(ART_JS, new RegExp(`"${id}"`));
  for (const id of weapons) assert.match(ART_JS, new RegExp(`"${id}"`));
  assert.match(ART_JS, /const SUSPECT_META/);
  assert.match(ART_JS, /function suspectSvg/);
  assert.match(ART_JS, /function weaponSvg/);
});

test("Blackglass evidence art explicitly removes blur, tint, and blending", () => {
  assert.match(ART_CSS, /filter: none !important/);
  assert.match(ART_CSS, /mix-blend-mode: normal !important/);
  assert.doesNotMatch(ART_CSS, /blur\(/);
  assert.doesNotMatch(ART_CSS, /saturate\(/);
  assert.doesNotMatch(ART_CSS, /contrast\(/);
});
