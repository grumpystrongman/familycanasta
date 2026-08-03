import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./adaptiveCanastaNavigation.css";
import "./adaptiveCanastaPlaySurface.css";
import "./adaptiveCanastaIpadProfiles.css";
import { readAdaptiveViewportMetrics } from "./adaptiveViewportProfile";

const VIEWS = [
  ["hand", "Hand"],
  ["board", "Board"],
  ["score", "Score"],
  ["chat", "Chat"],
  ["more", "More"],
];

function findGame() {
  return document.querySelector(".game-page.enhanced-game");
}

function adaptiveEnabled() {
  return document.documentElement.dataset.gameLayout === "adaptive";
}

function standaloneEnabled() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches
      || window.matchMedia?.("(display-mode: fullscreen)")?.matches
      || window.navigator?.standalone,
  );
}

function browserFullscreenEnabled() {
  if (typeof document === "undefined") return false;
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function screenMode() {
  if (browserFullscreenEnabled()) return "fullscreen";
  if (standaloneEnabled()) return "standalone";
  return "browser";
}

function clickSidebarTab(view) {
  const sidebar = document.querySelector(".score-chat-sidebar");
  const tabs = sidebar?.querySelector(".sidebar-tabs");
  if (!tabs) return false;

  let target = null;
  if (view === "score") target = tabs.querySelector("button:not(.table-actions-tab-button):nth-child(1)");
  if (view === "chat") target = tabs.querySelector("button:not(.table-actions-tab-button):nth-child(2)");
  if (view === "more") target = tabs.querySelector(".table-actions-tab-button");
  if (!target) return false;
  target.click();
  return true;
}

function clickMyBoard(game) {
  const button = game?.querySelector(".board-view-bar button:first-of-type");
  if (!button) return false;
  button.click();
  return true;
}

function updateDrawState(game) {
  if (!game) return;
  const drawAvailable = Boolean(game.querySelector(".center .pile-action:not(:disabled)"));
  game.dataset.adaptiveDrawState = drawAvailable ? "available" : "complete";
}

function applyViewportProfile(game) {
  if (!game || typeof window === "undefined") return;
  const root = document.documentElement;
  const metrics = readAdaptiveViewportMetrics(window);

  root.dataset.adaptiveViewportProfile = metrics.profile;
  root.dataset.adaptiveViewportOrientation = metrics.orientation;
  game.dataset.adaptiveViewportProfile = metrics.profile;
  game.dataset.adaptiveViewportOrientation = metrics.orientation;
  root.style.setProperty("--adaptive-visual-width", `${metrics.width}px`);
  root.style.setProperty("--adaptive-visual-height", `${metrics.height}px`);
}

function clearViewportProfile(game) {
  const root = document.documentElement;
  delete root.dataset.adaptiveViewportProfile;
  delete root.dataset.adaptiveViewportOrientation;
  root.style.removeProperty("--adaptive-visual-width");
  root.style.removeProperty("--adaptive-visual-height");
  if (game) {
    delete game.dataset.adaptiveViewportProfile;
    delete game.dataset.adaptiveViewportOrientation;
  }
}

export default function AdaptiveCanastaNavigation() {
  const [game, setGame] = useState(null);
  const [adaptive, setAdaptive] = useState(adaptiveEnabled);
  const [view, setView] = useState("hand");
  const [displayMode, setDisplayMode] = useState(screenMode);
  const [showFullscreenHelp, setShowFullscreenHelp] = useState(false);

  useEffect(() => {
    const scan = () => {
      setGame(findGame());
      setAdaptive(adaptiveEnabled());
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-game-layout"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const refresh = () => setDisplayMode(screenMode());
    const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");
    const fullscreenQuery = window.matchMedia?.("(display-mode: fullscreen)");
    document.addEventListener("fullscreenchange", refresh);
    document.addEventListener("webkitfullscreenchange", refresh);
    standaloneQuery?.addEventListener?.("change", refresh);
    fullscreenQuery?.addEventListener?.("change", refresh);
    return () => {
      document.removeEventListener("fullscreenchange", refresh);
      document.removeEventListener("webkitfullscreenchange", refresh);
      standaloneQuery?.removeEventListener?.("change", refresh);
      fullscreenQuery?.removeEventListener?.("change", refresh);
    };
  }, []);

  useEffect(() => {
    if (!game || !adaptive) {
      clearViewportProfile(game);
      return undefined;
    }

    let frame = 0;
    const refresh = () => applyViewportProfile(game);
    const scheduleRefresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(refresh);
    };

    refresh();
    window.addEventListener("resize", scheduleRefresh);
    window.addEventListener("orientationchange", scheduleRefresh);
    window.visualViewport?.addEventListener?.("resize", scheduleRefresh);
    window.visualViewport?.addEventListener?.("scroll", scheduleRefresh);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleRefresh);
      window.removeEventListener("orientationchange", scheduleRefresh);
      window.visualViewport?.removeEventListener?.("resize", scheduleRefresh);
      window.visualViewport?.removeEventListener?.("scroll", scheduleRefresh);
      clearViewportProfile(game);
    };
  }, [adaptive, game]);

  useEffect(() => {
    if (!game || !adaptive) return undefined;
    const refresh = () => updateDrawState(game);
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(game, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    return () => {
      observer.disconnect();
      delete game.dataset.adaptiveDrawState;
    };
  }, [adaptive, game]);

  useEffect(() => {
    const root = document.documentElement;
    if (!game || !adaptive) {
      root.classList.remove("adaptive-canasta-navigation-active");
      if (game) {
        game.classList.remove("adaptive-canasta-navigation-ready");
        delete game.dataset.adaptiveView;
        delete game.dataset.adaptiveDrawState;
      }
      return undefined;
    }

    root.classList.add("adaptive-canasta-navigation-active");
    game.classList.add("adaptive-canasta-navigation-ready");
    game.dataset.adaptiveView = view;
    updateDrawState(game);
    applyViewportProfile(game);

    let timer = null;
    if (view === "hand") {
      let attempts = 0;
      const focusBoard = () => {
        attempts += 1;
        if (!clickMyBoard(game) && attempts < 20) timer = window.setTimeout(focusBoard, 50);
      };
      timer = window.setTimeout(focusBoard, 0);
    } else if (["score", "chat", "more"].includes(view)) {
      let attempts = 0;
      const activate = () => {
        attempts += 1;
        if (!clickSidebarTab(view) && attempts < 20) timer = window.setTimeout(activate, 50);
      };
      timer = window.setTimeout(activate, 0);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
      root.classList.remove("adaptive-canasta-navigation-active");
      game.classList.remove("adaptive-canasta-navigation-ready");
      delete game.dataset.adaptiveView;
    };
  }, [adaptive, game, view]);

  useEffect(() => {
    if (!game || !adaptive) return undefined;
    const sidebar = game.querySelector(".score-chat-sidebar");
    const tabs = sidebar?.querySelector(".sidebar-tabs");
    if (!tabs) return undefined;

    const synchronize = (event) => {
      const button = event.target.closest("button");
      if (!button || !tabs.contains(button)) return;
      if (button.classList.contains("table-actions-tab-button")) setView("more");
      else {
        const appTabs = [...tabs.querySelectorAll("button:not(.table-actions-tab-button)")];
        setView(appTabs.indexOf(button) === 1 ? "chat" : "score");
      }
    };

    tabs.addEventListener("click", synchronize);
    return () => tabs.removeEventListener("click", synchronize);
  }, [adaptive, game]);

  async function toggleFullscreen() {
    if (!game) return;
    if (browserFullscreenEnabled()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        try {
          await exit.call(document);
        } catch {
          // The browser may already have left fullscreen through system chrome.
        }
      }
      return;
    }
    if (standaloneEnabled()) return;

    // Fullscreen the document rather than only the game node. The navigation,
    // rules, and other portal-mounted controls then remain inside the surface.
    const target = document.documentElement;
    const request = target.requestFullscreen || target.webkitRequestFullscreen;
    if (!request) {
      setShowFullscreenHelp(true);
      return;
    }

    try {
      await request.call(target, { navigationUI: "hide" });
    } catch {
      setShowFullscreenHelp(true);
    }
  }

  if (!game || !adaptive) return null;

  const fullscreenLabel = displayMode === "fullscreen"
    ? "Exit screen"
    : displayMode === "standalone"
      ? "App view"
      : "Full screen";

  return createPortal(
    <>
      <nav className="adaptive-canasta-navigation" aria-label="Canasta views">
        {VIEWS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={view === value ? "active" : ""}
            aria-current={view === value ? "page" : undefined}
            onClick={() => setView(value)}
          >
            <span aria-hidden="true">{value === "hand" ? "🂠" : value === "board" ? "▦" : value === "score" ? "#" : value === "chat" ? "●" : "•••"}</span>
            <b>{label}</b>
          </button>
        ))}
        <button
          type="button"
          className={`adaptive-fullscreen-button ${displayMode === "browser" ? "attention" : ""}`}
          aria-label={fullscreenLabel}
          disabled={displayMode === "standalone"}
          onClick={toggleFullscreen}
        >
          <span aria-hidden="true">{displayMode === "fullscreen" ? "↙" : "⛶"}</span>
          <b>{fullscreenLabel}</b>
        </button>
      </nav>

      {showFullscreenHelp ? (
        <div className="adaptive-fullscreen-help-backdrop" role="presentation" onClick={() => setShowFullscreenHelp(false)}>
          <section className="adaptive-fullscreen-help" role="dialog" aria-modal="true" aria-labelledby="adaptive-fullscreen-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="adaptive-fullscreen-close" aria-label="Close full screen help" onClick={() => setShowFullscreenHelp(false)}>×</button>
            <p>Use the whole iPad screen</p>
            <h2 id="adaptive-fullscreen-title">Launch Family Canasta as an app</h2>
            <ol>
              <li>Tap the browser Share button.</li>
              <li>Choose <strong>Add to Home Screen</strong>.</li>
              <li>Open Family Canasta from its new Home Screen icon.</li>
            </ol>
            <span>The installed game opens without the browser address and tab bars.</span>
            <button type="button" className="adaptive-fullscreen-done" onClick={() => setShowFullscreenHelp(false)}>Got it</button>
          </section>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
