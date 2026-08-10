import assert from "node:assert/strict";
import test from "node:test";
import { chooseERSRobotMove, ersSlapReasons, reduceERS } from "./engine.js";

const card = (rank, suffix = Math.random()) => ({
  id: `clubs-${rank}-${suffix}`,
  rank,
  suit: "clubs",
  value: rank === "A" ? 14 : rank === "K" ? 13 : rank === "Q" ? 12 : rank === "J" ? 11 : Number(rank),
  color: "black",
});

const members = [
  { uid: "a", nickname: "A", seat: 0, isRobot: false },
  { uid: "b", nickname: "B", seat: 1, isRobot: false },
  { uid: "c", nickname: "C", seat: 2, isRobot: true },
];

test("a stale online slap never becomes a false-slap penalty", () => {
  const oldTop = card("8", "old");
  const currentTop = card("8", "current");
  const state = {
    phase: "playing",
    hands: { a: [card("2")], b: [card("3")] },
    pile: [card("8", "first"), currentTop],
    currentPlayerIndex: 0,
    out: {},
    incorrectSlapPenalty: 1,
  };
  assert.throws(
    () => reduceERS(state, "a", { type: "slap", observedTopCardId: oldTop.id }, members.slice(0, 2)),
    /pile changed/i,
  );
  assert.equal(state.hands.a.length, 1);
  assert.equal(state.pile.at(-1).id, currentTop.id);
});

test("a false-slap burn goes under the live pile and cannot create a slap pattern", () => {
  const burn = card("9", "burn");
  const liveBottom = card("4", "live-bottom");
  const liveTop = card("9", "live-top");
  const state = {
    phase: "playing",
    hands: { a: [burn], b: [card("3")] },
    pile: [liveBottom, liveTop],
    currentPlayerIndex: 0,
    out: {},
    incorrectSlapPenalty: 1,
  };
  assert.deepEqual(ersSlapReasons(state.pile), []);
  const next = reduceERS(state, "a", { type: "slap", observedTopCardId: liveTop.id }, members.slice(0, 2));
  assert.equal(next.burnPile[0].id, burn.id);
  assert.equal(next.pile[0].id, liveBottom.id);
  assert.equal(next.pile.at(-1).id, liveTop.id);
  assert.deepEqual(ersSlapReasons(next.pile), []);
});

test("a face-card challenge continues with the next player when the responder runs out", () => {
  const response = card("2", "response");
  const state = {
    phase: "playing",
    hands: { a: [card("6")], b: [response], c: [card("7")] },
    pile: [card("K", "king")],
    currentPlayerIndex: 1,
    challenge: { ownerUid: "a", chancesRemaining: 3, limit: 3, faceRank: "K" },
    pendingClaimUid: null,
    out: {},
  };
  const next = reduceERS(state, "b", { type: "flip" }, members);
  assert.equal(next.hands.b.length, 0);
  assert.equal(next.challenge.chancesRemaining, 2);
  assert.equal(next.currentPlayerIndex, 2);
});

test("any connected client can settle a completed challenge for the rightful owner", () => {
  const top = card("5", "top");
  const state = {
    phase: "playing",
    hands: { a: [card("6")], b: [card("7")] },
    pile: [card("K", "king"), top],
    currentPlayerIndex: 0,
    challenge: { ownerUid: "a", chancesRemaining: 0, limit: 3, faceRank: "K" },
    pendingClaimUid: "a",
    out: {},
  };
  const next = reduceERS(state, "b", { type: "settle", observedTopCardId: top.id }, members.slice(0, 2));
  assert.equal(next.pendingClaimUid, null);
  assert.equal(next.pile.length, 0);
  assert.equal(next.hands.a.length, 3);
  assert.match(next.message, /wins the face-card challenge/i);
});

test("robot slap moves are tied to the exact visible top card and use human-scale delay", () => {
  const top = card("8", "top");
  const state = {
    phase: "playing",
    hands: { a: [card("2")], b: [card("3")], c: [card("4")] },
    pile: [card("8", "first"), top],
    currentPlayerIndex: 0,
    out: {},
  };
  const move = chooseERSRobotMove(state, members);
  assert.equal(move.uid, "c");
  assert.equal(move.action.type, "slap");
  assert.equal(move.action.observedTopCardId, top.id);
  assert.ok(move.delayMs >= 850);
});
