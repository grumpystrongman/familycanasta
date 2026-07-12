import React from "react";
import App from "./App";
import BlackThreeRuleFix from "./BlackThreeRuleFix";
import DealRecoveryController from "./DealRecoveryController";
import GameCelebration from "./GameCelebration";
import GameStateEnhancer from "./GameStateEnhancer";
import HomeRulesOptions from "./HomeRulesOptions";
import MultiMeldEnhancer from "./MultiMeldEnhancer";
import RedThreeBoard from "./RedThreeBoard";
import RedThreeTurnControl from "./RedThreeTurnControl";
import SafeDiscardRule from "./SafeDiscardRule";
import ScoringDisplayFix from "./ScoringDisplayFix";
import { resetIncompatibleSession } from "./sessionCompatibility";

if (typeof window !== "undefined") {
  try {
    resetIncompatibleSession(window.localStorage);
  } catch {
    // Storage access must never prevent the game from starting.
  }
}

export default function CanastaAppShell() {
  return (
    <>
      <App />
      <DealRecoveryController />
      <GameStateEnhancer />
      <GameCelebration />
      <MultiMeldEnhancer />
      <RedThreeBoard />
      <RedThreeTurnControl />
      <BlackThreeRuleFix />
      <SafeDiscardRule />
      <HomeRulesOptions />
      <ScoringDisplayFix />
    </>
  );
}
