import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 760px)";

function makeButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

export default function ResponsiveBoardEnhancer() {
  useEffect(() => {
    let cleanup = () => {};

    function enhance() {
      const candidate = document.querySelector(".game-page.enhanced-game");
      if (candidate?.classList.contains("responsive-board-ready")) return;

      cleanup();
      const game = candidate;
      const table = game?.querySelector(".table");
      const boards = [...(game?.querySelectorAll(".shared-board") || [])];
      const sidebar = game?.querySelector(".score-chat-sidebar");
      const hand = game?.querySelector(".hand");
      const center = game?.querySelector(".center");
      if (!game || !table || !sidebar || !hand || !center || !boards.length) return;

      game.classList.add("responsive-board-ready");
      const disposers = [];
      const compactByDefault = boards.length >= 3 || window.innerWidth < 1180;

      boards.forEach((board, index) => {
        board.classList.toggle("board-collapsed", compactByDefault);
        const title = board.querySelector(".board-title");
        if (!title || title.querySelector(".board-view-toggle")) return;
        const toggle = makeButton(compactByDefault ? "Expand" : "Collapse", "board-view-toggle", () => {
          const collapsed = board.classList.toggle("board-collapsed");
          toggle.textContent = collapsed ? "Expand" : "Collapse";
          board.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        });
        toggle.setAttribute("aria-label", `Toggle team ${index + 1} board detail`);
        title.append(toggle);
        disposers.push(() => toggle.remove());
      });

      const viewBar = document.createElement("nav");
      viewBar.className = "board-view-bar";
      viewBar.setAttribute("aria-label", "Board view controls");
      const collapseAll = makeButton("Compact board", "compact-all", () => {
        boards.forEach((board) => board.classList.add("board-collapsed"));
        boards.forEach((board) => {
          const toggle = board.querySelector(".board-view-toggle");
          if (toggle) toggle.textContent = "Expand";
        });
      });
      const expandAll = makeButton("Full board", "expand-all", () => {
        boards.forEach((board) => board.classList.remove("board-collapsed"));
        boards.forEach((board) => {
          const toggle = board.querySelector(".board-view-toggle");
          if (toggle) toggle.textContent = "Collapse";
        });
      });
      viewBar.append(collapseAll, expandAll);
      table.prepend(viewBar);

      const mobileNav = document.createElement("nav");
      mobileNav.className = "mobile-game-nav";
      mobileNav.setAttribute("aria-label", "Mobile game navigation");
      const views = [
        ["hand", "Hand"],
        ["board", "Board"],
        ["score", "Score"],
        ["chat", "Chat"],
      ];

      function setMobileView(view) {
        game.dataset.mobileView = view;
        [...mobileNav.querySelectorAll("button")].forEach((button) => {
          const active = button.dataset.view === view;
          button.classList.toggle("active", active);
          button.setAttribute("aria-current", active ? "page" : "false");
        });
        if (view === "score" || view === "chat") {
          const tab = sidebar.querySelector(`.sidebar-tabs button:nth-child(${view === "score" ? 1 : 2})`);
          tab?.click();
        }
      }

      views.forEach(([view, label]) => {
        const button = makeButton(label, "", () => setMobileView(view));
        button.dataset.view = view;
        mobileNav.append(button);
      });
      game.append(mobileNav);
      setMobileView("hand");

      const media = window.matchMedia(MOBILE_QUERY);
      const syncMode = () => {
        game.classList.toggle("phone-layout", media.matches);
        if (!media.matches) delete game.dataset.mobileView;
        else if (!game.dataset.mobileView) setMobileView("hand");
      };
      syncMode();
      media.addEventListener("change", syncMode);

      cleanup = () => {
        media.removeEventListener("change", syncMode);
        viewBar.remove();
        mobileNav.remove();
        disposers.forEach((dispose) => dispose());
        game.classList.remove("responsive-board-ready", "phone-layout");
        delete game.dataset.mobileView;
      };
    }

    const observer = new MutationObserver(() => {
      const game = document.querySelector(".game-page.enhanced-game");
      if (!game || game.classList.contains("responsive-board-ready")) return;
      window.clearTimeout(observer.timer);
      observer.timer = window.setTimeout(enhance, 30);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();

    return () => {
      observer.disconnect();
      window.clearTimeout(observer.timer);
      cleanup();
    };
  }, []);

  return null;
}
