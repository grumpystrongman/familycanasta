import test from "node:test";
import assert from "node:assert/strict";
import { boardRoomId, createBloodAlibiGame, getReachableBoardNodes, reduceBloodAlibi, roomNodeId } from "./engine.js";

const members = [{ uid:"a", nickname:"A", seat:0 }, { uid:"b", nickname:"B", seat:1 }];

test("Blackglass creates one hidden solution, evidence, and corridor starts", () => {
  const state = createBloodAlibiGame(members);
  assert.ok(state.solution.suspectId);
  assert.ok(state.solution.methodId);
  assert.ok(state.solution.locationId);
  assert.equal(state.hands.a.length + state.hands.b.length, 18);
  assert.equal(state.turnPhase, "roll");
  assert.match(state.positions.a, /^hall:/);
});

test("rolling opens movement with a d6 result", () => {
  const state = createBloodAlibiGame(members);
  const next = reduceBloodAlibi(state, "a", { type:"roll" }, members);
  assert.equal(next.turnPhase, "move");
  assert.ok(next.lastRoll >= 1 && next.lastRoll <= 6);
  assert.equal(next.moveRemaining, next.lastRoll);
});

test("movement uses board spaces and entering a room starts investigation", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, turnPhase:"move", lastRoll:4, moveRemaining:4 };
  const reachable = getReachableBoardNodes(state, "a", members);
  assert.ok(reachable.some((item) => item.id === roomNodeId("greenhouse")));
  const next = reduceBloodAlibi(state, "a", { type:"move", nodeId:roomNodeId("greenhouse") }, members);
  assert.equal(boardRoomId(next.positions.a), "greenhouse");
  assert.equal(next.turnPhase, "investigate");
});

test("another investigator blocks a narrow corridor", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, positions:{ ...state.positions, b:"hall:5,2" }, turnPhase:"move", lastRoll:6, moveRemaining:6 };
  const reachable = getReachableBoardNodes(state, "a", members);
  assert.equal(reachable.some((item) => item.id === "hall:5,3"), false);
  assert.equal(reachable.some((item) => item.id === roomNodeId("greenhouse")), false);
});

test("corner rooms have one-turn secret passages", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, positions:{ ...state.positions, a:roomNodeId("greenhouse") }, turnPhase:"roll" };
  const next = reduceBloodAlibi(state, "a", { type:"passage" }, members);
  assert.equal(boardRoomId(next.positions.a), "boiler");
  assert.equal(next.turnPhase, "investigate");
});

test("a theory requires a room and pulls the named suspect into the scene", () => {
  let state = createBloodAlibiGame(members);
  assert.throws(() => reduceBloodAlibi({ ...state, turnPhase:"investigate" }, "a", { type:"suggest", suspectId:"mara-voss", methodId:"nail-gun" }, members), /enter a room/i);
  state = { ...state, positions:{ ...state.positions, a:roomNodeId("atrium") }, turnPhase:"investigate" };
  const next = reduceBloodAlibi(state, "a", { type:"suggest", suspectId:"mara-voss", methodId:"nail-gun" }, members);
  assert.equal(next.suspectPositions["mara-voss"], "atrium");
  assert.equal(next.currentPlayerIndex, 1);
  assert.equal(next.turnPhase, "roll");
});

test("a correct final accusation closes the case", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, positions:{ ...state.positions, a:roomNodeId("atrium") }, turnPhase:"investigate" };
  const next = reduceBloodAlibi(state, "a", { type:"accuse", suspectId:state.solution.suspectId, methodId:state.solution.methodId, locationId:state.solution.locationId }, members);
  assert.equal(next.phase, "game-over");
  assert.equal(next.winnerUid, "a");
});
