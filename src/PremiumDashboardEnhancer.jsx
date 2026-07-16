import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  ChevronDown,
  Clock3,
  Download,
  Layers3,
  Lightbulb,
  MessageCircle,
  Settings,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";

const TEAM_COLORS = ["blue", "red", "green", "gold"];

function readBoardState() {
  const game = document.querySelector(".game-page.enhanced-game");
  if (!game) return null;

  const scoreCards = [...game.querySelectorAll(".score-team-card")];
  const opponents = [...game.querySelectorAll(".opponents article")];
  const boards = [...game.querySelectorAll(".shared-board")];
  const turn = game.querySelector(":scope > header .turn")?.textContent?.trim() || "Waiting for turn";
  const lastAction = game.querySelector(".dealer-orb span")?.textContent?.trim() || "Game ready";
  const stock = game.querySelector(".back-card span")?.textContent?.trim() || "0";
  const discardCard = game.querySelector(".discard-face .real-card");
  const discardLabel = discardCard?.getAttribute("aria-label") || "Empty";
  const selected = game.querySelector(".selection-advisor b")?.textContent?.trim() || "0 selected · 0 points";

  const players = scoreCards.map((card, index) => {
    const name = card.querySelector(".score-team-head b")?.textContent?.trim() || `TEAM ${index + 1}`;
    const score = card.querySelector(".score-team-head strong")?.textContent?.trim() || "0";
    const lines = [...card.querySelectorAll(".score-lines span")];
    const lineValue = (label) => lines.find((line) => line.querySelector("i")?.textContent?.toLowerCase().includes(label))?.querySelector("b")?.textContent?.trim() || "0";
    const board = boards[index];
    const melds = board?.querySelectorAll(".board-meld").length || 0;
    const cards = opponents[index]?.querySelector("small")?.textContent?.match(/\d+/)?.[0] || "—";
    return {
      name,
      score,
      canastas: Number(lineValue("clean").split("·")[0] || 0) + Number(lineValue("dirty").split("·")[0] || 0),
      melds,
      cards,
      redThrees: lineValue("red threes").split("·")[0] || "0",
      lastAction: index === 0 ? lastAction : opponents[index]?.querySelector("small")?.textContent || "Waiting",
      active: opponents[index]?.classList.contains("active-player") || (index === 0 && turn.includes("YOUR TURN")),
      color: TEAM_COLORS[index] || "gold",
    };
  });

  return { game, header: game.querySelector(":scope > header"), players, turn, lastAction, stock, discardLabel, selected };
}

function useBoardState() {
  const [state, setState] = useState(() => readBoardState());
  useEffect(() => {
    const update = () => setState(readBoardState());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    const timer = window.setInterval(update, 1000);
    return () => { observer.disconnect(); window.clearInterval(timer); };
  }, []);
  return state;
}

function clickGameAction(selector) {
  const target = document.querySelector(selector);
  if (target && !target.disabled) target.click();
}

function HeaderDashboard({ state }) {
  const [seconds, setSeconds] = useState(84);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => (value <= 0 ? 90 : value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <div className="mock-header-dashboard">
      <div className="mock-score-strip">
        {state.players.slice(0, 3).map((player) => (
          <div className={`mock-score-tile tone-${player.color}`} key={player.name}>
            <span>{player.name}</span><b>{player.score}</b><small>{player.canastas} CANASTAS</small>
          </div>
        ))}
        <div className="mock-round"><span>ROUND</span><b>6</b><small>OF 15</small></div>
      </div>
      <div className="mock-piles">
        <button type="button" className="mock-pile" onClick={() => clickGameAction(".center .pile-action:first-child")}>
          <span>DRAW PILE</span><div className="mock-card-back"><i>♠</i></div><b>{state.stock}</b><small>CARDS LEFT</small>
        </button>
        <button type="button" className="mock-pile" onClick={() => clickGameAction(".center .pile-action:last-child")}>
          <span>DISCARD PILE</span><div className="mock-discard-card"><strong>{state.discardLabel.split(" ")[0]}</strong><i>♦</i></div><b>—</b><small>TOP CARD</small>
        </button>
      </div>
      <div className="mock-last-play"><small>LAST PLAY</small><span>{state.lastAction}</span></div>
      <div className={`mock-timer ${seconds < 30 ? "warning" : ""}`}><small>TIMER</small><b>{mins}:{secs}</b><span>{state.turn.includes("YOUR TURN") ? "YOUR TURN" : "IN PLAY"}</span></div>
      <button type="button" className="mock-settings" aria-label="Settings"><Settings/><span>SETTINGS</span></button>
    </div>
  );
}

