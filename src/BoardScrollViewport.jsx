import { useEffect } from "react";
import "./boardScrollViewport.css";

const BOARD_GAP_PX = 12;
const MIN_BOARD_HEIGHT_PX = 170;

export function calculateBoardViewportHeight(boardTop, handTop) {
  return Math.max(MIN_BOARD_HEIGHT_PX, Math.floor(handTop - boardTop - BOARD_GAP_PX));
}

function findPlaySurfaces() {
  const game = document.querySelector(".game-page.responsive-board-ready");
  if (!game) return null;

  const boards = game.querySelector(".shared-boards");
  const hand = game.querySelector(".hand");
  if (!boards || !hand) return null;

  return { game, boards, hand };
}

export default function BoardScrollViewport() {
  useEffect(() => {
    let resizeObserver = null;
    let animationFrame = 0;
    let observedElements = [];

    const update = () => {
      const surfaces = findPlaySurfaces();
      if (!surfaces) return;

      const { game, boards, hand } = surfaces;
      if (window.matchMedia("(max-width: 850px)").matches) {
        game.style.removeProperty("--canasta-board-scroll-height");
        delete game.dataset.boardScrollReady;
        return;
      }

      const boardTop = boards.getBoundingClientRect().top;
      const handTop = hand.getBoundingClientRect().top;
      const height = calculateBoardViewportHeight(boardTop, handTop);

      game.style.setProperty("--canasta-board-scroll-height", `${height}px`);
      game.dataset.boardScrollReady = "true";
    };

    const bindObserver = () => {
      const surfaces = findPlaySurfaces();
      update();

      if (!surfaces || typeof ResizeObserver === "undefined") return;
      const nextElements = [surfaces.game, surfaces.boards, surfaces.hand];
      const unchanged = nextElements.every((element, index) => element === observedElements[index]);
      if (unchanged) return;

      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(scheduleUpdate);
      nextElements.forEach((element) => resizeObserver.observe(element));
      observedElements = nextElements;
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(bindObserver);
    };

    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    scheduleUpdate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();

      const game = document.querySelector(".game-page.responsive-board-ready");
      game?.style.removeProperty("--canasta-board-scroll-height");
      if (game) delete game.dataset.boardScrollReady;
    };
  }, []);

  return null;
}
