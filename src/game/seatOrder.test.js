import test from "node:test";
import assert from "node:assert/strict";
import { alternatingTeamOrder, boardKeeperRepairs, sortMembersBySeat } from "./seatOrder.js";

test("sortMembersBySeat follows configured seat order", () => {
  const members = [
    { uid: "c", seat: 2 },
    { uid: "a", seat: 0 },
    { uid: "b", seat: 1 },
  ];
  assert.deepEqual(sortMembersBySeat(members).map((member) => member.uid), ["a", "b", "c"]);
});

test("alternatingTeamOrder alternates partners around the table", () => {
  const members = [
    { uid: "north-1", team: 0, seat: 0 },
    { uid: "north-2", team: 0, seat: 1 },
    { uid: "south-1", team: 1, seat: 2 },
    { uid: "south-2", team: 1, seat: 3 },
  ];

  assert.deepEqual(
    alternatingTeamOrder(members, 2, 2),
    ["north-1", "south-1", "north-2", "south-2"],
  );
});

test("boardKeeperRepairs replaces missing or wrong-team keepers", () => {
  const room = {
    rules: { teamCount: 2 },
    members: {
      a: { uid: "a", team: 0, seat: 0 },
      b: { uid: "b", team: 1, seat: 1 },
    },
    teamBoardKeepers: { 0: "b" },
  };

  assert.deepEqual(boardKeeperRepairs(room), { 0: "a", 1: "b" });
});
