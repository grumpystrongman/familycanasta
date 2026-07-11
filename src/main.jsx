import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import GameStateEnhancer from "./GameStateEnhancer";
import "./styles.css";
import "./team.css";
import "./teamStyles.css";
import "./play.css";
import "./scoring.css";
import "./flexibleGame.css";
import "./stateEnhancer.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <GameStateEnhancer />
  </React.StrictMode>
);
