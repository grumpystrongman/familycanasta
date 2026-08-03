import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./adaptiveCanastaNavigation.css";

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

export default function AdaptiveCanastaNavigation() {
  const [game, setGame] = useState(null);
  const [adaptive, setAdaptive] = useState(adaptiveEnabled);
  const [view, setView] = useState("hand");

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
    const root = document.documentElement;
    if (!game || !adaptive) {
      root.classList.remove("adaptive-canasta-navigation-active");
      if (game) {
        game.classList.remove("adaptive-canasta-navigation-ready");
        delete game.dataset.adaptiveView;
      }
      return undefined;
    }

    root.classList.add("adaptive-canasta-navigation-active");
    game.classList.add("adaptive-canasta-navigation-ready");
    game.dataset.adaptiveView = view;

    let timer = null;
    if (["score", "chat", "more"].includes(view)) {
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

  if (!game || !adaptive) return null;

  return createPortal(
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
    </nav>,
    document.body,
  );
}
