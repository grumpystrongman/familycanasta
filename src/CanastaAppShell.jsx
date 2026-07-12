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
import HouseRulesLobbyController from "./components/HouseRulesLobbyController";

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
      <HouseRulesLobbyController />
    </>
  );
}
