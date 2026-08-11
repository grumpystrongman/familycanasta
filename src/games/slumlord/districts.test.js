import assert from "node:assert/strict";
import test from "node:test";
import { DISTRICTS, districtSchemeMultiplier } from "./districts.js";
import {
  createChaosGame,
  districtUpgradeCost,
  installScheme,
  portfolioInspectionExposure,
  rollStreetDice,
  tenantPressure,
  upgradePropertyChaos,
} from "./chaos.js";

const setup = () => createChaosGame([
  { id: "human", name: "You", isBot: false, token: "🛠️" },
  { id: "cpu", name: "CPU", isBot: true, token: "🪠" },
]);

test("all eight property groups now have distinct neighborhood personalities", () => {
  assert.equal(Object.keys(DISTRICTS).length, 8);
  assert.equal(DISTRICTS.rust.archetype, "Repair Trap");
  assert.equal(DISTRICTS.neon.archetype, "Vice Economy");
  assert.equal(DISTRICTS.gold.archetype, "Gentrification Machine");
  assert.equal(DISTRICTS.midnight.archetype, "Vertical Chaos");
  assert.notEqual(DISTRICTS.rust.inspectionMultiplier, DISTRICTS.vinyl.inspectionMultiplier);
  assert.notEqual(DISTRICTS.gold.assessmentMultiplier, DISTRICTS.rust.assessmentMultiplier);
});

test("repair pricing changes by neighborhood", () => {
  const state = setup();
  assert.equal(districtUpgradeCost(state, 1), 40, "Rust Belt repairs should be discounted");
  assert.equal(districtUpgradeCost(state, 35), 240, "Midnight Towers work should carry a high-rise premium");
});

test("schemes have neighborhood-specific fits", () => {
  assert.ok(districtSchemeMultiplier("neon", "vice-motel") > 1.2);
  assert.ok(districtSchemeMultiplier("gold", "luxury-rebrand") > districtSchemeMultiplier("rust", "luxury-rebrand"));
  assert.ok(districtSchemeMultiplier("concrete", "gang-protection") > 1);
});

test("shady schemes raise tenant pressure and legitimate improvements cool it down", () => {
  let state = setup();
  state.ownership["3"] = { ownerId: "human", upgrades: 0, mortgaged: false };
  state = installScheme(state, "human", 3, "drug-lord-lease");
  assert.equal(tenantPressure(state.ownership["3"]), 2);
  state = upgradePropertyChaos(state, "human", 3);
  assert.equal(tenantPressure(state.ownership["3"]), 1);
});

test("district inspection exposure weights identical schemes differently", () => {
  const neon = setup();
  neon.ownership["15"] = { ownerId: "human", upgrades: 0, mortgaged: false, schemeId: "drug-lord-lease", tenantPressure: 2 };
  const vinyl = setup();
  vinyl.ownership["24"] = { ownerId: "human", upgrades: 0, mortgaged: false, schemeId: "drug-lord-lease", tenantPressure: 2 };
  assert.ok(portfolioInspectionExposure(neon, "human") > portfolioInspectionExposure(vinyl, "human"));
});

test("landing on an owned property can trigger a district-specific incident", () => {
  const state = setup();
  state.ownership["3"] = { ownerId: "human", upgrades: 0, mortgaged: false, tenantPressure: 0 };
  const next = rollStreetDice(state, "cab", 3, () => 0);
  assert.equal(next.lastNeighborhoodIncident?.title, "Boiler Makes a Threat");
  assert.equal(next.lastNeighborhoodIncident?.districtName, "Rust Belt");
  assert.equal(tenantPressure(next.ownership["3"]), 1);
});

test("high tenant pressure erupts into costly pushback when the owner passes Rent Day", () => {
  const state = setup();
  state.players[0].position = 34;
  state.ownership["3"] = { ownerId: "human", upgrades: 0, mortgaged: false, tenantPressure: 5 };
  const beforeCash = state.players[0].cash;
  const next = rollStreetDice(state, "cab", 3, () => 0.99);
  assert.equal(tenantPressure(next.ownership["3"]), 3, "organized pushback should cool pressure after it costs the landlord");
  assert.ok(next.players[0].cash < beforeCash + 200 - 60, "Rent Day bonus should be offset by assessment and tenant pushback");
  assert.ok(next.pot > 0);
});
