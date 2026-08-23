import { onValue, ref, runTransaction } from "firebase/database";
import { db, ensureAnonymousAuth } from "../firebase";
import {
  buildLeaderboardRows,
  completionIdForRoom,
  extractCompletedRoomResult,
  leaderboardPolicy,
  normalizeGameId,
  playerKey,
} from "./leaderboardModel.js";

function safeCompletionId(value) {
  return String(value || `local-${Date.now()}`).replace(/[.#$\[\]/]+/g, "-").slice(0, 120);
}

async function writeImmutableResult(result, completionId) {
  if (!db || !result?.gameId) return false;
  const target = ref(db, `leaderboardResults/${result.gameId}/${safeCompletionId(completionId)}`);
  const transaction = await runTransaction(target, (current) => {
    if (current) return;
    return result;
  }, { applyLocally: false });
  return transaction.committed;
}

export async function recordCompletedRoom(room, fallbackGameId = "", roomCode = "") {
  const result = extractCompletedRoomResult(room, fallbackGameId);
  if (!result || !db) return false;
  const completionId = completionIdForRoom({ ...room, gameId: result.gameId }, roomCode);
  return writeImmutableResult(result, completionId);
}

export async function recordStandaloneResult({ gameId, completionId, completedAt = Date.now(), players = [] }) {
  if (!db) return false;
  await ensureAnonymousAuth();
  const id = normalizeGameId(gameId);
  const humans = players.filter((player) => player && !player.isRobot && !player.isBot);
  if (!humans.length) return false;
  const hasScores = humans.some((player) => Number.isFinite(Number(player.score)));
  const policy = leaderboardPolicy(id, hasScores);
  const normalizedPlayers = {};
  for (const player of humans) {
    const key = playerKey(player);
    const entry = {
      playerKey: key,
      uid: String(player.uid || player.id || ""),
      nickname: String(player.nickname || player.name || "Player").trim() || "Player",
      avatar: player.avatar || "",
      won: Boolean(player.won),
    };
    if (player.score !== undefined && Number.isFinite(Number(player.score))) entry.score = Number(player.score);
    normalizedPlayers[key] = entry;
  }
  const result = {
    schemaVersion: 1,
    gameId: id,
    metric: policy.metric,
    direction: policy.direction,
    completedAt: Number(completedAt) || Date.now(),
    players: normalizedPlayers,
  };
  return writeImmutableResult(result, completionId || `${id}-local-${completedAt}`);
}

export function watchLeaderboardResults(gameId, callback) {
  if (!db) return () => {};
  const id = normalizeGameId(gameId);
  return onValue(ref(db, `leaderboardResults/${id}`), (snapshot) => callback(snapshot.val() || {}));
}

export function topLeaderboardRows(history, gameId, limit = 20) {
  return buildLeaderboardRows(history, gameId, limit);
}

export function leaderboardMetric(history, gameId) {
  const results = Object.values(history || {});
  const hasScores = results.some((result) => result?.metric === "score");
  return leaderboardPolicy(gameId, hasScores);
}
