import path from "node:path";
import sharp from "sharp";
import { referenceRoot, suspects } from "./config.mjs";
import { ensureDir, exists } from "./utils.mjs";

const characterDir = path.join(referenceRoot, "characters");
ensureDir(characterDir);
const atlas = path.join(referenceRoot, "canonical-cast-atlas.jpg");
if (!exists(atlas)) {
  console.log("No canonical cast atlas committed; character portraits will be generated once by blackglass:reference-art.");
  process.exit(0);
}

const metadata = await sharp(atlas).metadata();
const cell = Number(metadata.height || 256);
if (!metadata.width || metadata.width < cell * (suspects.length + 1)) throw new Error(`Cast atlas must contain one lead-in cell plus ${suspects.length} portraits.`);
for (let i = 0; i < suspects.length; i += 1) {
  const person = suspects[i];
  const dest = path.join(characterDir, `${person.id}.webp`);
  if (exists(dest)) continue;
  await sharp(atlas).extract({ left: cell * (i + 1), top: 0, width: cell, height: cell }).resize(512, 512, { fit: "cover" }).webp({ quality: 90 }).toFile(dest);
  console.log(`Prepared portrait from atlas: ${person.name}`);
}
