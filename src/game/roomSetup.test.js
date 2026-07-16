import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoomSetup, roomSetupMatches } from "./roomSetup.js";

test("normalizes a four-player partnership room to four seats", () => {
  assert.deepEqual(
    normalizeRoomSetup({ playMode: "partners", teamCount: 2, deckCount: 2, cardsPerPlayer: 11 }),
    {
      playMode: "partners",
      playersPerTeam: 2,
      teamCount: 2,
      seatCount: 4,
      deckCount: 2,
      cardsPerPlayer: 11,
      discardPickupRule: "classic",
    },
  );
});

test("keeps four individual teams as four seats", () => {
  const setup = normalizeRoomSetup({ playMode: "solo", teamCount: 4 });
  assert.equal(setup.playersPerTeam, 1);
  assert.equal(setup.teamCount, 4);
  assert.equal(setup.seatCount, 4);
});

test("defaults discard pickup to classic and preserves modern American", () => {
  assert.equal(normalizeRoomSetup({}).discardPickupRule, "classic");
  assert.equal(normalizeRoomSetup({ discardPickupRule: "modern" }).discardPickupRule, "modern");
});

test("detects the two-seat fallback as different from a requested four-seat room", () => {
  const current = { playMode: "solo", playersPerTeam: 1, teamCount: 2, deckCount: 2, cardsPerPlayer: 15 };
  const requested = { playMode: "partners", playersPerTeam: 2, teamCount: 2, deckCount: 2, cardsPerPlayer: 11 };
  assert.equal(roomSetupMatches(current, requested), false);
});

test("detects a discard pickup variation change", () => {
  const classic = normalizeRoomSetup({ playMode: "partners", teamCount: 2, discardPickupRule: "classic" });
  const modern = normalizeRoomSetup({ playMode: "partners", teamCount: 2, discardPickupRule: "modern" });
  assert.equal(roomSetupMatches(classic, modern), false);
});

test("recognizes matching four-seat room rules", () => {
  const current = {
    playMode: "partners",
    playersPerTeam: 2,
    teamCount: 2,
    seatCount: 4,
    deckCount: 2,
    cardsPerPlayer: 11,
    discardPickupRule: "classic",
  };
  assert.equal(roomSetupMatches(current, current), true);
});
