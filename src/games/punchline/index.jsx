import React from "react";
import "../../partyStage.css";
import "../../platform/party/showrunnerBootstrap";
import PartyStageGame from "../../platform/party/PartyStageGame";
import { PARTY_INTRO_VIDEOS } from "../../platform/party/introVideos";
import { PUNCHLINE_PROMPTS, punchlineDefinition } from "./model";
import { PUNCHLINE_EXTRA_PROMPTS, PUNCHLINE_EXTRA_SPICY_PROMPTS } from "./contentExpansion";

const ORIGINAL_SPICY_PROMPTS = [
  "The worst possible text to accidentally send your ex at 2:00 a.m.: ____.",
  "A phrase that instantly kills the mood on a romantic weekend: ____.",
  "The least sexy thing someone can whisper while opening a bottle of wine: ____.",
  "A terrible safe word for assembling IKEA furniture together: ____.",
  "The dating-app bio line that guarantees your friends stage an intervention: ____.",
  "A suspicious item to find in the bedside-table drawer at an Airbnb: ____.",
  "The worst excuse for why there is glitter all over the bedroom: ____.",
  "A terrible pickup line to use at a family reunion: ____.",
  "The sentence you never want to hear immediately after 'Trust me': ____.",
  "A bad thing to discover your date has brought to a romantic picnic: ____.",
  "The least reassuring phrase on a honeymoon hotel welcome card: ____.",
  "The weirdest thing to yell when the bedroom door suddenly opens: ____.",
  "A terrible couples-therapy icebreaker: 'Tonight we're going to discuss ____.'",
  "The most suspicious purchase to hide on a shared credit-card statement: ____.",
  "A terrible nickname to accidentally use for your partner in front of their parents: ____.",
  "The worst thing for a wedding DJ to announce before the first dance: ____.",
  "A phrase that should never appear on the label of massage oil: ____.",
  "The least romantic reason to light twelve candles: ____.",
  "A terrible answer to 'So, what are you looking for in a relationship?': ____.",
  "The one thing you should never compare your partner to during an argument: ____.",
  "The strangest thing to bring on a first date 'just in case': ____.",
  "A terrible product name for an adults-only scented candle: ____.",
  "The phrase guaranteed to make everyone uncomfortable in a hotel hot tub: ____.",
  "The least believable explanation for a mysterious pair of handcuffs: ____.",
];

const CLEAN_POOL = [...PUNCHLINE_PROMPTS, ...PUNCHLINE_EXTRA_PROMPTS];
const SPICY_POOL = [...ORIGINAL_SPICY_PROMPTS, ...PUNCHLINE_EXTRA_SPICY_PROMPTS];

function drawPrompts(pool, count, used = []) {
  const usedSet = new Set(used);
  let available = pool.filter((prompt) => !usedSet.has(prompt));
  if (available.length < count) available = [...pool];
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}

function applyPromptPool(state, settings) {
  if (!state) return state;
  const pool = settings?.spice === "spicier" ? SPICY_POOL : CLEAN_POOL;
  const used = state.usedPromptTexts || [];

  if (state.phase === "answer" && state.contentAppliedRound !== state.round) {
    const ids = Object.keys(state.prompts || {});
    const selected = drawPrompts(pool, ids.length, used);
    const prompts = Object.fromEntries(ids.map((id, index) => [id, selected[index] || state.prompts[id]]));
    return {
      ...state,
      prompts,
      contentAppliedRound: state.round,
      usedPromptTexts: [...used, ...selected].slice(-Math.min(pool.length, 240)),
    };
  }

  if (state.phase === "finaleAnswer" && state.contentAppliedRound !== 4) {
    const [selected] = drawPrompts(pool, 1, used);
    return {
      ...state,
      finalePrompt: `FINAL CROWD PLEASER — ${selected || state.finalePrompt}`,
      contentAppliedRound: 4,
      usedPromptTexts: selected ? [...used, selected].slice(-Math.min(pool.length, 240)) : used,
    };
  }
  return state;
}

function createGameState(players, settings) {
  return applyPromptPool(punchlineDefinition.createGameState(players, settings), settings);
}

function reduceGameState(state, actor, action, players, settings, hostUid) {
  let next = punchlineDefinition.reduceGameState(state, actor, action, players, settings, hostUid);
  if (!next.usedPromptTexts?.length && state?.usedPromptTexts?.length) next = { ...next, usedPromptTexts: state.usedPromptTexts };
  return applyPromptPool(next, settings);
}

const definition = {
  ...punchlineDefinition,
  introVideo: PARTY_INTRO_VIDEOS.punchline,
  createGameState,
  reduceGameState,
};

export default function PunchlineGame() {
  return <PartyStageGame definition={definition} />;
}
