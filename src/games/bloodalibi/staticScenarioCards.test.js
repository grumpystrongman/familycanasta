import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIO_CATALOG } from "./scenarioCatalog.js";
import { BLACKGLASS_STATIC_CARD_PIPELINE, staticScenarioCardSrc, staticScenarioCardStem } from "./staticScenarioCards.js";

test("static Blackglass card paths are unique for all 1620 scenarios", () => {
  const paths = SCENARIO_CATALOG.map(staticScenarioCardSrc);
  assert.equal(paths.length, 1620);
  assert.equal(new Set(paths).size, 1620);
  assert.ok(paths.every((src) => src.startsWith("/blackglass/cards/")));
  assert.equal(BLACKGLASS_STATIC_CARD_PIPELINE, "blackglass-static-card-v1");
});

test("static card path matches room/killer/victim/weapon filename contract", () => {
  const scenario = { locationId:"penthouse", suspectId:"june-mercer", victimId:"ruby-ash", methodId:"revolver" };
  assert.equal(staticScenarioCardStem(scenario), "penthouse__june-mercer__ruby-ash__revolver");
  assert.equal(staticScenarioCardSrc(scenario), "/blackglass/cards/penthouse/penthouse__june-mercer__ruby-ash__revolver.webp");
});

test("invalid killer/victim identity does not resolve to a static card", () => {
  const scenario = { locationId:"penthouse", suspectId:"ruby-ash", victimId:"ruby-ash", methodId:"revolver" };
  assert.equal(staticScenarioCardStem(scenario), "");
  assert.equal(staticScenarioCardSrc(scenario), "");
});
