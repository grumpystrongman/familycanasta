import test from "node:test";
import assert from "node:assert/strict";
import { createCheckersGame, legalCheckersMoves, reduceCheckers } from "./engine.js";

const members = [{ uid:"a", nickname:"A", seat:0 }, { uid:"b", nickname:"B", seat:1 }];

test("checkers starts with seven legal opening moves", () => {
  const state = createCheckersGame(members);
  assert.equal(legalCheckersMoves(state, "a", members).length, 7);
});

test("captures are mandatory and remove the jumped piece", () => {
  const board = Array(64).fill(null);
  board[42] = { uid:"a", king:false };
  board[33] = { uid:"b", king:false };
  const state = { phase:"playing", board, currentPlayerIndex:0, forcedFrom:null, roundNumber:1 };
  const moves = legalCheckersMoves(state, "a", members);
  assert.deepEqual(moves, [{ from:42, to:24, capture:33 }]);
  const next = reduceCheckers(state, "a", { type:"move", from:42, to:24 }, members);
  assert.equal(next.board[33], null);
  assert.equal(next.board[24].uid, "a");
});
