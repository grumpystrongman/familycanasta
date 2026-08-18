import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { characterVisuals, locations, methods, models, referenceRoot, roomVisuals, methodVisuals, suspects } from "./config.mjs";
import { ensureDir, exists, sleep } from "./utils.mjs";

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to generate missing Blackglass reference art.");
const client = new OpenAI();
const characterDir = path.join(referenceRoot, "characters");
const roomDir = path.join(referenceRoot, "rooms");
const weaponDir = path.join(referenceRoot, "weapons");
ensureDir(characterDir);
ensureDir(roomDir);
ensureDir(weaponDir);

async function generate({ dest, prompt, model = models.reference, quality = "medium" }) {
  if (exists(dest)) return;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.images.generate({
        model,
        prompt,
        size: "1024x1024",
        quality,
        output_format: "webp",
        output_compression: 88,
        moderation: "auto",
      });
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("Image API returned no image data.");
      fs.writeFileSync(dest, Buffer.from(b64, "base64"));
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(attempt * 2500);
    }
  }
}

for (const person of suspects) {
  const dest = path.join(characterDir, `${person.id}.webp`);
  await generate({
    dest,
    model: models.character,
    quality: "medium",
    prompt: `Create the canonical character portrait for BLACKGLASS HOTEL: ${person.name}, ${characterVisuals[person.id]}. Adult fictional character. Chest-up portrait facing camera, dark luxurious hotel interior, realistic cinematic neo-noir illustration, black/gold/amber lighting, premium board-game key art, neutral serious expression. No text, no logo, no weapon, no blood, no injury, no violence, no sexual content. Keep the face distinctive and easy to recognize across future scene edits.`,
  });
  console.log(`Character reference ready: ${person.name}`);
}

for (const room of locations) {
  const dest = path.join(roomDir, `${room.id}.webp`);
  await generate({
    dest,
    prompt: `Create a clean square environment reference for the Blackglass Hotel mystery game: ${roomVisuals[room.id]}. No people. No text. No blood, injury, violence, logos, or UI. Cinematic realistic noir environment art, black/gold luxury mood, readable interior details, family-game appropriate.`,
  });
  console.log(`Room reference ready: ${room.name}`);
}

for (const method of methods) {
  const dest = path.join(weaponDir, `${method.id}.webp`);
  await generate({
    dest,
    prompt: `Create a clean square prop reference for the Blackglass Hotel mystery game: ${methodVisuals[method.id]}. Centered object on a dark neutral luxury display surface, cinematic realistic product lighting, no people, no text, no injury, no blood, no active violence, family-game appropriate.`,
  });
  console.log(`Weapon reference ready: ${method.name}`);
}
