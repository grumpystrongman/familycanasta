import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("hub exposes the all-time leaderboard and keeps the visible result at twenty", async () => {
  const [hub, board] = await Promise.all([read("../HubApp.jsx"), read("./AllTimeLeaderboard.jsx")]);
  assert.match(hub, /<AllTimeLeaderboard\s*\/>/);
  assert.match(board, /topLeaderboardRows\(history,\s*gameId,\s*20\)/);
  assert.match(board, /Top 20 all time/);
});

test("all shared online room systems persist completed results", async () => {
  const [canasta, modular, party, chomp] = await Promise.all([
    read("../services/roomService.js"),
    read("./modularRoomService.js"),
    read("./party/partyRoomService.js"),
    read("../games/chompageddon/onlineRoom.js"),
  ]);
  for (const source of [canasta, modular, party, chomp]) {
    assert.match(source, /recordCompletedRoom/);
  }
  assert.match(modular, /gameNumber:\s*Number\(room\.gameNumber \|\| 0\) \+ 1/);
  assert.match(party, /gameNumber:\s*Number\(room\.gameNumber \|\| 0\) \+ 1/);
  assert.match(chomp, /gameNumber:\s*Number\(room\.gameNumber \|\| 0\) \+ 1/);
});

test("standalone score tracker is mounted without changing game engines", async () => {
  const [main, tracker] = await Promise.all([read("../main.jsx"), read("./StandaloneLeaderboardTracker.jsx")]);
  assert.match(main, /StandaloneLeaderboardTracker/);
  assert.match(tracker, /gameId:\s*"slumlord"/);
  assert.match(tracker, /gameId:\s*"chompageddon"/);
  assert.match(tracker, /recordStandaloneResult/);
});

test("leaderboard history is authenticated, readable, and immutable once written", async () => {
  const rules = await read("../../database.rules.json");
  const parsed = JSON.parse(rules);
  const leaderboard = parsed.rules.leaderboardResults;
  assert.equal(leaderboard[".read"], "auth != null");
  assert.match(leaderboard.$gameId.$completionId[".write"], /!data\.exists\(\)/);
  assert.match(leaderboard.$gameId.$completionId[".validate"], /players/);
});

test("Canasta start repairs board keepers instead of hard-blocking the host", async () => {
  const service = await read("../services/roomService.js");
  assert.match(service, /boardKeeperRepairs\(room\)/);
  assert.match(service, /boardKeepers\[team\] = teamPlayers\[0\]\.uid/);
  assert.doesNotMatch(service, /throw new Error\("Choose a board keeper for every team\."\)/);
});