function LeftRail({ players }) {
  return (
    <aside className="mock-left-rail" aria-label="Player summaries">
      <div className="mock-player-stack">
        {players.slice(0, 3).map((player, index) => (
          <article className={`mock-player-card tone-${player.color} ${player.active ? "active" : ""}`} key={`${player.name}-${index}`}>
            <header><span className="status-dot"/><b>{player.name}</b>{index === 0 ? <em>YOU</em> : null}</header>
            <strong>{player.score}</strong>
            <dl>
              <div><dt>Canastas</dt><dd>{player.canastas}</dd></div>
              <div><dt>Melds</dt><dd>{player.melds}</dd></div>
              <div><dt>Cards Left</dt><dd>{player.cards}</dd></div>
              <div><dt>Red Threes</dt><dd>{player.redThrees}</dd></div>
            </dl>
            <footer><span>Last Action</span><b>{player.lastAction}</b></footer>
          </article>
        ))}
      </div>
      <div className="mock-left-tools"><button aria-label="Table chat" onClick={() => document.querySelector('.sidebar-tabs button:last-child')?.click()}><MessageCircle/></button><button aria-label="Statistics"><BarChart3/></button></div>
    </aside>
  );
}

function CoachPanel({ state }) {
  const canMeld = !document.querySelector(".selection-advisor button:not(.discard-button)")?.disabled;
  const recommendation = canMeld ? "Play the selected cards into your strongest legal meld." : "Keep flexible cards together and avoid exposing a useful discard.";
  return (
    <section className="mock-panel coach-panel">
      <h2><span><Sparkles/> AI COACH</span><ChevronDown/></h2>
      <div className="mock-recommendation"><small>RECOMMENDED MOVE</small><strong>{recommendation}</strong><p>{state.selected}. The recommendation updates from the current turn and selection state.</p>
        <div className="mock-metrics"><span><small>CONFIDENCE</small><b>High</b></span><span><small>RISK</small><b>Low</b></span><span><small>EV</small><b>+50</b></span><span><small>POINTS</small><b>+50</b></span><span><small>OUTLOOK</small><b>Improves ↑</b></span></div>
        <button type="button"><Lightbulb/> Why this move?</button>
      </div>
      <div className="mock-alternatives"><small>ALTERNATIVE MOVES</small><div><b>1</b><span>Hold wild cards</span><em>Medium risk</em><strong>+25 pts</strong></div><div><b>2</b><span>Improve an existing meld</span><em>Lower value</em><strong>+20 pts</strong></div><button type="button">View more options</button></div>
    </section>
  );
}

function ActionsPanel() {
  const actions = useMemo(() => [
    ["DRAW", "FROM STOCK", Layers3, ".center .pile-action:first-child", "blue"],
    ["TAKE", "DISCARD", Download, ".center .pile-action:last-child", "green"],
    ["MELD", "CARDS", Target, ".selection-advisor button:not(.discard-button)", "purple"],
    ["DISCARD", "CARD", Trash2, ".selection-advisor .discard-button", "red"],
  ], []);
  return <section className="mock-panel actions-panel"><h2>POSSIBLE ACTIONS</h2><div>{actions.map(([label, sub, Icon, selector, tone]) => { const disabled = document.querySelector(selector)?.disabled ?? true; return <button className={`tone-${tone}`} disabled={disabled} onClick={() => clickGameAction(selector)} key={label}><Icon/><b>{label}</b><small>{sub}</small></button>; })}</div></section>;
}

function GameLog({ state }) {
  const entries = [state.lastAction, state.turn, state.selected, "Table state synchronized", "Coach recommendation updated"];
  return <section className="mock-panel log-panel"><h2>GAME LOG</h2><div>{entries.map((entry, index) => <p key={`${entry}-${index}`}><time><Clock3/> {index ? `10:${42-index} AM` : "NOW"}</time><span>{entry}</span></p>)}</div><button type="button" onClick={() => document.querySelector('.sidebar-tabs button:last-child')?.click()}>VIEW FULL LOG</button></section>;
}

function RightRail({ state }) {
  return <aside className="mock-right-rail"><CoachPanel state={state}/><ActionsPanel/><GameLog state={state}/></aside>;
}

export default function PremiumDashboardEnhancer() {
  const state = useBoardState();
  if (!state?.game || !state.header) return null;
  return <>{createPortal(<HeaderDashboard state={state}/>, state.header)}{createPortal(<LeftRail players={state.players}/>, state.game)}{createPortal(<RightRail state={state}/>, state.game)}</>;
}
