import test from "node:test";
import assert from "node:assert/strict";
import { executeRobotTurn } from "./botEngine.js";

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

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
      handCounts: { robot: 5, human: 1 },
    },
  };

  const result = executeRobotTurn(room);

  assert.equal(result.publicState.opened[0], true);
  assert.equal(result.publicState.pendingDiscardPickup, null);
  assert.deepEqual(result.publicState.teamBoards[0].map((meld) => meld.rank).sort(), ["A", "Q"]);
  assert.equal(result.publicState.currentPlayerIndex, 1);
  assert.equal(result.publicState.turnPhase, "draw");
});
