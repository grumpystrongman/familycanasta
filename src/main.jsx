import React from "react";
import ReactDOM from "react-dom/client";
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
import "./homeRules.css";
import "./topActionBar.css";
import "./emotes.css";
import "./chatBubble.css";
import "./chatReadability.css";
import "./autoSort.css";
import "./responsiveBoard.css";
import "./classicCanastaLayout.css";
import "./actionHistory.css";

const rootElement = document.getElementById("root");

function errorDetail(error) {
  return error?.stack || error?.message || String(error || "Unknown startup error");
}

function StartupStatus({ title, detail }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <section style={{ maxWidth: "760px", padding: "28px", borderRadius: "18px", background: "rgba(255,255,255,0.96)", color: "#14241d", boxShadow: "0 18px 60px rgba(0,0,0,0.28)" }}>
        <h1 style={{ marginTop: 0 }}>{title}</h1>
        {detail ? <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{detail}</pre> : <p>Starting the game application.</p>}
        {detail ? <button type="button" onClick={() => window.location.reload()}>Reload</button> : null}
      </section>
    </main>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Family Canasta application render failed.", error, info);
  }

  render() {
    if (this.state.error) {
      return <StartupStatus title="Family Canasta could not start" detail={errorDetail(this.state.error)} />;
    }
    return this.props.children;
  }
}

class EnhancementBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error(`${this.props.name} was disabled after an error.`, error, info);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function showNonfatalError(name, error) {
  console.error(`${name} could not be loaded.`, error);
  const existing = document.getElementById("canasta-nonfatal-error");
  if (existing) return;
  const notice = document.createElement("div");
  notice.id = "canasta-nonfatal-error";
  notice.setAttribute("role", "status");
  notice.textContent = "An optional game display feature was disabled. Core play is still available.";
  Object.assign(notice.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "99999",
    maxWidth: "360px",
    padding: "12px 16px",
    borderRadius: "10px",
    background: "#fff4c7",
    color: "#3f3200",
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
    font: "600 14px/1.4 system-ui, sans-serif",
  });
  document.body.appendChild(notice);
}

const enhancementLoaders = [
  ["GameStateEnhancer", () => import("./GameStateEnhancer")],
  ["GameCelebration", () => import("./GameCelebration")],
  ["MultiMeldEnhancer", () => import("./MultiMeldEnhancer")],
  ["RedThreeBoard", () => import("./RedThreeBoard")],
  ["RedThreeTurnControl", () => import("./RedThreeTurnControl")],
  ["BlackThreeRuleFix", () => import("./BlackThreeRuleFix")],
  ["SafeDiscardRule", () => import("./SafeDiscardRule")],
  ["HomeRulesOptions", () => import("./HomeRulesOptions")],
  ["ScoringDisplayFix", () => import("./ScoringDisplayFix")],
  ["EmoteEnhancer", () => import("./EmoteEnhancer")],
  ["ChatBubbleEnhancer", () => import("./ChatBubbleEnhancer")],
  ["AutoSortEnhancer", () => import("./AutoSortEnhancer")],
  ["ResponsiveBoardEnhancer", () => import("./ResponsiveBoardEnhancer")],
  ["ActionHistoryEnhancer", () => import("./ActionHistoryEnhancer")],
];

async function mountEnhancement(name, load) {
  try {
    const module = await load();
    const Component = module.default;
    if (typeof Component !== "function") throw new Error(`${name} has no default React component export.`);

    const container = document.createElement("div");
    container.dataset.canastaEnhancement = name;
    container.style.display = "contents";
    document.body.appendChild(container);

    ReactDOM.createRoot(container).render(
      <EnhancementBoundary name={name}>
        <Component />
      </EnhancementBoundary>,
    );
  } catch (error) {
    showNonfatalError(name, error);
  }
}

async function startApplication() {
  if (!rootElement) throw new Error("Missing #root element in index.html");

  const root = ReactDOM.createRoot(rootElement);
  root.render(<StartupStatus title="Loading Family Canasta…" />);

  try {
    const module = await import("./App");
    const App = module.default;
    if (typeof App !== "function") throw new Error("App has no default React component export.");

    root.render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>,
    );

    window.setTimeout(() => {
      for (const [name, load] of enhancementLoaders) mountEnhancement(name, load);
    }, 250);
  } catch (error) {
    console.error("Family Canasta startup failed.", error);
    root.render(<StartupStatus title="Family Canasta could not start" detail={errorDetail(error)} />);
  }
}

window.addEventListener("unhandledrejection", (event) => {
  showNonfatalError("Background operation", event.reason);
});

startApplication().catch((error) => {
  console.error("Family Canasta bootstrap failed.", error);
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <StartupStatus title="Family Canasta could not start" detail={errorDetail(error)} />,
    );
  }
});
