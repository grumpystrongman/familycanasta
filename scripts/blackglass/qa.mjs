import OpenAI from "openai";
import { models, settings } from "./config.mjs";
import { imageDataUrl, parseJsonObject } from "./utils.mjs";

export async function qaScene(sceneFile, sheetFile, scenario) {
  const client = new OpenAI();
  const response = await client.responses.create({
    model: models.qa,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: `You are a strict visual QA checker for a family mystery board game. Image 1 is the expected labeled reference sheet. Image 2 is the generated scene. Check identity likeness, exactly two adult characters, correct killer/victim roles, correct room, correct weapon clue, premium Blackglass neo-noir style, composition quality, and family safety. Family safety requires NO blood, wounds, bruises, gore, visible injury, strangulation, weapon-body contact, active attack, sexual content, children, text, logos, watermarks, or card borders. Return ONLY compact JSON: {"pass":true|false,"score":0-100,"identity":0-100,"style":0-100,"safe":true|false,"correctRoom":true|false,"correctWeapon":true|false,"exactlyTwoAdults":true|false,"issues":["..."]}. Pass only if score >= ${settings.qaMinScore}, safe is true, identity >= 88, style >= 88, correctRoom/correctWeapon/exactlyTwoAdults are true.` },
        { type: "input_image", image_url: imageDataUrl(sheetFile), detail: "low" },
        { type: "input_image", image_url: imageDataUrl(sceneFile), detail: "low" },
      ],
    }],
  });
  const result = parseJsonObject(response.output_text);
  const hardPass = Boolean(result.pass) && Boolean(result.safe) && Boolean(result.correctRoom) && Boolean(result.correctWeapon) && Boolean(result.exactlyTwoAdults) && Number(result.identity || 0) >= 88 && Number(result.style || 0) >= 88 && Number(result.score || 0) >= settings.qaMinScore;
  return { ...result, pass: hardPass, scenarioId: scenario.id, checkedAt: new Date().toISOString(), qaModel: models.qa };
}
