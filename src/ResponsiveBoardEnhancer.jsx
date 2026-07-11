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

function listenForMediaChange(media, listener) {
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }

  if (typeof media.addListener === "function") {
    media.addListener(listener);
    return () => media.removeListener(listener);
  }

  return () => {};
}

export default function ResponsiveBoardEnhancer() {
  useEffect(() => {
    let cleanup = () => {};
    let pendingEnhance = 0;

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

      try {
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
            try {
              board.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            } catch {
              board.scrollIntoView();
            }
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
            const tabIndex = view === "score" ? 1 : 2;
            sidebar.querySelector(`.sidebar-tabs button:nth-child(${tabIndex})`)?.click();
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
        const stopListening = listenForMediaChange(media, syncMode);

        cleanup = () => {
          stopListening();
          viewBar.remove();
          mobileNav.remove();
          disposers.forEach((dispose) => dispose());
          game.classList.remove("responsive-board-ready", "phone-layout");
          delete game.dataset.mobileView;
        };
      } catch (error) {
        console.error("Responsive board enhancement failed", error);
        game.classList.remove("responsive-board-ready", "phone-layout");
        delete game.dataset.mobileView;
      }
    }

    const observer = new MutationObserver(() => {
      const game = document.querySelector(".game-page.enhanced-game");
      if (!game || game.classList.contains("responsive-board-ready")) return;
      window.clearTimeout(pendingEnhance);
      pendingEnhance = window.setTimeout(enhance, 30);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();

    return () => {
      observer.disconnect();
      window.clearTimeout(pendingEnhance);
      cleanup();
    };
  }, []);

  return null;
}
