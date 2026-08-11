import React from "react";
import "../../partyStage.css";
import "../../platform/party/showrunnerBootstrap";
import PartyStageGame from "../../platform/party/PartyStageGame";
import { PARTY_INTRO_VIDEOS } from "../../platform/party/introVideos";
import { LAST_ONE_ALIVE_TRIVIA, lastOneAliveDefinition } from "./model";
import { LAST_ONE_ALIVE_EXTRA_TRIVIA } from "./triviaExpansion";

// model.js exports the actual mutable trivia array used by its reducer. Extending
// that shared array here keeps the stable engine intact while giving every
// question-selection path (normal rounds, resurrection, finale) the full bank.
for (const item of LAST_ONE_ALIVE_EXTRA_TRIVIA) {
  if (!LAST_ONE_ALIVE_TRIVIA.some((existing) => existing.q === item.q)) LAST_ONE_ALIVE_TRIVIA.push(item);
}

function randomIndex(indexes) {
  if (!indexes.length) return null;
  return indexes[Math.floor(Math.random() * indexes.length)];
}

function desiredDifficulty(state) {
  if (state?.phase === "finale") return 3;
  if (state?.phase === "resurrection") return 2;
  if (state?.phase !== "trivia") return null;
  if (state.round <= 2) return 1;
  if (state.round <= 4) return 2;
  return 3;
}

function tuneQuestionDifficulty(state) {
  const target = desiredDifficulty(state);
  if (!state || target == null) return state;
  const key = `${state.phase}:${state.round || 0}:${state.finaleStep || 0}`;
  if (state.difficultyKey === key) return state;

  const property = state.phase === "resurrection" ? "resurrectionQuestion" : state.phase === "finale" ? "finaleQuestion" : "questionIndex";
  const oldIndex = state[property];
  const used = new Set(state.usedQuestions || []);
  used.delete(oldIndex);
  const candidates = LAST_ONE_ALIVE_TRIVIA
    .map((question, index) => ({ question, index }))
    .filter(({ question, index }) => Number(question.d || 2) === target && !used.has(index))
    .map(({ index }) => index);
  const nextIndex = randomIndex(candidates);
  if (nextIndex == null) return { ...state, difficultyKey: key };

  const next = { ...state, [property]: nextIndex, difficultyKey: key };
  if (state.phase !== "finale") next.usedQuestions = [...used, nextIndex];
  return next;
}

function createGameState(players, settings) {
  return tuneQuestionDifficulty(lastOneAliveDefinition.createGameState(players, settings));
}

function reduceGameState(...args) {
  let next = lastOneAliveDefinition.reduceGameState(...args);
  if (next?.phase === "microgame" && next.microType === "oddOneOut") {
    next = { ...next, symbols: Array.from({ length: 9 }, () => "▲") };
  }
  return tuneQuestionDifficulty(next);
}

const definition = {
  ...lastOneAliveDefinition,
  trivia: LAST_ONE_ALIVE_TRIVIA,
  introVideo: PARTY_INTRO_VIDEOS.lastonealive,
  createGameState,
  reduceGameState,
};

export default function LastOneAliveGame() {
  return <PartyStageGame definition={definition} />;
}
