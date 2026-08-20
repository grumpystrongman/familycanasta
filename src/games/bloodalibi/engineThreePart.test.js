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

test("a human refuter chooses which matching alibi card to reveal", () => {
  const state = createBloodAlibiGame(members);
  const investigating = {
    ...state,
    currentPlayerIndex: 0,
    turnPhase: "investigate",
    positions: { ...state.positions, a: "room:penthouse" },
    hands: {
      a: [],
      b: ["suspect:june-mercer", "method:revolver", "location:kitchen"],
    },
    reveals: [],
  };

  const waiting = reduceBloodAlibi(investigating, "a", { type: "suggest", suspectId: "june-mercer", methodId: "revolver" }, members);
  assert.equal(waiting.turnPhase, "refute");
  assert.equal(waiting.pendingRefutation.refuterUid, "b");
  assert.deepEqual(waiting.reveals, []);

  const next = reduceBloodAlibi(waiting, "b", { type: "showAlibi", cardId: "method:revolver" }, members);
  assert.equal(next.pendingRefutation, null);
  assert.equal(next.reveals.at(-1).toUid, "a");
  assert.equal(next.reveals.at(-1).fromUid, "b");
  assert.equal(next.reveals.at(-1).cardId, "method:revolver");
  assert.equal(next.turnPhase, "roll");
  assert.equal(next.currentPlayerIndex, 1);
});

test("a refuter cannot reveal a card that does not match the theory", () => {
  const state = createBloodAlibiGame(members);
  const waiting = {
    ...state,
    currentPlayerIndex: 0,
    turnPhase: "refute",
    pendingRefutation: {
      suggestorUid: "a",
      refuterUid: "b",
      theory: { suspectId: "june-mercer", methodId: "revolver", locationId: "penthouse" },
    },
    hands: { a: [], b: ["location:kitchen", "method:revolver"] },
  };
  assert.throws(
    () => reduceBloodAlibi(waiting, "b", { type: "showAlibi", cardId: "location:kitchen" }, members),
    /matching alibi/i,
  );
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
  assert.equal(next.caseLog.at(-1).correct, true);
  assert.equal(next.caseLog.at(-1).turn, state.turnNumber);
});

test("a final accusation is legal before rolling and does not require entering the accused room", () => {
  const state = createBloodAlibiGame(members);
  const solution = { suspectId: "dex-vale", methodId: "cleaver", locationId: "kitchen" };
  const ready = {
    ...state,
    solution,
    currentPlayerIndex: 0,
    turnPhase: "roll",
    positions: { ...state.positions, a: "hall:8,0" },
  };
  const next = reduceBloodAlibi(ready, "a", { type: "accuse", ...solution }, members);
  assert.equal(next.phase, "game-over");
  assert.equal(next.winnerUid, "a");
  assert.equal(next.lastTheory.locationId, "kitchen");
});

test("a final accusation is legal during movement", () => {
  const state = createBloodAlibiGame(members);
  const solution = { suspectId: "dex-vale", methodId: "cleaver", locationId: "kitchen" };
  const moving = {
    ...state,
    solution,
    currentPlayerIndex: 0,
    turnPhase: "move",
    moveRemaining: 4,
    positions: { ...state.positions, a: "hall:8,3" },
  };
  const next = reduceBloodAlibi(moving, "a", { type: "accuse", ...solution }, members);
  assert.equal(next.phase, "game-over");
  assert.equal(next.winnerUid, "a");
});

test("suggestions still require the investigator to be in a room", () => {
  const state = createBloodAlibiGame(members);
  const ready = {
    ...state,
    currentPlayerIndex: 0,
    turnPhase: "roll",
    positions: { ...state.positions, a: "hall:8,0" },
  };
  assert.throws(
    () => reduceBloodAlibi(ready, "a", { type: "suggest", suspectId: "june-mercer", methodId: "revolver" }, members),
    /enter a room/i,
  );
});
