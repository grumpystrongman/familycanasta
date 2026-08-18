import test from "node:test";
import assert from "node:assert/strict";
import { LOCATIONS, METHODS, SUSPECTS } from "./engine.js";
import { enumerateScenarioCards, scenarioCardId, scenarioCardUrl } from "./scenarioCards.js";

test("scenario card catalog has all 1,620 unique combinations", () => {
  const cards = enumerateScenarioCards(SUSPECTS, METHODS, LOCATIONS);
  assert.equal(cards.length, 1620);
  assert.equal(new Set(cards.map((card) => card.id)).size, 1620);
  assert.equal(cards.filter((card) => card.suspectId === card.victimId).length, 0);
  for (const location of LOCATIONS) assert.equal(cards.filter((card) => card.locationId === location.id).length, 180);
});

test("scenario card IDs and URLs are deterministic", () => {
  const scenario = { locationId:"penthouse", suspectId:"june-mercer", victimId:"ruby-ash", methodId:"revolver" };
  assert.equal(scenarioCardId(scenario), "penthouse__june-mercer__ruby-ash__revolver");
  assert.equal(scenarioCardUrl(scenario), "/games/bloodalibi/cards/penthouse/penthouse__june-mercer__ruby-ash__revolver.webp");
});
