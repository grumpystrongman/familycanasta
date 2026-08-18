import path from "node:path";
import sharp from "sharp";
import { characterVisuals, findById, locations, methods, referenceRoot, sheetsRoot, suspects } from "./config.mjs";
import { ensureDir, escapeXml, exists } from "./utils.mjs";

const W = 1024;
const H = 1024;

async function fit(file, width, height) {
  return sharp(file).resize(width, height, { fit: "cover", position: "attention" }).webp({ quality: 88 }).toBuffer();
}

export async function buildReferenceSheet(scenario) {
  ensureDir(sheetsRoot);
  const dest = path.join(sheetsRoot, `${scenario.id}.webp`);
  if (exists(dest)) return dest;

  const killer = findById(suspects, scenario.suspectId);
  const victim = findById(suspects, scenario.victimId);
  const room = findById(locations, scenario.locationId);
  const method = findById(methods, scenario.methodId);
  const killerFile = path.join(referenceRoot, "characters", `${killer.id}.webp`);
  const victimFile = path.join(referenceRoot, "characters", `${victim.id}.webp`);
  const roomFile = path.join(referenceRoot, "rooms", `${room.id}.webp`);
  const methodFile = path.join(referenceRoot, "weapons", `${method.id}.webp`);
  for (const file of [killerFile, victimFile, roomFile, methodFile]) {
    if (!exists(file)) throw new Error(`Missing Blackglass reference: ${file}`);
  }

  const labelSvg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <style>.label{font-family:Georgia,serif;font-weight:700;fill:#d7b46a;font-size:25px}.sub{font-family:Arial,sans-serif;fill:#f1eadc;font-size:18px}</style>
    <rect width="1024" height="1024" fill="#050709"/>
    <rect x="18" y="18" width="988" height="988" rx="18" fill="none" stroke="#b18437" stroke-width="3"/>
    <text class="label" x="55" y="55">KILLER — ${escapeXml(killer.name)}</text>
    <text class="label" x="535" y="55">VICTIM — ${escapeXml(victim.name)}</text>
    <text class="label" x="55" y="395">LOCATION — ${escapeXml(room.name)}</text>
    <text class="label" x="535" y="395">WEAPON — ${escapeXml(method.name)}</text>
    <text class="label" x="55" y="735">STYLE TARGET — BLACKGLASS HOTEL</text>
    <text class="sub" x="55" y="765">Use the faces, room, prop and noir lighting as references. Output one scene, not this sheet.</text>
  </svg>`);

  const composites = [
    { input: labelSvg, left: 0, top: 0 },
    { input: await fit(killerFile, 430, 285), left: 55, top: 75 },
    { input: await fit(victimFile, 430, 285), left: 535, top: 75 },
    { input: await fit(roomFile, 430, 285), left: 55, top: 415 },
    { input: await fit(methodFile, 430, 285), left: 535, top: 415 },
    { input: Buffer.from(`<svg width="910" height="210" xmlns="http://www.w3.org/2000/svg"><rect width="910" height="210" fill="#050709"/><rect x="6" y="6" width="898" height="198" rx="18" fill="none" stroke="#b18437" stroke-width="3"/><text x="455" y="83" fill="#d7b46a" font-size="42" text-anchor="middle" font-family="Georgia,serif" letter-spacing="8">BLACKGLASS HOTEL</text><text x="455" y="130" fill="#eee0c5" font-size="22" text-anchor="middle" font-family="Georgia,serif">cinematic realistic neo-noir • black • gold • amber</text><text x="455" y="165" fill="#b9a37a" font-size="18" text-anchor="middle" font-family="Arial,sans-serif">premium family mystery board-game scene art</text></svg>`), left: 55, top: 790 },
  ];

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 5, g: 7, b: 9, alpha: 1 } } })
    .composite(composites)
    .webp({ quality: 90 })
    .toFile(dest);

  return dest;
}

export function scenePrompt(scenario) {
  const killer = findById(suspects, scenario.suspectId);
  const victim = findById(suspects, scenario.victimId);
  const room = findById(locations, scenario.locationId);
  const method = findById(methods, scenario.methodId);
  const weaponSafety = method.id === "poison"
    ? "The drink is only a visual clue on a nearby table."
    : method.id === "garrote"
      ? "The braided cord is a loose clue placed visibly on furniture or held lowered, never around anyone's neck."
      : "The weapon is held lowered or placed visibly nearby and never touches the victim.";
  return `Create a NEW single cinematic vertical scene for the fictional family mystery game BLACKGLASS HOTEL. The uploaded image is a labeled reference sheet only; do NOT reproduce its collage, labels, borders, or text.\n\nCAST: Killer is ${killer.name}: ${characterVisuals[killer.id]}. Victim is ${victim.name}: ${characterVisuals[victim.id]}. Match both adult fictional characters closely to the supplied portraits.\nLOCATION: ${room.name}. Match the supplied room reference.\nWEAPON CLUE: ${method.name}. Match the supplied prop reference. ${weaponSafety}\n\nCOMPOSITION: exactly two adults. Killer is standing or seated nearby with a controlled, suspicious posture. Victim is fully clothed and appears peacefully unconscious or motionless, positioned naturally on a floor, chair, sofa, or other appropriate surface. The scene should clearly communicate the four game-card facts without depicting an attack.\n\nSTYLE: luxurious modern neo-noir, realistic cinematic illustration, Blackglass Hotel black/gold/amber mood, dramatic practical lighting, high detail, believable room architecture, premium board-game key art.\n\nFAMILY-SAFE HARD RULES: no blood; no wounds; no bruises; no gore; no mutilation; no exposed injury; no strangulation; no weapon contact with a body; no active attack; no fear or suffering; no sexual content; no torn or revealing clothing; no children. No words, letters, captions, logos, watermarks, UI, frames, or borders. Output only the full-bleed cinematic scene.`;
}
