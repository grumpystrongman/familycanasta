import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const BLACKGLASS = path.join(ROOT, "public", "blackglass");
const ART_CSS = fs.readFileSync(path.join(HERE, "noirArt.css"), "utf8");

const suspects = ["mara-voss", "dex-vale", "imani-cross", "theo-rook", "june-mercer", "elias-flint"];
const weapons = ["nail-gun", "cleaver", "garrote", "revolver", "poison", "fire-axe"];
const rooms = ["greenhouse", "penthouse", "security", "laundry", "atrium", "kitchen", "garage", "nightclub", "boiler"];

test("Blackglass ships materially higher-resolution source art instead of thumbnail atlases", () => {
  const room = path.join(BLACKGLASS, "room-atlas-hd.webp");
  const cast = path.join(BLACKGLASS, "cast-atlas-hd.webp");
  const weaponsSvg = path.join(BLACKGLASS, "weapon-atlas-hd.svg");
  assert.equal(fs.existsSync(room), true);
  assert.equal(fs.existsSync(cast), true);
  assert.equal(fs.existsSync(weaponsSvg), true);
  assert.ok(fs.statSync(room).size > 150_000, "room source must not regress to the old tiny blurry atlas");
  assert.ok(fs.statSync(cast).size > 25_000, "cast source must retain enough portrait detail");
  assert.ok(fs.statSync(weaponsSvg).size > 2_000, "weapon atlas should remain a substantial vector source");
});

test("every playable evidence id has an explicit crop from the HD art", () => {
  for (const id of suspects) assert.match(ART_CSS, new RegExp(`#suspects-${id.replaceAll("-", "\\-")}.*background-position`));
  for (const id of weapons) assert.match(ART_CSS, new RegExp(`#weapons-${id.replaceAll("-", "\\-")}.*background-position`));
  for (const id of rooms) assert.match(ART_CSS, new RegExp(`#rooms-${id.replaceAll("-", "\\-")}.*background-position`));
  assert.match(ART_CSS, /cast-atlas-hd\.webp/);
  assert.match(ART_CSS, /weapon-atlas-hd\.svg/);
  assert.match(ART_CSS, /room-atlas-hd\.webp/);
});

test("weapon evidence is vector artwork rather than fuzzy raster scraps", () => {
  const svg = fs.readFileSync(path.join(BLACKGLASS, "weapon-atlas-hd.svg"), "utf8");
  assert.match(svg, /width="1296" height="720"/);
  assert.match(svg, /stroke="#e5c47f"/);
  assert.ok((svg.match(/<g /g) || []).length >= 6);
  assert.doesNotMatch(svg, /<image\b/);
});

test("Blackglass evidence art explicitly removes blur, tint, and blending", () => {
  assert.match(ART_CSS, /filter: none !important/);
  assert.match(ART_CSS, /mix-blend-mode: normal !important/);
  assert.doesNotMatch(ART_CSS, /blur\(/);
  assert.doesNotMatch(ART_CSS, /saturate\(/);
  assert.doesNotMatch(ART_CSS, /contrast\(/);
});
