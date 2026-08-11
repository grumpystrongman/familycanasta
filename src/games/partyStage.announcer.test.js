import test from "node:test";
import assert from "node:assert/strict";
import { ANNOUNCER_BANKS, introZinger, phaseZinger } from "../platform/party/announcer.js";

const players = [
  { uid: "a", nickname: "Alex" },
  { uid: "b", nickname: "Blair" },
  { uid: "c", nickname: "Casey" },
];

test("every Party Stage game ships a substantial announcer bank", () => {
  for (const gameId of ["punchline", "lastonealive", "doodlealibi"]) {
    const bank = ANNOUNCER_BANKS[gameId];
    assert.ok(bank);
    assert.ok(bank.intro.length >= 3, `${gameId} needs multiple intro reads`);
    assert.ok(Object.values(bank).flat().length >= 15, `${gameId} needs enough zingers to avoid immediate repetition`);
    assert.ok(introZinger(gameId).length > 20);
  }
});

test("Punchline can generate a result zinger with the winning player", () => {
  const line = phaseZinger("punchline", {
    phase: "result",
    result: { counts: { a: 2, b: 0 } },
  }, players);
  assert.match(line, /Alex/);
});

test("Last One Alive has specific trap narration", () => {
  const line = phaseZinger("lastonealive", {
    phase: "microgame",
    microType: "deadButton",
  }, players);
  assert.match(line, /Dead Button/);
});

test("Doodle Alibi can identify the altered-prompt artist in its result narration", () => {
  const line = phaseZinger("doodlealibi", {
    phase: "result",
    suspectUids: ["b"],
  }, players);
  assert.match(line, /Blair/);
});
