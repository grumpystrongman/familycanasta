import { useEffect } from "react";
import "./strategyDashboard.css";

function teamLabel(index) {
  return ["Crimson", "Emerald", "Sapphire", "Gold"][index] || `Team ${index + 1}`;
}

function enhanceGame(root) {
  if (!root || root.dataset.strategyDashboardReady === "true") return;

  const table = root.querySelector(".table");
  const header = root.querySelector(":scope > header");
  const scoreRail = root.querySelector(".score-chat-sidebar");
  const opponents = table?.querySelector(".opponents");
  const boards = table?.querySelector(".shared-boards");
  const piles = table?.querySelector(".center");
  const hand = table?.querySelector(".hand");
  const advisor = hand?.querySelector(".selection-advisor");

  if (!table || !header || !scoreRail || !boards || !piles || !hand || !advisor) return;

  root.dataset.strategyDashboardReady = "true";
  root.classList.add("strategy-dashboard");

  const leftRail = document.createElement("aside");
  leftRail.className = "strategy-left-rail";
  leftRail.setAttribute("aria-label", "Team summaries");

  const leftTitle = document.createElement("div");
  leftTitle.className = "strategy-section-title";
  leftTitle.innerHTML = "<small>MATCH OVERVIEW</small><strong>Team status</strong>";
  leftRail.appendChild(leftTitle);

  const scoreContent = scoreRail.querySelector(".score-sidebar-content");
  if (scoreContent) leftRail.appendChild(scoreContent);
  if (opponents) leftRail.appendChild(opponents);

  const rightRail = document.createElement("aside");
  rightRail.className = "strategy-right-rail";
  rightRail.setAttribute("aria-label", "Game information and AI Coach");

  const pileSection = document.createElement("section");
  pileSection.className = "strategy-pile-section strategy-panel";
  pileSection.innerHTML = "<div class=\"strategy-panel-heading\"><small>SHARED PLAY</small><strong>Draw & discard</strong></div>";
  pileSection.appendChild(piles);

  const coach = document.createElement("details");
  coach.className = "strategy-coach strategy-panel";
  coach.open = true;
  coach.innerHTML = `
    <summary>
      <span class="coach-orb">AI</span>
      <span><small>DECISION SUPPORT</small><strong>AI Coach</strong></span>
      <span class="coach-collapse">⌄</span>
    </summary>
    <div class="coach-body">
      <div class="coach-label">Suggested move</div>
      <div class="coach-copy"></div>
      <div class="coach-metrics">
        <span><small>Confidence</small><b class="coach-confidence">—</b></span>
        <span><small>Risk</small><b class="coach-risk">—</b></span>
        <span><small>Expected</small><b class="coach-points">—</b></span>
      </div>
      <button type="button" class="coach-explain">Explain recommendation</button>
    </div>`;

  const actions = document.createElement("section");
  actions.className = "strategy-actions strategy-panel";
  actions.innerHTML = "<div class=\"strategy-panel-heading\"><small>YOUR TURN</small><strong>Possible actions</strong></div>";
  actions.appendChild(advisor);

  const log = document.createElement("section");
  log.className = "strategy-log strategy-panel";
  log.innerHTML = `
    <div class="strategy-panel-heading"><small>LIVE HISTORY</small><strong>Game log</strong></div>
    <div class="strategy-log-items" role="log" aria-live="polite"></div>`;

  const secondary = document.createElement("details");
  secondary.className = "strategy-secondary strategy-panel";
  secondary.innerHTML = "<summary>Table chat & score details</summary><div class=\"strategy-secondary-content\"></div>";
  secondary.querySelector(".strategy-secondary-content").appendChild(scoreRail);

  rightRail.append(pileSection, coach, actions, log, secondary);
  root.insertBefore(leftRail, table);
  root.insertBefore(rightRail, table.nextSibling);

  const boardTitle = document.createElement("div");
  boardTitle.className = "strategy-board-heading";
  boardTitle.innerHTML = "<div><small>SHARED PLAY AREA</small><strong>Team melds</strong></div><span>Rows scroll independently</span>";
  boards.parentElement.insertBefore(boardTitle, boards);

  boards.querySelectorAll(".shared-board").forEach((board, index) => {
    board.dataset.teamName = teamLabel(index);
    const title = board.querySelector(".board-title b");
    if (title) title.textContent = `Team ${teamLabel(index)}`;
    board.querySelectorAll(".board-meld").forEach((meld) => {
      const count = Number.parseInt(meld.querySelector("small")?.textContent || "0", 10);
      if (count >= 7) meld.classList.add("completed-canasta");
    });
  });

  const updateCoach = () => {
    const guidance = advisor.querySelector("span")?.textContent?.trim() || "Review your hand and choose a legal action.";
    const selectedText = advisor.querySelector("b")?.textContent || "0 selected · 0 points";
    const selectedCount = Number.parseInt(selectedText, 10) || 0;
    const pointsMatch = selectedText.match(/·\s*(\d+)\s*points/i);
    const points = pointsMatch ? Number(pointsMatch[1]) : 0;
    const isLegal = /legal play/i.test(guidance);
    const isDraw = /draw two cards|discard pile first/i.test(guidance);
    const isWarning = /need|choose matching|wild cards/i.test(guidance);

    coach.querySelector(".coach-copy").textContent = guidance;
    coach.querySelector(".coach-confidence").textContent = isLegal ? "High" : isDraw ? "High" : selectedCount ? "Medium" : "—";
    coach.querySelector(".coach-risk").textContent = isWarning ? "Elevated" : isLegal ? "Low" : "Moderate";
    coach.querySelector(".coach-points").textContent = points ? `+${points}` : "—";
    coach.classList.toggle("coach-positive", isLegal);
    coach.classList.toggle("coach-warning", isWarning);
  };

  const logItems = log.querySelector(".strategy-log-items");
  let lastAction = "";
  const updateLog = () => {
    const action = root.querySelector(".dealer-orb span")?.textContent?.trim();
    if (!action || action === lastAction) return;
    lastAction = action;
    const item = document.createElement("div");
    item.className = "strategy-log-entry";
    item.innerHTML = `<span></span><p>${action}</p><small>now</small>`;
    logItems.prepend(item);
    while (logItems.children.length > 6) logItems.lastElementChild.remove();
  };

  coach.querySelector(".coach-explain").addEventListener("click", () => {
    const copy = coach.querySelector(".coach-copy");
    copy.classList.toggle("expanded");
    copy.textContent = copy.classList.contains("expanded")
      ? `${copy.textContent} The coach prioritizes legal progress toward a canasta while preserving flexible wild cards and avoiding premature commitment.`
      : advisor.querySelector("span")?.textContent?.trim() || copy.textContent;
  });

  const observer = new MutationObserver(() => {
    updateCoach();
    updateLog();
    boards.querySelectorAll(".board-meld").forEach((meld) => {
      const count = Number.parseInt(meld.querySelector("small")?.textContent || "0", 10);
      meld.classList.toggle("completed-canasta", count >= 7);
    });
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });
  updateCoach();
  updateLog();
  root.__strategyDashboardObserver = observer;
}

export default function StrategyDashboardEnhancer() {
  useEffect(() => {
    const scan = () => enhanceGame(document.querySelector(".game-page.enhanced-game"));
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
