import { onValue, ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import {
  buildLeaderboardRows,
  completionIdForRoom,
  extractCompletedRoomResult,
  leaderboardPolicy,
  normalizeGameId,
} from "./leaderboardModel.js";

export async function recordCompletedRoom(room, fallbackGameId = "", roomCode = "") {
  const result = extractCompletedRoomResult(room, fallbackGameId);
  if (!result || !db) return false;
  const completionId = completionIdForRoom({ ...room, gameId: result.gameId }, roomCode);
  const target = ref(db, `leaderboardResults/${result.gameId}/${completionId}`);
  const transaction = await runTransaction(target, (current) => {
    if (current) return;
    return result;
  }, { applyLocally: false });
  return transaction.committed;
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
