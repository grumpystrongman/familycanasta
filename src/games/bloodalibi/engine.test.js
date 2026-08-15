import test from "node:test";
import assert from "node:assert/strict";
import { createBloodAlibiGame, reduceBloodAlibi } from "./engine.js";

const members = [{ uid:"a", nickname:"A", seat:0 }, { uid:"b", nickname:"B", seat:1 }];

test("Blackglass creates one hidden solution and deals the remaining evidence", () => {
  const state = createBloodAlibiGame(members);
  assert.ok(state.solution.suspectId);
  assert.ok(state.solution.methodId);
  assert.ok(state.solution.locationId);
  assert.equal(state.hands.a.length + state.hands.b.length, 18);
});

test("investigator must move along a connected hotel link", () => {
  const state = createBloodAlibiGame(members);
  assert.throws(() => reduceBloodAlibi(state, "a", { type:"move", locationId:"penthouse" }, members), /not connected/i);
  const next = reduceBloodAlibi(state, "a", { type:"move", locationId:"security" }, members);
  assert.equal(next.positions.a, "security");
  assert.equal(next.turnPhase, "investigate");
});
