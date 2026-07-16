import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  Layers3,
  Lightbulb,
  ListRestart,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

function useDashboardTargets() {
  const [targets, setTargets] = useState({ game: null, header: null, table: null });

  useEffect(() => {
    const resolve = () => {
      const game = document.querySelector(".game-page.enhanced-game");
      setTargets({
        game,
        header: game?.querySelector(":scope > header") || null,
        table: game?.querySelector(":scope > .table") || null,
      });
    };

    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return targets;
}

function Metric({ label, value, tone = "neutral" }) {
  return (
    <div className={`coach-metric tone-${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function PanelSection({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`premium-panel-section ${open ? "open" : "collapsed"}`}>
      <button className="premium-panel-heading" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span><Icon size={16} />{title}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open ? <div className="premium-panel-body">{children}</div> : null}
    </section>
  );
}

function clickGameAction(selector) {
  const target = document.querySelector(selector);
  if (target && !target.disabled) target.click();
}

function PremiumRightRail() {
  const [now, setNow] = useState(Date.now());
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("canasta-compact-mode", compact);
    return () => document.documentElement.classList.remove("canasta-compact-mode");
  }, [compact]);

  const actionState = useMemo(() => {
    const draw = document.querySelector(".center .pile-action:first-child");
    const take = document.querySelector(".center .pile-action:last-child");
    const meld = document.querySelector(".selection-advisor button:not(.discard-button)");
    const discard = document.querySelector(".selection-advisor .discard-button");
    return {
      drawDisabled: !draw || draw.disabled,
      takeDisabled: !take || take.disabled,
      meldDisabled: !meld || meld.disabled,
      discardDisabled: !discard || discard.disabled,
    };
  }, [now]);

  const selectedText = document.querySelector(".selection-advisor b")?.textContent || "0 selected · 0 points";
  const turnText = document.querySelector(".game-page > header .turn")?.textContent || "Waiting for the next turn";
  const lastAction = document.querySelector(".dealer-orb span")?.textContent || "Game ready";
  const recommendation = actionState.drawDisabled
    ? actionState.meldDisabled
      ? "Review your hand, then choose a safe discard."
      : "Build the strongest legal meld before discarding."
    : "Draw two cards unless the discard pile completes a strong meld.";

  return (
    <aside className="premium-right-rail" aria-label="AI coach, actions, and game log">
      <div className="right-rail-title">
        <div><Sparkles size={18} /><span>Table Intelligence</span></div>
        <button type="button" className="compact-toggle" onClick={() => setCompact((value) => !value)} aria-pressed={compact} title="Toggle compact mode">
          <Settings size={16} />
        </button>
      </div>

      <PanelSection title="AI Coach" icon={Bot}>
        <div className="coach-recommendation">
          <span><Lightbulb size={16} /> Recommended move</span>
          <strong>{recommendation}</strong>
          <p>{turnText}. {selectedText}.</p>
        </div>
        <div className="coach-metrics">
          <Metric label="Confidence" value="82%" tone="good" />
          <Metric label="Risk" value="Low" tone="good" />
          <Metric label="Expected" value="+35" tone="gold" />
          <Metric label="Outlook" value="Stable" tone="neutral" />
        </div>
        <button className="why-button" type="button"><Eye size={15} /> Why this move?</button>
        <div className="alternative-moves">
          <span><b>2</b> Hold wild cards for a canasta <em>Low risk</em></span>
          <span><b>3</b> Improve hand flexibility first <em>Medium risk</em></span>
        </div>
      </PanelSection>

      <PanelSection title="Possible Actions" icon={Target}>
        <div className="premium-actions-grid">
          <button type="button" disabled={actionState.drawDisabled} onClick={() => clickGameAction(".center .pile-action:first-child")}><Layers3 />Draw</button>
          <button type="button" disabled={actionState.takeDisabled} onClick={() => clickGameAction(".center .pile-action:last-child")}><ListRestart />Take Discard</button>
          <button type="button" disabled={actionState.meldDisabled} onClick={() => clickGameAction(".selection-advisor button:not(.discard-button)")}><TrendingUp />Meld</button>
          <button className="danger-action" type="button" disabled={actionState.discardDisabled} onClick={() => clickGameAction(".selection-advisor .discard-button")}><ShieldAlert />Discard</button>
        </div>
      </PanelSection>

      <PanelSection title="Game Log" icon={Activity}>
        <div className="premium-game-log" role="log" aria-live="polite">
          <article><time><Clock3 size={13} />Now</time><b>{lastAction}</b><span>Latest table action</span></article>
          <article><time><Clock3 size={13} />Turn</time><b>{turnText}</b><span>Current game state</span></article>
          <article><time><Clock3 size={13} />Hand</time><b>{selectedText}</b><span>Selection status</span></article>
        </div>
        <button className="full-log-button" type="button" onClick={() => document.querySelector('.sidebar-tabs button:last-child')?.click()}>View table chat</button>
      </PanelSection>
    </aside>
  );
}

function HeaderStatus() {
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => (value <= 1 ? 60 : value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stock = document.querySelector(".back-card span")?.textContent || "0";
  const discard = document.querySelector(".discard-face .real-card")?.getAttribute("aria-label") || "Empty";

  return (
    <div className="premium-header-status" aria-label="Round and pile status">
      <div><small>ROUND</small><b>Round in progress</b></div>
      <div><small>DRAW PILE</small><b>{stock} cards</b></div>
      <div><small>TOP DISCARD</small><b>{discard}</b></div>
      <div className={seconds <= 30 ? "timer-warning" : ""}><small>TIMER</small><b>{seconds}s</b></div>
    </div>
  );
}

export default function PremiumDashboardEnhancer() {
  const { game, header } = useDashboardTargets();
  if (!game || !header) return null;

  return (
    <>
      {createPortal(<HeaderStatus />, header)}
      {createPortal(<PremiumRightRail />, game)}
    </>
  );
}
