import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const BLACKGLASS = path.join(ROOT, "public", "blackglass");
const DIRECT = path.join(ROOT, "public", "games", "bloodalibi", "items", "direct");
const artSource = fs.readFileSync(path.join(HERE, "noirArt.css"), "utf8");

const groups = {
  rooms: ["greenhouse", "penthouse", "security", "laundry", "atrium", "kitchen", "garage", "nightclub", "boiler"],
  suspects: ["mara-voss", "dex-vale", "imani-cross", "theo-rook", "june-mercer", "elias-flint"],
  weapons: ["nail-gun", "cleaver", "garrote", "revolver", "poison", "fire-axe"],
};

const atlases = {
  rooms: "room-atlas-polished.webp",
  suspects: "cast-atlas-polished.webp",
  weapons: "weapon-atlas-polished.webp",
};

test("Blackglass ships the stable carrier and all three polished source atlases", () => {
  const carrier = path.join(DIRECT, "blank.svg");
  assert.equal(fs.existsSync(carrier), true, "missing Blackglass art carrier");
  assert.match(fs.readFileSync(carrier, "utf8"), /^<svg /);

  for (const file of Object.values(atlases)) {
    const fullPath = path.join(BLACKGLASS, file);
    assert.equal(fs.existsSync(fullPath), true, `missing ${file}`);
    assert.ok(fs.statSync(fullPath).size > 7000, `${file} is unexpectedly small or empty`);
  }
});

test("every playable evidence id has an explicit CSS crop from committed Blackglass art", () => {
  for (const id of groups.suspects) assert.match(artSource, new RegExp(`#suspects-${id.replaceAll("-", "\\-")}\\"?\\]`));
  for (const id of groups.weapons) assert.match(artSource, new RegExp(`#weapons-${id.replaceAll("-", "\\-")}\\"?\\]`));
  for (const id of groups.rooms) assert.match(artSource, new RegExp(`#rooms-${id.replaceAll("-", "\\-")}\\"?\\]`));

  assert.match(artSource, /cast-atlas-polished\.webp/);
  assert.match(artSource, /weapon-atlas-polished\.webp/);
  assert.match(artSource, /room-atlas-polished\.webp/);
  assert.match(artSource, /background-size: 600% 100% !important/);
  assert.match(artSource, /background-size: 300% 200% !important/);
  assert.match(artSource, /background-size: 300% 300% !important/);
});

test("board rooms use all nine cells of the polished room atlas", () => {
  const positions = {
    greenhouse: "0% 0%", penthouse: "50% 0%", security: "100% 0%",
    laundry: "0% 50%", atrium: "50% 50%", kitchen: "100% 50%",
    garage: "0% 100%", nightclub: "50% 100%", boiler: "100% 100%",
  };

  for (const [id, position] of Object.entries(positions)) {
    assert.ok(
      artSource.includes(`.bn-room.theme-${id} { background-position: ${position} !important; }`),
      `${id} is missing its room-atlas crop`,
    );
  }
});

test("Blackglass evidence art explicitly removes blur, tint, and blending", () => {
  assert.match(artSource, /filter: none !important/);
  assert.match(artSource, /mix-blend-mode: normal !important/);
  assert.match(artSource, /opacity: 1 !important/);
  assert.doesNotMatch(artSource, /blur\(/i);
  assert.doesNotMatch(artSource, /saturate\(/i);
  assert.doesNotMatch(artSource, /brightness\(/i);
  assert.doesNotMatch(artSource, /contrast\(/i);
});
