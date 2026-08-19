import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "games", "bloodalibi", "items", "direct");

const ROOM_IDS = [
  "greenhouse", "penthouse", "security",
  "laundry", "atrium", "kitchen",
  "garage", "nightclub", "boiler",
];
const SUSPECT_IDS = ["mara-voss", "dex-vale", "imani-cross", "theo-rook", "june-mercer", "elias-flint"];
// The shipped polished cast strip is ordered by its visual source, not by the game model.
const SUSPECT_ATLAS_IDS = ["elias-flint", "dex-vale", "imani-cross", "theo-rook", "june-mercer", "mara-voss"];
const WEAPON_IDS = ["nail-gun", "cleaver", "garrote", "revolver", "poison", "fire-axe"];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function cropGrid({ source, ids, columns, rows, outputDir, width, height, fit = "cover" }) {
  const input = sharp(source, { failOn: "error" });
  const metadata = await input.metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Could not read ${source}`);
  const cellWidth = Math.floor(metadata.width / columns);
  const cellHeight = Math.floor(metadata.height / rows);
  if (cellWidth < 1 || cellHeight < 1) throw new Error(`Invalid atlas grid for ${source}`);
  await ensureDir(outputDir);

  await Promise.all(ids.map(async (id, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const left = col * cellWidth;
    const top = row * cellHeight;
    const out = path.join(outputDir, `${id}.webp`);
    let pipeline = sharp(source, { failOn: "error" })
      .extract({ left, top, width: cellWidth, height: cellHeight });

    if (fit === "contain") {
      pipeline = pipeline.resize(width, height, {
        fit: "contain",
        background: { r: 7, g: 9, b: 10, alpha: 1 },
        kernel: sharp.kernel.lanczos3,
      });
    } else {
      pipeline = pipeline.resize(width, height, {
        fit: "cover",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      });
    }

    await pipeline
      .sharpen({ sigma: 0.85, m1: 0.75, m2: 1.8 })
      .webp({ quality: 94, effort: 5, smartSubsample: true })
      .toFile(out);
  }));
}

async function validateFiles(ids, dir, minWidth, minHeight) {
  for (const id of ids) {
    const file = path.join(dir, `${id}.webp`);
    const metadata = await sharp(file).metadata();
    if ((metadata.width || 0) < minWidth || (metadata.height || 0) < minHeight) {
      throw new Error(`Generated art is too small: ${file} (${metadata.width}x${metadata.height})`);
    }
  }
}

async function main() {
  const roomsDir = path.join(OUT, "rooms");
  const suspectsDir = path.join(OUT, "suspects");
  const weaponsDir = path.join(OUT, "weapons");

  await cropGrid({
    source: path.join(PUBLIC, "blackglass", "room-atlas-polished.webp"),
    ids: ROOM_IDS,
    columns: 3,
    rows: 3,
    outputDir: roomsDir,
    width: 768,
    height: 480,
  });

  // Use the valid polished WebP strip. The older canonical JPEG is intentionally not used here:
  // that file has a malformed JPEG header in clean CI checkouts and cannot be decoded by libvips.
  await cropGrid({
    source: path.join(PUBLIC, "blackglass", "cast-atlas-polished.webp"),
    ids: SUSPECT_ATLAS_IDS,
    columns: 6,
    rows: 1,
    outputDir: suspectsDir,
    width: 360,
    height: 360,
  });

  await cropGrid({
    source: path.join(PUBLIC, "blackglass", "weapon-atlas-polished.webp"),
    ids: WEAPON_IDS,
    columns: 3,
    rows: 2,
    outputDir: weaponsDir,
    width: 432,
    height: 360,
    fit: "contain",
  });

  await validateFiles(ROOM_IDS, roomsDir, 700, 430);
  await validateFiles(SUSPECT_IDS, suspectsDir, 320, 320);
  await validateFiles(WEAPON_IDS, weaponsDir, 400, 320);

  console.log(`Blackglass direct UI art ready in ${path.relative(ROOT, OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
