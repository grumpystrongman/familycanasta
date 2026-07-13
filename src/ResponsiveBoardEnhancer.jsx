import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TEAM_NAMES } from "./game/engine";

const VIEW_KEY = "canastaBoardView";
const CUSTOM_KEY = "canastaExpandedTeams";
const VALID_VIEWS = new Set(["focus", "compact", "full", "custom"]);

function readStoredView() {
  const stored = localStorage.getItem(VIEW_KEY) || "focus";
  return VALID_VIEWS.has(stored) ? stored : "focus";
}

function readStoredTeams() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

function currentTeamIndex(game) {
  const label = game?.querySelector(".identity small")?.textContent || "";
  return TEAM_NAMES.findIndex((name) => label.includes(name));
}

function expandedForView(view, teamIndex, boardCount, customTeams) {
  if (view === "full") return Array.from({ length: boardCount }, (_, index) => index);
  if (view === "compact") return [];
  if (view === "custom") return customTeams.filter((index) => index >= 0 && index < boardCount);
  if (teamIndex >= 0) return [teamIndex];
  return boardCount ? [0] : [];
}

function applyBoardState(game, view, customTeams) {
  if (!game) return;
  const boards = [...game.querySelectorAll(".shared-board")];
  const teamIndex = currentTeamIndex(game);
  const expanded = new Set(expandedForView(view, teamIndex, boards.length, customTeams));

  game.classList.add("responsive-board-ready");
  game.dataset.boardView = view;
  boards.forEach((board, index) => {
    const isExpanded = expanded.has(index);
    board.classList.toggle("board-collapsed", !isExpanded);
    board.classList.toggle("board-expanded", isExpanded);
    const title = board.querySelector(".board-title");
    if (title) {
      title.tabIndex = 0;
      title.setAttribute("role", "button");
      title.setAttribute("aria-expanded", String(isExpanded));
      title.setAttribute("aria-label", `${isExpanded ? "Collapse" : "Expand"} Team ${TEAM_NAMES[index] || index + 1} board`);
      title.title = isExpanded ? "Collapse this team board" : "Expand this team board";
    }
  });
}

export default function ResponsiveBoardEnhancer() {
  const [game, setGame] = useState(null);
  const [view, setView] = useState(readStoredView);
  const [customTeams, setCustomTeams] = useState(readStoredTeams);

  useEffect(() => {
    const locate = () => setGame(document.querySelector(".game-page.enhanced-game"));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!game) return undefined;
    const refresh = () => applyBoardState(game, view, customTeams);
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(game, { childList: true, subtree: true });
    window.addEventListener("resize", refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
    };
  }, [game, view, customTeams]);

  useEffect(() => {
    if (!game) return undefined;
    const toggleBoard = (event) => {
      const title = event.target.closest?.(".board-title");
      if (!title || !game.contains(title)) return;
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const board = title.closest(".shared-board");
      const boards = [...game.querySelectorAll(".shared-board")];
      const index = boards.indexOf(board);
      if (index < 0) return;

      const currentlyExpanded = !board.classList.contains("board-collapsed");
      const next = new Set(view === "custom"
        ? customTeams
        : expandedForView(view, currentTeamIndex(game), boards.length, customTeams));
      if (currentlyExpanded) next.delete(index);
      else next.add(index);
      const values = [...next].sort((a, b) => a - b);
      setCustomTeams(values);
      setView("custom");
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(values));
      localStorage.setItem(VIEW_KEY, "custom");
    };

    game.addEventListener("click", toggleBoard);
    game.addEventListener("keydown", toggleBoard);
    return () => {
      game.removeEventListener("click", toggleBoard);
      game.removeEventListener("keydown", toggleBoard);
    };
  }, [game, view, customTeams]);

  const controls = useMemo(() => [
    ["focus", "My board", "Keep your team expanded and summarize the other teams"],
    ["compact", "Compact all", "Summarize every team board"],
    ["full", "Full boards", "Show every card on every team board"],
  ], []);

  function chooseView(nextView) {
    setView(nextView);
    localStorage.setItem(VIEW_KEY, nextView);
  }

  if (!game) return null;

  return createPortal(
    <nav className="board-view-bar" aria-label="Board view controls">
      <span>Board view</span>
      {controls.map(([value, label, title]) => (
        <button
          type="button"
          className={view === value ? "active" : ""}
          aria-pressed={view === value}
          title={title}
          onClick={() => chooseView(value)}
          key={value}
        >
          {label}
        </button>
      ))}
    </nav>,
    document.body,
  );
}
