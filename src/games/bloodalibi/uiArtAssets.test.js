import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const DIRECT = path.join(ROOT, "public", "games", "bloodalibi", "items", "direct");

const groups = {
  rooms: ["greenhouse", "penthouse", "security", "laundry", "atrium", "kitchen", "garage", "nightclub", "boiler"],
  suspects: ["mara-voss", "dex-vale", "imani-cross", "theo-rook", "june-mercer", "elias-flint"],
  weapons: ["nail-gun", "cleaver", "garrote", "revolver", "poison", "fire-axe"],
};

const atlasFor = {
  rooms: "/blackglass/room-atlas-polished.webp",
  suspects: "/blackglass/cast-atlas-polished.webp",
  weapons: "/blackglass/weapon-atlas-polished.webp",
};

test("Blackglass ships a dedicated image wrapper for every playable evidence card", () => {
  for (const [group, ids] of Object.entries(groups)) {
    for (const id of ids) {
      const file = path.join(DIRECT, group, `${id}.svg`);
      assert.equal(fs.existsSync(file), true, `missing ${group}/${id}.svg`);
      const source = fs.readFileSync(file, "utf8");
      assert.match(source, /^<svg /);
      assert.match(source, /viewBox=/);
      assert.match(source, new RegExp(atlasFor[group].replaceAll("/", "\\/")));
      assert.doesNotMatch(source, /filter=|opacity=|blur/i, `${group}/${id} must not grade or blur the approved art`);
    }
  }
});

test("room wrappers cover all nine cells of the polished three-by-three room atlas", () => {
  const expected = {
    greenhouse: ['x="0"', 'y="0"'], penthouse: ['x="-160"', 'y="0"'], security: ['x="-320"', 'y="0"'],
    laundry: ['x="0"', 'y="-100"'], atrium: ['x="-160"', 'y="-100"'], kitchen: ['x="-320"', 'y="-100"'],
    garage: ['x="0"', 'y="-200"'], nightclub: ['x="-160"', 'y="-200"'], boiler: ['x="-320"', 'y="-200"'],
  };
  for (const [id, checks] of Object.entries(expected)) {
    const source = fs.readFileSync(path.join(DIRECT, "rooms", `${id}.svg`), "utf8");
    for (const check of checks) assert.ok(source.includes(check), `${id} missing ${check}`);
    assert.match(source, /width="480" height="300"/);
  }
});

test("suspect and weapon wrappers select one atlas cell instead of exposing a whole raster strip", () => {
  for (const id of groups.suspects) {
    const source = fs.readFileSync(path.join(DIRECT, "suspects", `${id}.svg`), "utf8");
    assert.match(source, /viewBox="0 0 100 160"/);
    assert.match(source, /width="600" height="160"/);
  }
  for (const id of groups.weapons) {
    const source = fs.readFileSync(path.join(DIRECT, "weapons", `${id}.svg`), "utf8");
    assert.match(source, /viewBox="0 0 100 100"/);
    assert.match(source, /width="300" height="200"/);
  }
});
