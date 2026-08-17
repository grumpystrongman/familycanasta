import { LOCATIONS, METHODS, SUSPECTS } from "./engineV3.js";

export const SCENARIOS_PER_ROOM = SUSPECTS.length * (SUSPECTS.length - 1) * METHODS.length;
export const TOTAL_SCENARIO_CARDS = SCENARIOS_PER_ROOM * LOCATIONS.length;

export function scenarioCardKey({ suspectId, victimId, methodId, locationId }) {
  return `${locationId}:${suspectId}:${victimId}:${methodId}`;
}

export function buildScenarioCatalog() {
  const cards = [];
  for (const location of LOCATIONS) {
    for (const killer of SUSPECTS) {
      for (const victim of SUSPECTS) {
        if (killer.id === victim.id) continue;
        for (const method of METHODS) {
          cards.push(Object.freeze({
            key: scenarioCardKey({ suspectId:killer.id, victimId:victim.id, methodId:method.id, locationId:location.id }),
            suspectId:killer.id,
            victimId:victim.id,
            methodId:method.id,
            locationId:location.id,
          }));
        }
      }
    }
  }
  return Object.freeze(cards);
}

export const SCENARIO_CATALOG = buildScenarioCatalog();
export const SCENARIOS_BY_ROOM = Object.freeze(Object.fromEntries(
  LOCATIONS.map((location) => [location.id, Object.freeze(SCENARIO_CATALOG.filter((card) => card.locationId === location.id))]),
));

if (TOTAL_SCENARIO_CARDS !== 1620 || SCENARIO_CATALOG.length !== 1620) {
  throw new Error(`Blackglass scenario catalog expected 1620 cards, found ${SCENARIO_CATALOG.length}.`);
}
