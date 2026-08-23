import React, { useEffect } from "react";
import { recordStandaloneResult } from "./leaderboardService";

function selectedGameId() {
  return new URLSearchParams(window.location.search).get("game") || "";
}

function numberFromText(value) {
  const cleaned = String(value || "").replace(/[^0-9.-]+/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordSlumLord(root) {
  const modal = root.querySelector(".sl-game-over");
  if (!modal || modal.dataset.leaderboardRecorded === "true") return;
  const ranking = [...modal.querySelectorAll("ol li")];
  if (!ranking.length) return;

  const localNames = new Set(
    [...root.querySelectorAll(".sl-player-card")]
      .filter((card) => /\bLOCAL\b/i.test(card.querySelector("small")?.textContent || ""))
      .map((card) => card.querySelector("strong")?.textContent?.trim())
      .filter(Boolean),
  );
  if (!localNames.size) return;

  const winnerText = modal.querySelector("h2")?.textContent || "";
  const winnerName = winnerText.replace(/\s+wins\.?\s*$/i, "").trim();
  const players = ranking.map((row) => {
    const label = row.querySelector("span")?.textContent || "";
    const name = label.split("·")[0].trim();
    return {
      id: `local-${name}`,
      nickname: name,
      avatar: "🏚️",
      score: numberFromText(row.querySelector("b")?.textContent),
      won: name === winnerName,
      isBot: !localNames.has(name),
    };
  });

  modal.dataset.leaderboardRecorded = "true";
  recordStandaloneResult({
    gameId: "slumlord",
    completionId: `slumlord-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    players,
  }).catch(() => {
    delete modal.dataset.leaderboardRecorded;
  });
}

function recordLocalChompageddon(root) {
  const victory = root.querySelector(".chomp-victory");
  if (!victory || victory.dataset.leaderboardRecorded === "true") return;
  const scoreCards = [...root.querySelectorAll(".chomp-scoreboard article")];
  if (!scoreCards.length) return;

  const parsed = scoreCards.map((card) => {
    const label = card.querySelector("small")?.textContent || "";
    const name = label.includes("·") ? label.split("·").slice(1).join("·").trim() : label.trim();
    return {
      id: `local-${name}`,
      nickname: name || "Monster",
      avatar: "👹",
      score: numberFromText(card.querySelector("strong")?.textContent),
      isBot: !card.classList.contains("human"),
    };
  });
  const winningScore = Math.max(...parsed.map((player) => player.score));
  const players = parsed.map((player) => ({ ...player, won: player.score === winningScore }));

  victory.dataset.leaderboardRecorded = "true";
  recordStandaloneResult({
    gameId: "chompageddon",
    completionId: `chompageddon-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    players,
  }).catch(() => {
    delete victory.dataset.leaderboardRecorded;
  });
}

export default function StandaloneLeaderboardTracker() {
  useEffect(() => {
    const inspect = () => {
      const gameId = selectedGameId();
      if (gameId === "slumlord") recordSlumLord(document);
      if (gameId === "chompageddon") recordLocalChompageddon(document);
    };

    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
