import test from "node:test";
import assert from "node:assert/strict";
import { executeRobotTurn } from "./botEngine.js";

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

function baseRoom({ robotHand, humanHand, stock, pile, frozen = true, robotBoard = [], opened = true }) {
  const robot = { uid: "robot", nickname: "Ruby", team: 0, seat: 0, isRobot: true };
  const opponent = { uid: "human", nickname: "Jeff", team: 1, seat: 1, isRobot: false };
  return {
    status: "playing",
    rules: { drawCount: 2, maxWildsPerMeld: 3, freezeOnWild: true, freezeOnBlackThree: true, teamCount: 2 },
    members: { robot, human: opponent },
    privateHands: {
      robot: robotHand,
      human: humanHand,
    },
    stock,
    publicState: {
      phase: "playing",
      currentPlayerIndex: 0,
      turnPhase: "draw",
      discardPile: pile,
      discardFrozen: frozen,
      teamBoards: { 0: robotBoard, 1: [] },
      teamMelds: { 0: robotBoard, 1: [] },
      opened: { 0: opened, 1: true },
      openingRequirements: { 0: 50, 1: 50 },
      teamScores: [0, 0],
      redThrees: { robot: [], human: [] },
      handCounts: { robot: robotHand.length, human: humanHand.length },
    },
  };
}

test("robot completes a discard-pile opening atomically before discarding", () => {
  const robot = { uid: "robot", nickname: "Ruby", team: 0, seat: 0, isRobot: true };
  const opponent = { uid: "human", nickname: "Jeff", team: 1, seat: 1, isRobot: false };
  const room = {
    status: "playing",
    rules: { drawCount: 2, maxWildsPerMeld: 3, freezeOnWild: true, teamCount: 2 },
    members: { robot, human: opponent },
    privateHands: {
      robot: [
        card("q1", "Q"),
        card("q2", "Q", "C"),
        card("a1", "A"),
        card("a2", "A", "D"),
        card("a3", "A", "H"),
        card("spare", "6"),
      ],
      human: [card("h1", "4")],
    },
    stock: [card("stock1", "6"), card("stock2", "7")],
    publicState: {
      phase: "playing",
      currentPlayerIndex: 0,
      turnPhase: "draw",
      discardPile: [card("lower", "5"), card("top", "Q", "H")],
      discardFrozen: true,
      teamBoards: { 0: [], 1: [] },
      teamMelds: { 0: [], 1: [] },
      opened: { 0: false, 1: false },
      openingRequirements: { 0: 90, 1: 50 },
      teamScores: { 0: 1700, 1: 0 },
      redThrees: { robot: [], human: [] },
      handCounts: { robot: 6, human: 1 },
    },
  };

  const result = executeRobotTurn(room);

  assert.equal(result.publicState.opened[0], true);
  assert.equal(result.publicState.pendingDiscardPickup, null);
  assert.deepEqual(result.publicState.teamBoards[0].map((meld) => meld.rank).sort(), ["A", "Q"]);
  assert.equal(result.privateHands.robot.length, 1);
  assert.equal(result.publicState.currentPlayerIndex, 1);
  assert.equal(result.publicState.turnPhase, "draw");
});

test("robot ends the round when the stock is empty and a black three tops the discard pile", () => {
  const room = baseRoom({
    robotHand: [card("r1", "6"), card("r2", "8")],
    humanHand: [card("h1", "K")],
    stock: [],
    pile: [card("top", "3", "C")],
    frozen: false,
  });

  const result = executeRobotTurn(room);

  assert.equal(result.publicState.phase, "handOver");
  assert.equal(result.publicState.roundEndReason, "stock-exhausted");
  assert.equal(result.publicState.roundBreakdowns[0].goingOutPoints, 0);
  assert.equal(result.privateHands.robot.length, 2);
  assert.equal(result.publicState.discardPile.at(-1).rank, "3");
});

test("robot is not forced to take an unfrozen discard matching its open meld after stock exhaustion", () => {
  const room = baseRoom({
    robotHand: [card("r1", "4"), card("r2", "6"), card("r3", "8")],
    humanHand: [card("h1", "K")],
    stock: [],
    pile: [card("top", "Q", "H")],
    frozen: false,
    robotBoard: [{ rank: "Q", cards: [card("q1", "Q"), card("q2", "Q", "C"), card("q3", "Q", "D")] }],
  });

  const result = executeRobotTurn(room);

  assert.equal(result.publicState.phase, "handOver");
  assert.equal(result.publicState.roundEndReason, "stock-exhausted");
  assert.equal(result.publicState.teamBoards[0][0].cards.some((item) => item.id === "top"), false);
  assert.equal(result.publicState.discardPile.at(-1).id, "top");
  assert.equal(result.privateHands.robot.length, 3);
});

test("drawing the final red three ends the round before the robot can meld or discard", () => {
  const room = baseRoom({
    robotHand: [card("r1", "6"), card("r2", "8")],
    humanHand: [card("h1", "K")],
    stock: [card("last", "3", "H")],
    pile: [card("top", "5", "C")],
    frozen: false,
  });

  const result = executeRobotTurn(room);

  assert.equal(result.publicState.phase, "handOver");
  assert.equal(result.publicState.roundEndReason, "last-red-three");
  assert.equal(result.publicState.redThrees.robot.length, 1);
  assert.equal(result.privateHands.robot.length, 2);
  assert.equal(result.publicState.discardPile.at(-1).id, "top");
});
