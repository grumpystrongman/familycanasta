const TERMINAL_PHASES = new Set([
  "game-over",
  "gameover",
  "final",
  "finished",
  "complete",
  "completed",
  "victory",
  "defeat",
  "ended",
]);

const LOW_SCORE_GAMES = new Set(["hearts", "golf"]);
const WIN_ONLY_GAMES = new Set([
  "chess",
  "checkers",
  "connect4",
  "battleship",
  "hnefatafl",
  "ers",
  "spoons",
  "bloodalibi",
  "pixelquest",
]);

export function normalizeGameId(value) {
  return String(value || "unknown").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "unknown";
}

export function playerKey(member = {}) {
  const name = String(member.nickname || member.name || "").trim().toLowerCase();
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (normalized) return normalized;
  const uid = String(member.uid || member.id || "player").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48);
  return uid || "player";
}

export function leaderboardPolicy(gameId, hasScores = false) {
  const id = normalizeGameId(gameId);
  if (WIN_ONLY_GAMES.has(id)) return { metric: "wins", direction: "desc", label: "Wins" };
  if (hasScores) {
    const direction = LOW_SCORE_GAMES.has(id) ? "asc" : "desc";
    return { metric: "score", direction, label: direction === "asc" ? "Best low score" : "High score" };
  }
  return { metric: "wins", direction: "desc", label: "Wins" };
}

function terminalPhase(room) {
  const phase = room?.gameState?.phase ?? room?.publicState?.phase ?? room?.status ?? "";
  return String(phase).trim().toLowerCase().replace(/[_ ]+/g, "-");
}

export function isCompletedRoom(room) {
  const phase = terminalPhase(room);
  const status = String(room?.status || "").trim().toLowerCase().replace(/[_ -]+/g, "");
  return TERMINAL_PHASES.has(phase) || status === "gameover" || status === "finished" || status === "complete";
}

function numericScore(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    for (const key of ["score", "points", "total"]) {
      const number = Number(value[key]);
      if (Number.isFinite(number)) return number;
    }
  }
  const number = Number(value);
  return value !== null && value !== "" && Number.isFinite(number) ? number : null;
}

export function scoreForMember(room, member) {
  const state = room?.gameState || room?.publicState || {};
  const uid = member?.uid || member?.id;
  const gameId = normalizeGameId(room?.gameId || "canasta");

  if (gameId === "canasta") {
    const team = Number(member?.team);
    const value = state?.teamScores?.[team];
    return numericScore(value);
  }

  for (const source of [state?.scores, state?.points, state?.totals]) {
    if (source && uid != null && Object.prototype.hasOwnProperty.call(source, uid)) {
      const value = numericScore(source[uid]);
      if (value !== null) return value;
    }
  }

  const statScore = numericScore(state?.stats?.[uid]);
  if (statScore !== null) return statScore;
  return null;
}

