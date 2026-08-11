import assert from "node:assert/strict";
import test from "node:test";
import { BOARD } from "./data.js";
import {
  calculateChaosNetWorth,
  canChaosUpgrade,
  createChaosGame,
  finishChaosTurn,
  installScheme,
  portfolioHeat,
  rollStreetDice,
  upgradePropertyChaos,
} from "./chaos.js";

const setup = () => createChaosGame([
  { id: "human", name: "You", isBot: false, token: "🛠️" },
  { id: "cpu", name: "CPU", isBot: true, token: "🪠" },
]);

test("Slum Lord no longer uses an arbitrary round cap by default", () => {
  const state = setup();
  assert.equal(state.roundLimit, null);
  assert.equal(state.goalMode, "bankruptcy");
});

test("a landlord can improve a property twice before completing its color group", () => {
  let state = setup();
  state.ownership["1"] = { ownerId: "human", upgrades: 0, mortgaged: false };
  assert.equal(canChaosUpgrade(state, "human", 1), true);
  state = upgradePropertyChaos(state, "human", 1);
  assert.equal(state.ownership["1"].upgrades, 1);
  assert.equal(canChaosUpgrade(state, "human", 1), true);
  state = upgradePropertyChaos(state, "human", 1);
  assert.equal(state.ownership["1"].upgrades, 2);
  assert.equal(canChaosUpgrade(state, "human", 1), false, "level 3 should require the complete group");
});

test("property schemes trade cash for rent pressure and Heat", () => {
  let state = setup();
  state.ownership["3"] = { ownerId: "human", upgrades: 0, mortgaged: false };
  const beforeCash = state.players[0].cash;
  state = installScheme(state, "human", 3, "drug-lord-lease");
  assert.equal(state.ownership["3"].schemeId, "drug-lord-lease");
  assert.equal(portfolioHeat(state, "human"), 3);
  assert.ok(state.players[0].cash < beforeCash);
  assert.ok(calculateChaosNetWorth(state, "human") > state.players[0].cash + BOARD[3].price);
});

test("the sketchy cab gives exact tactical movement and charges for it", () => {
  const state = setup();
  const beforeCash = state.players[0].cash;
  const next = rollStreetDice(state, "cab", 5);
  assert.equal(next.players[0].position, 5);
  assert.equal(next.players[0].cash, beforeCash - 60);
  assert.deepEqual(next.dice, [1, 4]);
  assert.equal(next.extraTurn, false);
});

test("empire mode ends on an objective instead of a round count", () => {
  let state = createChaosGame([
    { id: "human", name: "You", isBot: false, token: "🛠️" },
    { id: "cpu", name: "CPU", isBot: true, token: "🪠" },
  ], { goalMode: "empire" });

  state.players[0].cash = 6000;
  const deedIds = BOARD.filter((space) => ["property", "business", "utility"].includes(space.type)).slice(0, 8).map((space) => space.id);
  deedIds.forEach((id) => { state.ownership[String(id)] = { ownerId: "human", upgrades: 0, mortgaged: false }; });
  state.rolled = true;
  const next = finishChaosTurn(state);
  assert.equal(next.status, "finished");
  assert.equal(next.winnerId, "human");
});
