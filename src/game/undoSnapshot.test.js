import test from "node:test";
import assert from "node:assert/strict";
import { restoreUndoSnapshot } from "./undoSnapshot.js";

const card = (id, rank = "Q") => ({ id, rank, suit: "S", color: "black" });

test("restores a missing team board as an empty array instead of undefined", () => {
  const room = {
    privateHands: { player: [] },
    publicState: {
      teamBoards: { 0: [{ rank: "A", cards: [card("a", "A")] }], 1: undefined },
      teamMelds: { 0: [{ rank: "A", cards: [card("a", "A")] }], 1: undefined },
      opened: { 0: true, 1: true },
      handCounts: { player: 0 },
      undoPlay: {},
    },
  };
  const player = { uid: "player", team: 1 };
  const undo = {
    privateHand: [card("q1")],
    teamBoard: undefined,
    opened: false,
    lastAction: "Before the play.",
  };

  restoreUndoSnapshot(room, player, undo);

  assert.deepEqual(room.publicState.teamBoards[1], []);
  assert.deepEqual(room.publicState.teamMelds[1], []);
  assert.equal(Object.values(room.publicState.teamBoards).includes(undefined), false);
  assert.equal(room.publicState.handCounts.player, 1);
});

test("restores cards, melds, opening state, and pending pickup without undefined values", () => {
  const room = {
    privateHands: { player: [] },
    publicState: {
      teamBoards: [],
      teamMelds: [],
      opened: [],
      handCounts: {},
      undoPlay: {},
    },
  };
  const player = { uid: "player", team: 1 };
  const undo = {
    privateHand: [card("q1"), null, card("q2")],
    teamBoard: [{ rank: "Q", cards: [card("board-q"), undefined] }],
    opened: true,
    pendingDiscardPickup: { uid: "player", rank: "Q" },
    lastAction: "Before the grouped play.",
  };

  restoreUndoSnapshot(room, player, undo);

  assert.deepEqual(room.privateHands.player.map((item) => item.id), ["q1", "q2"]);
  assert.deepEqual(room.publicState.teamBoards[1][0].cards.map((item) => item.id), ["board-q"]);
  assert.equal(room.publicState.opened[1], true);
  assert.equal(room.publicState.pendingDiscardPickup.rank, "Q");
  assert.equal(room.publicState.undoPlay, null);
  assert.doesNotThrow(() => JSON.stringify(room));
});

test("rejects a corrupt undo snapshot without a saved hand", () => {
  const room = { privateHands: {}, publicState: {} };
  assert.throws(
    () => restoreUndoSnapshot(room, { uid: "player", team: 1 }, { teamBoard: [] }),
    /cannot be undone safely/i,
  );
});
