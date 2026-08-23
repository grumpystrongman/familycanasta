import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLeaderboardRows,
  completionIdForRoom,
  extractCompletedRoomResult,
  leaderboardPolicy,
  playerKey,
} from "./leaderboardModel.js";

test("score games keep each player's best all-time score", () => {
  const history = {
    one: { completedAt: 1, metric: "score", players: { alice: { playerKey: "alice", nickname: "Alice", score: 1200, won: true }, bob: { playerKey: "bob", nickname: "Bob", score: 900, won: false } } },
    two: { completedAt: 2, metric: "score", players: { alice: { playerKey: "alice", nickname: "Alice", score: 800, won: false }, bob: { playerKey: "bob", nickname: "Bob", score: 1400, won: true } } },
  };
  const rows = buildLeaderboardRows(history, "canasta");
  assert.equal(rows[0].nickname, "Bob");
  assert.equal(rows[0].bestScore, 1400);
  assert.equal(rows[1].bestScore, 1200);
});

test("Hearts and Golf rank lower scores as better", () => {
  assert.deepEqual(leaderboardPolicy("hearts", true), { metric: "score", direction: "asc", label: "Best low score" });
  const rows = buildLeaderboardRows({
    one: { completedAt: 1, metric: "score", players: { a: { playerKey: "a", nickname: "A", score: 62, won: false }, b: { playerKey: "b", nickname: "B", score: 41, won: true } } },
    two: { completedAt: 2, metric: "score", players: { a: { playerKey: "a", nickname: "A", score: 37, won: true }, b: { playerKey: "b", nickname: "B", score: 55, won: false } } },
  }, "hearts");
  assert.equal(rows[0].nickname, "A");
  assert.equal(rows[0].bestScore, 37);
});

test("games without scores rank by all-time wins", () => {
  const history = {
    one: { completedAt: 1, metric: "wins", players: { a: { playerKey: "a", nickname: "A", won: true }, b: { playerKey: "b", nickname: "B", won: false } } },
    two: { completedAt: 2, metric: "wins", players: { a: { playerKey: "a", nickname: "A", won: false }, b: { playerKey: "b", nickname: "B", won: true } } },
    three: { completedAt: 3, metric: "wins", players: { a: { playerKey: "a", nickname: "A", won: false }, b: { playerKey: "b", nickname: "B", won: true } } },
  };
  const rows = buildLeaderboardRows(history, "chess");
  assert.equal(rows[0].nickname, "B");
  assert.equal(rows[0].wins, 2);
  assert.equal(rows[0].gamesPlayed, 3);
});

test("robots are excluded and Canasta team winners inherit the final team score", () => {
  const room = {
    roomCode: "ABC123",
    status: "gameOver",
    rules: { teamCount: 2 },
    members: {
      a: { uid: "a", nickname: "Alice", team: 0, seat: 0 },
      bot: { uid: "bot", nickname: "Ruby", team: 0, seat: 1, isRobot: true },
      b: { uid: "b", nickname: "Bob", team: 1, seat: 2 },
    },
    publicState: { phase: "gameOver", teamScores: [5210, 4810], winnerTeam: 0, gameEndedAt: 99 },
  };
  const result = extractCompletedRoomResult(room, "canasta");
  assert.equal(result.metric, "score");
  assert.equal(result.players.alice.score, 5210);
  assert.equal(result.players.alice.won, true);
  assert.equal(result.players.bob.score, 4810);
  assert.equal(result.players.bob.won, false);
  assert.equal(result.players.ruby, undefined);
});

test("Party Stage final scores infer a winner from score objects", () => {
  const room = {
    gameId: "punchline",
    status: "playing",
    members: {
      tv: { uid: "tv", nickname: "TV", displayOnly: true, seat: -1 },
      a: { uid: "a", nickname: "Alice", seat: 0 },
      b: { uid: "b", nickname: "Bob", seat: 1 },
    },
    gameState: { phase: "final", scores: { a: { score: 900 }, b: { score: 1200 } } },
  };
  const result = extractCompletedRoomResult(room);
  assert.equal(result.players.bob.won, true);
  assert.equal(result.players.bob.score, 1200);
});

test("same display name maps to one cross-device family leaderboard identity", () => {
  assert.equal(playerKey({ uid: "device-a", nickname: "Grandma Sue" }), "grandma-sue");
  assert.equal(playerKey({ uid: "device-b", nickname: "Grandma Sue" }), "grandma-sue");
});

test("completion ids distinguish rematches in the same room", () => {
  assert.notEqual(
    completionIdForRoom({ gameId: "punchline", roomCode: "ABCD", gameNumber: 1 }),
    completionIdForRoom({ gameId: "punchline", roomCode: "ABCD", gameNumber: 2 }),
  );
});

test("visible leaderboard is capped at twenty players", () => {
  const players = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`p${index}`, {
    playerKey: `p${index}`,
    nickname: `Player ${index}`,
    score: index,
    won: index === 24,
  }]));
  const rows = buildLeaderboardRows({ one: { completedAt: 1, metric: "score", players } }, "canasta");
  assert.equal(rows.length, 20);
  assert.equal(rows[0].bestScore, 24);
});
