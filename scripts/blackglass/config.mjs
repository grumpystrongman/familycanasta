import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCATIONS, METHODS, SUSPECTS } from "../../src/games/bloodalibi/engine.js";
import { enumerateScenarioCards } from "../../src/games/bloodalibi/scenarioCards.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");
export const publicRoot = path.join(repoRoot, "public/games/bloodalibi");
export const referenceRoot = path.join(publicRoot, "references");
export const cardsRoot = path.join(publicRoot, "cards");
export const scenesRoot = path.join(publicRoot, "scenes");
export const workRoot = path.join(repoRoot, "artifacts/blackglass");
export const qaRoot = path.join(workRoot, "qa");
export const sheetsRoot = path.join(workRoot, "reference-sheets");

export const suspects = SUSPECTS;
export const methods = METHODS;
export const locations = LOCATIONS;
export const scenarios = enumerateScenarioCards(SUSPECTS, METHODS, LOCATIONS);

export const characterVisuals = Object.freeze({
  "dex-vale": "adult man, dark hair, trimmed dark beard, tailored charcoal suit, controlled stern expression",
  "imani-cross": "adult Black woman, short natural curls, tailored black suit and ivory blouse, composed analytical expression",
  "theo-rook": "older adult man, silver-gray hair, clean-shaven, dark formal suit, severe dignified expression",
  "june-mercer": "adult blonde woman with shoulder-length waves, elegant black evening dress, poised confident expression",
  "elias-flint": "adult man, dark wavy hair, rugged dark beard, dark suit with open collar, intense expression",
  "ruby-ash": "adult woman with auburn-red wavy hair, deep burgundy evening dress, elegant composed appearance",
});

export const roomVisuals = Object.freeze({
  greenhouse: "luxury rooftop greenhouse at night, glass walls, lush plants, warm practical lights, city skyline",
  penthouse: "luxury penthouse bedroom suite at night, dark wood, amber lamps, floor-to-ceiling skyline windows",
  security: "luxury hotel security office, wall of surveillance monitors, dark metal consoles, cool blue monitor glow",
  laundry: "industrial hotel laundry tunnel, washers, linen carts, pipes, wet concrete, warm service lights",
  atrium: "grand circular glass hotel atrium, dramatic glass dome, polished dark floor, plants, elegant architectural lighting",
  kitchen: "high-end hotel service kitchen, stainless counters, hanging equipment, warm low night lighting",
  garage: "upscale underground hotel parking garage, polished concrete, dark luxury cars, cinematic pools of light",
  nightclub: "art-deco basement nightclub after closing, purple and amber accent lighting, lounge seating, empty dance floor",
  boiler: "hotel boiler room, copper and steel pipes, valves, gauges, warm furnace glow, cinematic shadows",
});

export const methodVisuals = Object.freeze({
  "nail-gun": "yellow-and-black industrial nail gun, clean product-style prop, no blood",
  cleaver: "heavy butcher's cleaver with dark wood handle, clean prop, no blood",
  garrote: "braided dark cord garrote arranged as a neat loop, clean prop",
  revolver: "ornate antique revolver with wood grip, clean museum-display prop",
  poison: "crystal whiskey tumbler and elegant decanter suggesting a poisoned nightcap, no hazard symbols, clean prop",
  "fire-axe": "classic red-headed fire axe with wood handle, clean emergency-equipment prop",
});

export const models = Object.freeze({
  reference: process.env.BLACKGLASS_REFERENCE_MODEL || "gpt-image-1-mini",
  character: process.env.BLACKGLASS_CHARACTER_MODEL || "gpt-image-1",
  scene: process.env.BLACKGLASS_SCENE_MODEL || "gpt-image-1",
  qa: process.env.BLACKGLASS_QA_MODEL || "gpt-5-nano",
});

export const settings = Object.freeze({
  qaMinScore: Number(process.env.BLACKGLASS_QA_MIN_SCORE || 92),
  concurrency: Math.max(1, Number(process.env.BLACKGLASS_CONCURRENCY || 2)),
  cardQuality: Math.min(100, Math.max(40, Number(process.env.BLACKGLASS_CARD_QUALITY || 82))),
  roomFilter: String(process.env.BLACKGLASS_ROOM || "").trim(),
  limit: Math.max(0, Number(process.env.BLACKGLASS_LIMIT || 0)),
});

export function findById(items, id) {
  return items.find((item) => item.id === id);
}

export function selectScenarios() {
  let selected = scenarios;
  if (settings.roomFilter) selected = selected.filter((item) => item.locationId === settings.roomFilter);
  if (settings.limit) selected = selected.slice(0, settings.limit);
  return selected;
}
