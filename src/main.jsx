import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import GameStateEnhancer from "./GameStateEnhancer";
import GameCelebration from "./GameCelebration";
import MultiMeldEnhancer from "./MultiMeldEnhancer";
import RedThreeBoard from "./RedThreeBoard";
import RedThreeTurnControl from "./RedThreeTurnControl";
import BlackThreeRuleFix from "./BlackThreeRuleFix";
import SafeDiscardRule from "./SafeDiscardRule";
import "./styles.css";
import "./team.css";
import "./teamStyles.css";
import "./play.css";
import "./scoring.css";
import "./flexibleGame.css";
import "./stateEnhancer.css";
import "./gameCelebration.css";
import "./wildTarget.css";
import "./cardAccessibility.css";
import "./boardAccessibility.css";
import "./multiMeld.css";
import "./redThreeBoard.css";
import "./redThreeTurn.css";
import "./safeDiscard.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <GameStateEnhancer />
    <GameCelebration />
    <MultiMeldEnhancer />
    <RedThreeBoard />
    <RedThreeTurnControl />
    <BlackThreeRuleFix />
    <SafeDiscardRule />
  </React.StrictMode>
);
