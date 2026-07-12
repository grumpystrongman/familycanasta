import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./team.css";
import "./teamStyles.css";
import "./play.css";
import "./scoring.css";
import "./flexibleGame.css";
import "./wildTarget.css";
import "./cardAccessibility.css";
import "./boardAccessibility.css";
import "./multiMeld.css";
import "./redThreeBoard.css";
import "./redThreeTurn.css";
import "./safeDiscard.css";
import "./homeRules.css";
import "./bootstrapError.css";
import "./houseRulesLobby.css";

const rootElement = document.getElementById("root");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showStartupError(error) {
  const detail = error?.stack || error?.message || String(error || "Unknown startup error");
  rootElement.innerHTML = `
    <main class="startup-status">
      <section class="startup-card">
        <h1>Family Canasta could not start</h1>
        <p>The application files loaded, but JavaScript stopped during startup. Copy the error below so it can be fixed directly.</p>
        <pre>${escapeHtml(detail)}</pre>
        <button type="button" onclick="window.location.reload()">Reload</button>
      </section>
    </main>`;
}

if (!rootElement) {
  throw new Error("Missing #root element in index.html");
}

rootElement.innerHTML = `
  <main class="startup-status">
    <section class="startup-card">
      <h1>Loading Family Canasta…</h1>
      <p>Starting the game application.</p>
    </section>
  </main>`;

window.addEventListener("error", (event) => showStartupError(event.error || event.message));
window.addEventListener("unhandledrejection", (event) => showStartupError(event.reason));

import("./CanastaAppShell")
  .then(({ default: CanastaAppShell }) => {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <CanastaAppShell />
      </React.StrictMode>,
    );
  })
  .catch(showStartupError);
