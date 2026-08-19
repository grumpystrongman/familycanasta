import test from "node:test";
import assert from "node:assert/strict";
import { createBloodAlibiGame, reduceBloodAlibi } from "./engineThreePart.js";

const members = [
  { uid: "a", nickname: "Ada", seat: 0 },
  { uid: "b", nickname: "Bert", seat: 1 },
];

test("new Blackglass games hide exactly one suspect, weapon, and room", () => {
  const state = createBloodAlibiGame(members);
  assert.deepEqual(Object.keys(state.solution).sort(), ["locationId", "methodId", "suspectId"]);
  assert.equal(Object.values(state.hands).flat().length, 18);
  assert.equal("victimId" in state.solution, false);
});

test("proposing a scenario stores the exact three items for the UI", () => {
  const state = createBloodAlibiGame(members);
  const investigating = {
    ...state,
    currentPlayerIndex: 0,
    turnPhase: "investigate",
    positions: { ...state.positions, a: "room:penthouse" },
    hands: { a: [], b: [] },
  };
  const next = reduceBloodAlibi(investigating, "a", { type: "suggest", suspectId: "june-mercer", methodId: "revolver" }, members);
  assert.deepEqual(next.lastTheory, { suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" });
});

test("a correct three-part accusation closes the case", () => {
  const state = createBloodAlibiGame(members);
  const solution = { suspectId: "dex-vale", methodId: "cleaver", locationId: "kitchen" };
  const investigating = {
    ...state,
    solution,
    currentPlayerIndex: 0,
    turnPhase: "investigate",
    positions: { ...state.positions, a: "room:penthouse" },
  };
  const next = reduceBloodAlibi(investigating, "a", { type: "accuse", ...solution }, members);
  assert.equal(next.phase, "game-over");
  assert.equal(next.winnerUid, "a");
  assert.deepEqual(next.lastTheory, solution);
});
