export const SCENARIO_CARD_ROOT = "/games/bloodalibi/cards";

export function scenarioCardId({ suspectId, victimId, methodId, locationId } = {}) {
  const values = [locationId, suspectId, victimId, methodId].map((value) => String(value || "").trim());
  if (values.some((value) => !value)) return null;
  if (String(suspectId) === String(victimId)) return null;
  return values.join("__");
}

export function scenarioCardUrl(scenario) {
  const id = scenarioCardId(scenario);
  if (!id) return null;
  return `${SCENARIO_CARD_ROOT}/${scenario.locationId}/${id}.webp`;
}

export function enumerateScenarioCards(suspects, methods, locations) {
  const records = [];
  for (const location of locations) {
    for (const killer of suspects) {
      for (const victim of suspects) {
        if (killer.id === victim.id) continue;
        for (const method of methods) {
          const scenario = { suspectId: killer.id, victimId: victim.id, methodId: method.id, locationId: location.id };
          records.push({
            ...scenario,
            id: scenarioCardId(scenario),
            killerName: killer.name,
            victimName: victim.name,
            methodName: method.name,
            locationName: location.name,
            cardUrl: scenarioCardUrl(scenario),
          });
        }
      }
    }
  }
  return records;
}
