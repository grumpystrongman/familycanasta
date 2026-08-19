import test from "node:test";
import assert from "node:assert/strict";
import { BOARD_SIZE, CORRIDOR_SPACES, LOCATIONS, boardRoomId, createBloodAlibiGame, getReachableBoardNodes, reduceBloodAlibi, roomNodeId } from "./engine.js";

const members = [{ uid:"a", nickname:"A", seat:0 }, { uid:"b", nickname:"B", seat:1 }];

test("Blackglass creates one four-part hidden solution, evidence, and corridor starts", () => {
  const state = createBloodAlibiGame(members);
  assert.ok(state.solution.suspectId);
  assert.ok(state.solution.victimId);
  assert.notEqual(state.solution.suspectId, state.solution.victimId);
  assert.ok(state.solution.methodId);
  assert.ok(state.solution.locationId);
  assert.equal(state.hands.a.length + state.hands.b.length, 23);
  assert.equal(state.turnPhase, "roll");
  assert.match(state.positions.a, /^hall:/);
});

test("the investigation floor uses irregular room footprints with broad walkable negative space", () => {
  assert.equal(BOARD_SIZE, 25);
  assert.equal(CORRIDOR_SPACES.length, 198);
  assert.ok(new Set(LOCATIONS.map((room) => `${room.bounds.w}x${room.bounds.h}`)).size > 3);
  assert.ok(CORRIDOR_SPACES.some((space) => space.x === 8 && space.y === 4));
  assert.ok(CORRIDOR_SPACES.some((space) => space.x === 18 && space.y === 15));
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

test("a doorway is a corridor space and entering the room costs one additional die point", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, positions:{ ...state.positions, a:"hall:8,2" }, turnPhase:"move", lastRoll:1, moveRemaining:1 };
  const oneMove = getReachableBoardNodes(state, "a", members);
  assert.ok(oneMove.some((item) => item.id === "hall:7,2" && item.distance === 1));
  assert.equal(oneMove.some((item) => item.id === roomNodeId("greenhouse")), false);

  state = { ...state, lastRoll:2, moveRemaining:2 };
  const twoMoves = getReachableBoardNodes(state, "a", members);
  assert.ok(twoMoves.some((item) => item.id === roomNodeId("greenhouse") && item.distance === 2));
  const entered = reduceBloodAlibi(state, "a", { type:"move", nodeId:roomNodeId("greenhouse") }, members);
  assert.equal(boardRoomId(entered.positions.a), "greenhouse");
  assert.equal(entered.turnPhase, "investigate");
});

test("another investigator blocks an occupied doorway and the room behind it", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, positions:{ ...state.positions, b:"hall:7,2" }, turnPhase:"move", lastRoll:4, moveRemaining:4 };
  const reachable = getReachableBoardNodes(state, "a", members);
  assert.equal(reachable.some((item) => item.id === "hall:7,2"), false);
  assert.equal(reachable.some((item) => item.id === roomNodeId("greenhouse")), false);
});

test("corner rooms have one-turn secret passages", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, positions:{ ...state.positions, a:roomNodeId("greenhouse") }, turnPhase:"roll" };
  const next = reduceBloodAlibi(state, "a", { type:"passage" }, members);
  assert.equal(boardRoomId(next.positions.a), "boiler");
  assert.equal(next.turnPhase, "investigate");
});

test("a theory requires a room and pulls killer, victim, and method into the scene", () => {
  let state = createBloodAlibiGame(members);
  const theory = { type:"suggest", suspectId:"dex-vale", victimId:"ruby-ash", methodId:"nail-gun" };
  assert.throws(() => reduceBloodAlibi({ ...state, turnPhase:"investigate" }, "a", theory, members), /enter a room/i);
  state = { ...state, positions:{ ...state.positions, a:roomNodeId("atrium") }, turnPhase:"investigate" };
  const next = reduceBloodAlibi(state, "a", theory, members);
  assert.equal(next.suspectPositions["dex-vale"], "atrium");
  assert.equal(next.suspectPositions["ruby-ash"], "atrium");
  assert.equal(next.methodPositions["nail-gun"], "atrium");
  assert.deepEqual(next.lastTheory, { suspectId:"dex-vale", victimId:"ruby-ash", methodId:"nail-gun", locationId:"atrium" });
  assert.equal(next.currentPlayerIndex, 1);
  assert.equal(next.turnPhase, "roll");
});

test("a theory never permits the same person as killer and victim", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, positions:{ ...state.positions, a:roomNodeId("atrium") }, turnPhase:"investigate" };
  assert.throws(() => reduceBloodAlibi(state, "a", { type:"suggest", suspectId:"ruby-ash", victimId:"ruby-ash", methodId:"revolver" }, members), /must be different/i);
});

test("a correct four-part final accusation closes the case", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, positions:{ ...state.positions, a:roomNodeId("atrium") }, turnPhase:"investigate" };
  const next = reduceBloodAlibi(state, "a", { type:"accuse", suspectId:state.solution.suspectId, victimId:state.solution.victimId, methodId:state.solution.methodId, locationId:state.solution.locationId }, members);
  assert.equal(next.phase, "game-over");
  assert.equal(next.winnerUid, "a");
});
