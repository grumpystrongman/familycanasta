import test from "node:test";
import assert from "node:assert/strict";
import { applyImmediateDiscardPickup } from "./discardPickupApply.js";

const card = (id, rank, suit = "S") => ({ id, rank, suit });

test("a new discard-pile meld includes the top discard and both matching hand cards", () => {
  const hand = [
    card("seven-one", "7", "C"),
    card("spare", "K", "D"),
    card("seven-two", "7", "H"),
  ];
  const board = [];
  const plan = {
    mode: "immediate",
    top: card("discard-seven", "7", "S"),
    lowerPile: [card("lower", "4", "C")],
    existing: null,
    usedHandCardIds: ["seven-one", "seven-two"],
  };

  const result = applyImmediateDiscardPickup(hand, board, plan);

  assert.equal(board.length, 1);
  assert.equal(board[0].rank, "7");
  assert.deepEqual(
    board[0].cards.map((item) => item.id),
    ["discard-seven", "seven-one", "seven-two"],
  );
  assert.deepEqual(
    result.remainingHand.map((item) => item.id),
    ["spare", "lower"],
  );
  assert.deepEqual(
    result.committedCards.map((item) => item.id),
    ["discard-seven", "seven-one", "seven-two"],
  );
});

test("an existing meld receives only the top discard when no hand support is required", () => {
  const hand = [card("spare", "K")];
  const board = [{ rank: "7", cards: [card("board-one", "7"), card("board-two", "7"), card("board-three", "7")] }];
  const plan = {
    mode: "immediate",
    top: card("discard-seven", "7", "H"),
    lowerPile: [],
    existing: board[0],
    usedHandCardIds: [],
  };

  const result = applyImmediateDiscardPickup(hand, board, plan);

  assert.deepEqual(
    board[0].cards.map((item) => item.id),
    ["board-one", "board-two", "board-three", "discard-seven"],
  );
  assert.deepEqual(result.remainingHand.map((item) => item.id), ["spare"]);
});
