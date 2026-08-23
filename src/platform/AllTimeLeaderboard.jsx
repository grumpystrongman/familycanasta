import React, { useEffect, useMemo, useState } from "react";
import { ensureAnonymousAuth, firebaseReady } from "../firebase";
import { GAME_CATALOG } from "../gameCatalog.js";
import {
  leaderboardMetric,
  topLeaderboardRows,
  watchLeaderboardResults,
} from "./leaderboardService";
import "./leaderboard.css";

function formatValue(value) {
  return Number(value || 0).toLocaleString();
}

export default function AllTimeLeaderboard() {
  const [gameId, setGameId] = useState("canasta");
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const game = GAME_CATALOG.find((candidate) => candidate.id === gameId) || GAME_CATALOG[0];
  const rows = useMemo(() => topLeaderboardRows(history, gameId, 20), [history, gameId]);
  const metric = useMemo(() => leaderboardMetric(history, gameId), [history, gameId]);
  const recordedGames = Object.keys(history || {}).length;

  useEffect(() => {
    let unsubscribe = null;
    let active = true;
    setLoading(true);
    setError("");
    setHistory({});

    if (!firebaseReady) {
      setLoading(false);
      setError("Online score history is unavailable until Firebase is configured.");
      return () => { active = false; };
    }

    ensureAnonymousAuth()
      .then(() => {
        if (!active) return;
        unsubscribe = watchLeaderboardResults(gameId, (nextHistory) => {
          if (!active) return;
          setHistory(nextHistory);
          setLoading(false);
        });
      })
      .catch((failure) => {
        if (!active) return;
        setLoading(false);
        setError(failure.message || "Could not load the all-time leaderboard.");
      });

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [gameId]);

  return (
    <section className="all-time-leaderboard" aria-labelledby="all-time-leaderboard-title">
      <header className="leaderboard-header">
        <div>
          <p className="hub-kicker">Family record book</p>
          <h2 id="all-time-leaderboard-title">All-time leaderboard</h2>
          <p>Every completed game is kept in history. The board shows only the top 20 players for the selected game.</p>
        </div>
        <div className="leaderboard-trophy" aria-hidden="true">🏆</div>
      </header>

      <div className="leaderboard-toolbar">
        <label>
          <span>Game</span>
          <select value={gameId} onChange={(event) => setGameId(event.target.value)}>
            {GAME_CATALOG.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
            ))}
          </select>
        </label>
        <div className="leaderboard-metric-card">
          <small>Ranking</small>
          <strong>{metric.label}</strong>
          <span>{metric.metric === "score" ? (metric.direction === "asc" ? "Lower is better" : "Higher is better") : "Most wins first"}</span>
        </div>
        <div className="leaderboard-metric-card">
          <small>Recorded</small>
          <strong>{formatValue(recordedGames)}</strong>
          <span>completed game{recordedGames === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="leaderboard-game-heading">
        <span className="leaderboard-game-icon" aria-hidden="true">{game?.icon || "🎲"}</span>
        <div><strong>{game?.name || "Game"}</strong><small>{metric.label} · Top 20 all time</small></div>
      </div>

      {loading ? <div className="leaderboard-empty">Loading the family record book…</div> : null}
      {!loading && error ? <div className="leaderboard-empty error">{error}</div> : null}
      {!loading && !error && rows.length === 0 ? (
        <div className="leaderboard-empty">
          <strong>No recorded finishes yet.</strong>
          <span>Finish a {game?.name || "game"} match and the first result will appear here automatically.</span>
        </div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr><th>Rank</th><th>Player</th><th>{metric.label}</th><th>Wins</th><th>Games</th></tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.playerKey} className={index < 3 ? `podium podium-${index + 1}` : ""}>
                  <td><span className="leaderboard-rank">{index + 1}</span></td>
                  <td><span className="leaderboard-player"><i aria-hidden="true">{row.avatar || "🎲"}</i><strong>{row.nickname}</strong></span></td>
                  <td className="leaderboard-primary-value">{metric.metric === "score" && row.bestScore !== null ? formatValue(row.bestScore) : formatValue(row.wins)}</td>
                  <td>{formatValue(row.wins)}</td>
                  <td>{formatValue(row.gamesPlayed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="leaderboard-footnote">Robots are excluded. A player name is the all-time identity, so the same display name continues the same family record across devices. Scoreless games use wins instead of inventing a fake score.</p>
    </section>
  );
}
