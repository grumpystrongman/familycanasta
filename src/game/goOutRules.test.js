import test from "node:test";
import assert from "node:assert/strict";
import {
  boardCanGoOut,
  preserveCardsUntilCanasta,
  teamCanGoOut,
} from "./goOutRules.js";

const card = (id, rank, suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

test("requires at least one seven-card canasta before a team can go out", () => {
  const six = Array.from({ length: 6 }, (_, index) => card(`q${index}`, "Q"));
  const seven = [...six, card("q6", "Q")];

  assert.equal(boardCanGoOut([{ rank: "Q", cards: six }], { canastasToGoOut: 1 }), false);
  assert.equal(boardCanGoOut([{ rank: "Q", cards: seven }], { canastasToGoOut: 1 }), true);
  assert.equal(teamCanGoOut({ rules: {}, publicState: { teamBoards: { 0: [{ rank: "Q", cards: seven }] } } }, 0), true);
});

test("keeps two cards available for the discard when no canasta exists", () => {
  const hand = [
    card("q1", "Q"),
    card("q2", "Q"),
    card("q3", "Q"),
    card("q4", "Q"),
    card("spare", "6"),
  ];
  const selected = preserveCardsUntilCanasta(
    hand,
    [],
    [{ rank: "Q", cards: hand.slice(0, 4), existing: false }],
    { maxWildsPerMeld: 3, canastasToGoOut: 1 },
  );

  assert.equal(selected.length, 1);
  assert.equal(selected[0].cards.length, 3);
});

test("holds back an entire three-card meld when it would empty the hand without a canasta", () => {
  const hand = [card("q1", "Q"), card("q2", "Q"), card("q3", "Q")];
  const selected = preserveCardsUntilCanasta(
    hand,
    [],
    [{ rank: "Q", cards: hand, existing: false }],
    { maxWildsPerMeld: 3, canastasToGoOut: 1 },
  );

  assert.deepEqual(selected, []);
});

test("allows every card to be played when the play completes a canasta", () => {
  const current = [{
    rank: "Q",
    cards: Array.from({ length: 6 }, (_, index) => card(`board-${index}`, "Q")),
  }];
  const hand = [card("last", "Q")];
  const selected = preserveCardsUntilCanasta(
    hand,
    current,
    [{ rank: "Q", cards: hand, existing: true }],
    { canastasToGoOut: 1 },
  );

  assert.equal(selected.length, 1);
  assert.equal(selected[0].cards.length, 1);
});
