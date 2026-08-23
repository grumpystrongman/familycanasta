import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULES } from "./engine.js";
import { findStrandedRoundFinisher, reconcileStrandedRound } from "./roundReconciliation.js";

const card = (id, rank = "K", suit = "S") => ({
  id,
  rank,
  suit,
  color: suit === "H" || suit === "D" ? "red" : "black",
});

function roomWithEmptyLegalHand() {
  return {
    status: "playing",
    rules: { ...DEFAULT_RULES, teamCount: 2, targetScore: 5000 },
    members: {
      north: { uid: "north", nickname: "North Player", team: 0, seat: 0 },
      south: { uid: "south", nickname: "South Player", team: 1, seat: 1 },
    },
    privateHands: {
      north: [],
      south: [card("s1", "4")],
    },
    publicState: {
      phase: "playing",
      turnPhase: "play",
      currentPlayerIndex: 0,
      teamBoards: {
        0: [{ rank: "K", cards: Array.from({ length: 7 }, (_, index) => card(`k${index}`)) }],
        1: [],
      },
      teamScores: [0, 0],
      handCounts: { north: 0, south: 1 },
      redThrees: { north: [], south: [] },
      opened: { 0: true, 1: false },
    },
  };
}

test("detects a legal player who has emptied their hand while the room is still playing", () => {
  const room = roomWithEmptyLegalHand();
  assert.equal(findStrandedRoundFinisher(room)?.uid, "north");
});

test("does not end a stranded zero-card hand when the team has not satisfied the go-out rule", () => {
  const room = roomWithEmptyLegalHand();
  room.publicState.teamBoards[0] = [{ rank: "K", cards: [card("k1"), card("k2"), card("k3")] }];

  assert.equal(findStrandedRoundFinisher(room), null);
  assert.equal(reconcileStrandedRound(room), room);
});

test("reconciles a stranded legal go-out into the normal hand-over scoring state", () => {
  const room = roomWithEmptyLegalHand();
  const reconciled = reconcileStrandedRound(room);

  assert.notEqual(reconciled, room);
  assert.equal(reconciled.publicState.phase, "handOver");
  assert.equal(reconciled.publicState.turnPhase, "complete");
  assert.equal(reconciled.publicState.roundEndReason, "went-out");
  assert.equal(reconciled.publicState.wentOutUid, "north");
  assert.equal(reconciled.publicState.wentOutTeam, 0);
  assert.ok(reconciled.publicState.roundBreakdowns[0]);
  assert.ok(reconciled.publicState.roundBreakdowns[1]);
});

test("leaves an already completed hand alone", () => {
  const room = roomWithEmptyLegalHand();
  room.publicState.phase = "handOver";
  room.publicState.turnPhase = "complete";

  assert.equal(findStrandedRoundFinisher(room), null);
  assert.equal(reconcileStrandedRound(room), room);
});