function addWinnerValue(set, value) {
  if (!value) return;
  if (typeof value === "string" || typeof value === "number") {
    set.add(String(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => addWinnerValue(set, item));
    return;
  }
  if (typeof value === "object") {
    addWinnerValue(set, value.uid ?? value.id ?? value.playerUid);
  }
}

function explicitWinnerIds(room) {
  const state = room?.gameState || room?.publicState || {};
  const winners = new Set();
  for (const value of [
    state.winnerUid,
    state.winnerUids,
    state.winnerId,
    state.winnerIds,
    state.winner,
    state.winners,
    state.victorUid,
    state.victorUids,
  ]) addWinnerValue(winners, value);
  return winners;
}

function humanMembers(room) {
  return Object.values(room?.members || {})
    .filter((member) => member && !member.isRobot && !member.displayOnly)
    .sort((a, b) => Number(a.seat || 0) - Number(b.seat || 0));
}

export function extractCompletedRoomResult(room, fallbackGameId = "") {
  if (!room || !isCompletedRoom(room)) return null;
  const gameId = normalizeGameId(room.gameId || fallbackGameId || "canasta");
  const state = room.gameState || room.publicState || {};
  const members = humanMembers(room);
  if (!members.length) return null;

  const scores = Object.fromEntries(members.map((member) => [member.uid, scoreForMember({ ...room, gameId }, member)]));
  const hasScores = Object.values(scores).some((score) => Number.isFinite(score));
  const policy = leaderboardPolicy(gameId, hasScores);
  const winners = explicitWinnerIds(room);

  if (gameId === "canasta" && state.winnerTeam !== undefined && state.winnerTeam !== null) {
    const winningTeam = Number(state.winnerTeam);
    members.filter((member) => Number(member.team) === winningTeam).forEach((member) => winners.add(String(member.uid)));
  }

  if (!winners.size && policy.metric === "score" && hasScores) {
    const finite = members.filter((member) => Number.isFinite(scores[member.uid]));
    if (finite.length) {
      const best = policy.direction === "asc"
        ? Math.min(...finite.map((member) => scores[member.uid]))
        : Math.max(...finite.map((member) => scores[member.uid]));
      finite.filter((member) => scores[member.uid] === best).forEach((member) => winners.add(String(member.uid)));
    }
  }

  const phase = terminalPhase(room);
  if (!winners.size && phase === "victory") members.forEach((member) => winners.add(String(member.uid)));

  const completedAt = Number(
    state.gameEndedAt || state.endedAt || state.completedAt || room.finishedAt || room.endedAt || Date.now(),
  );

  const players = {};
  for (const member of members) {
    const key = playerKey(member);
    const record = {
      playerKey: key,
      uid: String(member.uid || ""),
      nickname: String(member.nickname || member.name || "Player").trim() || "Player",
      avatar: member.avatar || "",
      won: winners.has(String(member.uid)),
    };
    if (Number.isFinite(scores[member.uid])) record.score = scores[member.uid];
    players[key] = record;
  }

  return {
    schemaVersion: 1,
    gameId,
    metric: policy.metric,
    direction: policy.direction,
    completedAt: Number.isFinite(completedAt) ? completedAt : Date.now(),
    players,
  };
}

export function completionIdForRoom(room, roomCode = "") {
  const gameId = normalizeGameId(room?.gameId || "canasta");
  const code = String(roomCode || room?.roomCode || "room");
  const instance = room?.gameNumber || room?.startedAt || room?.createdAt || room?.publicState?.gameEndedAt || 1;
  return `${gameId}-${code}-${instance}`.replace(/[.#$\[\]/]+/g, "-").slice(0, 120);
}

export function buildLeaderboardRows(history, gameId, limit = 20) {
  const results = Array.isArray(history) ? history : Object.values(history || {});
  const hasScores = results.some((result) => result?.metric === "score" || Object.values(result?.players || {}).some((player) => Number.isFinite(Number(player?.score))));
  const policy = leaderboardPolicy(gameId, hasScores);
  const byPlayer = new Map();

  for (const result of results) {
    for (const player of Object.values(result?.players || {})) {
      if (!player?.playerKey) continue;
      const current = byPlayer.get(player.playerKey) || {
        playerKey: player.playerKey,
        nickname: player.nickname || "Player",
        avatar: player.avatar || "",
        gamesPlayed: 0,
        wins: 0,
        bestScore: null,
        lastPlayedAt: 0,
      };
      current.nickname = player.nickname || current.nickname;
      current.avatar = player.avatar || current.avatar;
      current.gamesPlayed += 1;
      current.wins += player.won ? 1 : 0;
      current.lastPlayedAt = Math.max(current.lastPlayedAt, Number(result.completedAt || 0));
      const score = Number(player.score);
      if (player.score !== undefined && Number.isFinite(score)) {
        if (current.bestScore === null) current.bestScore = score;
        else if (policy.direction === "asc") current.bestScore = Math.min(current.bestScore, score);
        else current.bestScore = Math.max(current.bestScore, score);
      }
      byPlayer.set(player.playerKey, current);
    }
  }

  const rows = [...byPlayer.values()];
  rows.sort((a, b) => {
    if (policy.metric === "score") {
      const aMissing = a.bestScore === null;
      const bMissing = b.bestScore === null;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (!aMissing && a.bestScore !== b.bestScore) {
        return policy.direction === "asc" ? a.bestScore - b.bestScore : b.bestScore - a.bestScore;
      }
    } else if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.gamesPlayed !== b.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
    if (a.lastPlayedAt !== b.lastPlayedAt) return b.lastPlayedAt - a.lastPlayedAt;
    return a.nickname.localeCompare(b.nickname);
  });

  return rows.slice(0, Math.max(0, Number(limit) || 20));
}
