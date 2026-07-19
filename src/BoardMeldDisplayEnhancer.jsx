import { useEffect } from "react";
import { canastaDisplayType, meldCardCount } from "./boardMeldDisplay";

function directChild(node, selector) {
  return Array.from(node?.children || []).find((child) => child.matches(selector)) || null;
}

function createCanastaCard(type, rank, count) {
  const card = document.createElement("div");
  card.className = `canasta-summary-card ${type}`;
  card.setAttribute("role", "img");
  card.setAttribute(
    "aria-label",
    `${type === "clean" ? "Clean" : "Dirty"} canasta of ${rank || "matching cards"}, ${count || 7} cards`,
  );

  const top = document.createElement("span");
  top.className = "canasta-summary-rank top";
  top.textContent = rank || "★";

  const center = document.createElement("strong");
  center.textContent = "CANASTA";

  const detail = document.createElement("small");
  detail.textContent = type === "clean" ? "CLEAN" : "DIRTY";

  const bottom = document.createElement("span");
  bottom.className = "canasta-summary-rank bottom";
  bottom.textContent = rank || "★";

  card.append(top, center, detail, bottom);
  return card;
}

export function enhanceBoardMelds(root = document) {
  root.querySelectorAll(".board-meld").forEach((meld) => {
    const rankNode = directChild(meld, "b");
    const cardsNode = directChild(meld, "div");
    const statusNode = directChild(meld, "small");
    if (!cardsNode || !statusNode) return;

    const type = canastaDisplayType(statusNode.textContent);
    const existingMarker = cardsNode.querySelector(":scope > .canasta-summary-card");

    meld.classList.toggle("canasta-complete", Boolean(type));
    meld.classList.toggle("clean-canasta", type === "clean");
    meld.classList.toggle("dirty-canasta", type === "dirty");

    if (!type) {
      existingMarker?.remove();
      cardsNode.removeAttribute("data-canasta-signature");
      return;
    }

    const rank = rankNode?.textContent?.trim() || "";
    const count = meldCardCount(statusNode.textContent);
    const signature = `${type}:${rank}:${count}`;
    if (cardsNode.dataset.canastaSignature === signature && existingMarker) return;

    existingMarker?.remove();
    cardsNode.appendChild(createCanastaCard(type, rank, count));
    cardsNode.dataset.canastaSignature = signature;
  });
}

export default function BoardMeldDisplayEnhancer() {
  useEffect(() => {
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        enhanceBoardMelds();
      });
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
