import assert from "node:assert/strict";
import test from "node:test";
import { BOARD, START_CASH } from "./data.js";
import {
  buyPendingProperty,
  calculateRent,
  createGame,
  currentPlayer,
  rollDice,
  upgradeProperty,
} from "./engine.js";

const players = [
  { id: "a", name: "A", token: "🛠️" },
  { id: "b", name: "B", token: "🪠" },
];

test("Slum Lord uses a 36-space board and starts players at Rent Day", () => {
  const state = createGame(players, { rng: () => 0.5 });
  assert.equal(BOARD.length, 36);
  assert.equal(state.players.length, 2);
  assert.equal(state.players[0].cash, START_CASH);
  assert.equal(state.players[0].position, 0);
  assert.equal(currentPlayer(state).id, "a");
});

test("landing on an unowned property creates a purchase decision", () => {
  const state = createGame(players, { rng: () => 0.5 });
  const rolled = rollDice(state, [1, 2]);
  assert.equal(rolled.players[0].position, 3);
  assert.deepEqual(rolled.pendingAction, { type: "purchase", playerId: "a", spaceId: 3 });
});

test("buying a pending property transfers cash and records ownership", () => {
  const state = createGame(players, { rng: () => 0.5 });
  const rolled = rollDice(state, [1, 2]);
  const bought = buyPendingProperty(rolled);
  assert.equal(bought.ownership["3"].ownerId, "a");
  assert.equal(bought.players[0].cash, START_CASH - BOARD[3].price);
  assert.equal(bought.pendingAction, null);
});

test("owning a whole color group doubles unimproved rent", () => {
  const state = createGame(players, { rng: () => 0.5 });
  state.ownership["1"] = { ownerId: "a", upgrades: 0, mortgaged: false };
  state.ownership["3"] = { ownerId: "a", upgrades: 0, mortgaged: false };
  assert.equal(calculateRent(state, 1), BOARD[1].rent[0] * 2);
});

test("a full color group can be upgraded evenly", () => {
  const state = createGame(players, { rng: () => 0.5 });
  state.ownership["1"] = { ownerId: "a", upgrades: 0, mortgaged: false };
  state.ownership["3"] = { ownerId: "a", upgrades: 0, mortgaged: false };
  const upgraded = upgradeProperty(state, "a", 1);
  assert.equal(upgraded.ownership["1"].upgrades, 1);
  assert.equal(upgraded.players[0].cash, START_CASH - BOARD[1].upgradeCost);
});
