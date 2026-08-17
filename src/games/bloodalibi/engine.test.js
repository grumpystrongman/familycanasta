import test from "node:test";
import assert from "node:assert/strict";
import {
  boardRoomId,
  chooseBloodAlibiRobotMove,
  createBloodAlibiGame,
  getReachableBoardNodes,
  reduceBloodAlibi,
  roomNodeId,
} from "./engine.js";

const members = [{ uid:"a", nickname:"A", seat:0 }, { uid:"b", nickname:"B", seat:1 }];

function inRoom(state, uid, roomId, phase = "investigate") {
  return { ...state, positions:{ ...state.positions, [uid]:roomNodeId(roomId) }, turnPhase:phase, moveRemaining:0, lastRoll:null };
}

test("Blackglass creates one hidden solution, all evidence, and corridor starts", () => {
  const state = createBloodAlibiGame(members);
  assert.ok(state.solution.suspectId);
  assert.ok(state.solution.methodId);
  assert.ok(state.solution.locationId);
  assert.equal(state.hands.a.length + state.hands.b.length, 18);
  assert.equal(state.turnPhase, "roll");
  assert.match(state.positions.a, /^hall:/);
  assert.match(state.positions.b, /^hall:/);
});

test("rolling opens movement with a deterministic d6 result", () => {
  const original = Math.random;
  Math.random = () => .999;
  try {
    const state = createBloodAlibiGame(members);
    const next = reduceBloodAlibi(state, "a", { type:"roll" }, members);
    assert.equal(next.turnPhase, "move");
    assert.equal(next.lastRoll, 6);
    assert.equal(next.moveRemaining, 6);
  } finally { Math.random = original; }
});

test("movement spends distance and may continue before entering a room", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, turnPhase:"move", lastRoll:4, moveRemaining:4 };
  const next = reduceBloodAlibi(state, "a", { type:"move", nodeId:"hall:5,1" }, members);
  assert.equal(next.positions.a, "hall:5,1");
  assert.equal(next.turnPhase, "move");
  assert.equal(next.moveRemaining, 3);
  assert.ok(getReachableBoardNodes(next, "a", members).length > 0);
});

test("entering a room ends movement and opens investigation", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, turnPhase:"move", lastRoll:4, moveRemaining:4 };
  const reachable = getReachableBoardNodes(state, "a", members);
  assert.ok(reachable.some((item) => item.id === roomNodeId("greenhouse")));
  const next = reduceBloodAlibi(state, "a", { type:"move", nodeId:roomNodeId("greenhouse") }, members);
  assert.equal(boardRoomId(next.positions.a), "greenhouse");
  assert.equal(next.turnPhase, "investigate");
  assert.equal(next.moveRemaining, 0);
});

test("another investigator blocks a narrow corridor", () => {
  let state = createBloodAlibiGame(members);
  state = { ...state, positions:{ ...state.positions, b:"hall:5,2" }, turnPhase:"move", lastRoll:6, moveRemaining:6 };
  const reachable = getReachableBoardNodes(state, "a", members);
  assert.equal(reachable.some((item) => item.id === "hall:5,3"), false);
  assert.equal(reachable.some((item) => item.id === roomNodeId("greenhouse")), false);
});

test("both secret passage pairs work in one turn", () => {
  let state = inRoom(createBloodAlibiGame(members), "a", "greenhouse", "roll");
  let next = reduceBloodAlibi(state, "a", { type:"passage" }, members);
  assert.equal(boardRoomId(next.positions.a), "boiler");
  assert.equal(next.turnPhase, "investigate");

  state = inRoom(createBloodAlibiGame(members), "a", "garage", "roll");
  next = reduceBloodAlibi(state, "a", { type:"passage" }, members);
  assert.equal(boardRoomId(next.positions.a), "security");
  assert.equal(next.turnPhase, "investigate");
});

test("an investigator may stay in a room and investigate without rolling", () => {
  const state = inRoom(createBloodAlibiGame(members), "a", "atrium", "roll");
  const next = reduceBloodAlibi(state, "a", { type:"investigateHere" }, members);
  assert.equal(next.turnPhase, "investigate");
  assert.equal(boardRoomId(next.positions.a), "atrium");
});

test("a theory requires a room, moves suspect and weapon pieces, and privately refutes", () => {
  let state = createBloodAlibiGame(members);
  assert.throws(() => reduceBloodAlibi({ ...state, turnPhase:"investigate" }, "a", { type:"suggest", suspectId:"mara-voss", methodId:"nail-gun" }, members), /enter a room/i);
  state = inRoom(state, "a", "atrium");
  state = { ...state, hands:{ a:[], b:["suspect:mara-voss"] } };
  const next = reduceBloodAlibi(state, "a", { type:"suggest", suspectId:"mara-voss", methodId:"nail-gun" }, members);
  assert.equal(next.suspectPositions["mara-voss"], "atrium");
  assert.equal(next.methodPositions["nail-gun"], "atrium");
  assert.equal(next.reveals.at(-1).toUid, "a");
  assert.equal(next.reveals.at(-1).fromUid, "b");
  assert.equal(next.reveals.at(-1).cardId, "suspect:mara-voss");
  assert.equal(next.currentPlayerIndex, 1);
  assert.equal(next.turnPhase, "roll");
});

test("an unrefuted theory advances the turn and records it publicly", () => {
  let state = inRoom(createBloodAlibiGame(members), "a", "penthouse");
  state = { ...state, hands:{ a:[], b:[] } };
  const next = reduceBloodAlibi(state, "a", { type:"suggest", suspectId:"mara-voss", methodId:"nail-gun" }, members);
  assert.equal(next.currentPlayerIndex, 1);
  assert.match(next.caseLog.at(-1).text, /could not be refuted/i);
});

test("a wrong final accusation eliminates the accuser and awards a two-player survivor", () => {
  let state = inRoom(createBloodAlibiGame(members), "a", "atrium");
  const wrongSuspect = state.solution.suspectId === "mara-voss" ? "dex-vale" : "mara-voss";
  const next = reduceBloodAlibi(state, "a", { type:"accuse", suspectId:wrongSuspect, methodId:state.solution.methodId, locationId:state.solution.locationId }, members);
  assert.equal(next.eliminated.a, true);
  assert.equal(next.phase, "game-over");
  assert.equal(next.winnerUid, "b");
});

test("a correct final accusation closes the case", () => {
  let state = inRoom(createBloodAlibiGame(members), "a", "atrium");
  const next = reduceBloodAlibi(state, "a", { type:"accuse", suspectId:state.solution.suspectId, methodId:state.solution.methodId, locationId:state.solution.locationId }, members);
  assert.equal(next.phase, "game-over");
  assert.equal(next.winnerUid, "a");
});

test("robot decisions follow the roll, move, investigate loop", () => {
  const robots = [{ uid:"r", nickname:"Robot", seat:0, isRobot:true }, { uid:"h", nickname:"Human", seat:1 }];
  let state = createBloodAlibiGame(robots);
  let decision = chooseBloodAlibiRobotMove(state, robots);
  assert.equal(decision.action.type, "roll");

  state = { ...state, turnPhase:"move", moveRemaining:6, lastRoll:6 };
  decision = chooseBloodAlibiRobotMove(state, robots);
  assert.equal(decision.action.type, "move");
  assert.ok(getReachableBoardNodes(state, "r", robots).some((item) => item.id === decision.action.nodeId));

  state = inRoom(state, "r", "atrium");
  decision = chooseBloodAlibiRobotMove(state, robots);
  assert.equal(decision.action.type, "suggest");
});
