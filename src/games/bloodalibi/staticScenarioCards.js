import { scenarioCardKey } from "./scenarioCatalog.js";

export const BLACKGLASS_STATIC_CARD_PIPELINE = "blackglass-static-card-v1";
export const BLACKGLASS_STATIC_CARD_ROOT = "/blackglass/cards";

function safeId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function staticScenarioCardStem({ locationId, suspectId, victimId, methodId }) {
  if (!locationId || !suspectId || !victimId || !methodId) return "";
  if (suspectId === victimId) return "";
  return [locationId, suspectId, victimId, methodId].map(safeId).join("__");
}

export function staticScenarioCardSrc(scenario) {
  const stem = staticScenarioCardStem(scenario || {});
  if (!stem) return "";
  return `${BLACKGLASS_STATIC_CARD_ROOT}/${safeId(scenario.locationId)}/${stem}.webp`;
}

export function staticScenarioCardKey(scenario) {
  if (!staticScenarioCardStem(scenario || {})) return "";
  return scenarioCardKey(scenario);
}
