import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import GameStateEnhancer from "./GameStateEnhancer";
import GameCelebration from "./GameCelebration";
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <GameStateEnhancer />
    <GameCelebration />
  </React.StrictMode>
);
