import test from "node:test";
import assert from "node:assert/strict";
import { executeRobotTurn } from "./botEngine.js";

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

test("robot keeps one card after its discard until its team has a canasta", () => {
  const robot = { uid: "robot", nickname: "Ruby", team: 0, seat: 0, isRobot: true };
  const human = { uid: "human", nickname: "Jeff", team: 1, seat: 1, isRobot: false };
  const room = {
    status: "playing",
    rules: {
      drawCount: 2,
      maxWildsPerMeld: 3,
      freezeOnWild: true,
      freezeOnBlackThree: false,
      teamCount: 2,
      canastasToGoOut: 1,
      discardPickupRule: "classic",
    },
    members: { robot, human },
    privateHands: {
      robot: [card("q1", "Q"), card("q2", "Q"), card("q3", "Q")],
      human: [card("h1", "4")],
    },
    stock: [card("stock-left", "9"), card("q4", "Q"), card("q5", "Q")],
    publicState: {
      phase: "playing",
      currentPlayerIndex: 0,
      turnPhase: "draw",
      discardPile: [card("top", "K", "H")],
      discardFrozen: true,
      teamBoards: { 0: [], 1: [] },
      teamMelds: { 0: [], 1: [] },
      opened: { 0: true, 1: true },
      openingRequirements: { 0: 50, 1: 50 },
      teamScores: [0, 0],
      redThrees: { robot: [], human: [] },
      handCounts: { robot: 3, human: 1 },
    },
  };

  const result = executeRobotTurn(room);

  assert.equal(result.publicState.phase, "playing");
  assert.equal(result.privateHands.robot.length, 1);
  assert.equal(result.publicState.teamBoards[0][0].cards.length, 3);
  assert.equal(result.publicState.currentPlayerIndex, 1);
});
