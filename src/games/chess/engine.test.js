import test from "node:test";
import assert from "node:assert/strict";
import { createChessGame, legalChessMoves, reduceChess } from "./engine.js";

const members = [{ uid:"w", nickname:"White", seat:0 }, { uid:"b", nickname:"Black", seat:1 }];

test("chess opens with 20 legal white moves and allows e2-e4", () => {
  const state = createChessGame(members);
  assert.equal(legalChessMoves(state, "white").length, 20);
  const next = reduceChess(state, "w", { type:"move", from:52, to:36 }, members);
  assert.equal(next.board[36].type, "p");
  assert.equal(next.currentPlayerIndex, 1);
  assert.equal(next.enPassant, 44);
});

test("chess rejects moving the other side's piece", () => {
  const state = createChessGame(members);
  assert.throws(() => reduceChess(state, "w", { type:"move", from:12, to:28 }, members), /cannot move/i);
});
