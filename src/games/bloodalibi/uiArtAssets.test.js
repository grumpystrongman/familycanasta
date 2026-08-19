import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const MATERIALIZER = path.join(ROOT, "scripts", "blackglass", "materialize-ui-assets.mjs");
const DIRECT = path.join(ROOT, "public", "games", "bloodalibi", "items", "direct");

const groups = {
  rooms: ["greenhouse", "penthouse", "security", "laundry", "atrium", "kitchen", "garage", "nightclub", "boiler"],
  suspects: ["mara-voss", "dex-vale", "imani-cross", "theo-rook", "june-mercer", "elias-flint"],
  weapons: ["nail-gun", "cleaver", "garrote", "revolver", "poison", "fire-axe"],
};

test("Blackglass materializer creates complete standalone WebP art", async () => {
  execFileSync(process.execPath, [MATERIALIZER], { cwd: ROOT, stdio: "pipe" });

  for (const [group, ids] of Object.entries(groups)) {
    for (const id of ids) {
      const file = path.join(DIRECT, group, `${id}.webp`);
      assert.equal(fs.existsSync(file), true, `missing ${group}/${id}.webp`);
      const stat = fs.statSync(file);
      assert.ok(stat.size > 2500, `${group}/${id}.webp is unexpectedly small`);
      const meta = await sharp(file).metadata();
      assert.equal(meta.format, "webp");
      if (group === "rooms") {
        assert.ok(meta.width >= 700 && meta.height >= 430, `${id} room art must be board resolution`);
      } else if (group === "suspects") {
        assert.ok(meta.width >= 320 && meta.height >= 320, `${id} portrait must be thumbnail resolution`);
      } else {
        assert.ok(meta.width >= 400 && meta.height >= 320, `${id} weapon art must be evidence-card resolution`);
      }
    }
  }
});
