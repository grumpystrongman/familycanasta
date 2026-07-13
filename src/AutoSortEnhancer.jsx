import { useEffect } from "react";

const RANK_ORDER = ["A", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "3", "2", "JOKER"];
const SUIT_ORDER = ["♠", "♥", "♦", "♣", "★"];
const CARD_ID_TYPE = "text/card-id";

function createDataTransfer(initialCardId = "") {
  const values = new Map();
  if (initialCardId) values.set(CARD_ID_TYPE, initialCardId);

  return {
    dropEffect: "move",
    effectAllowed: "move",
    files: [],
    items: [],
    types: initialCardId ? [CARD_ID_TYPE] : [],
    clearData(type) {
      if (type) values.delete(type);
      else values.clear();
    },
    getData(type) {
      return values.get(type) || "";
    },
    setData(type, value) {
      values.set(type, String(value));
      if (!this.types.includes(type)) this.types.push(type);
    },
  };
}

function dispatchDragEvent(node, type, dataTransfer) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { configurable: true, value: dataTransfer });
  node.dispatchEvent(event);
}

function readCardId(wrapper) {
  const dataTransfer = createDataTransfer();
  dispatchDragEvent(wrapper, "dragstart", dataTransfer);
  return dataTransfer.getData(CARD_ID_TYPE);
}

function cardSortEntry(wrapper, index) {
  const label = wrapper.querySelector(".real-card")?.getAttribute("aria-label")?.trim() || "";
  const [rank = "", suit = ""] = label.split(/\s+/);
  return {
    id: readCardId(wrapper),
    index,
    rankIndex: RANK_ORDER.indexOf(rank),
    suitIndex: SUIT_ORDER.indexOf(suit),
    wrapper,
  };
}

function compareCards(a, b) {
  const aRank = a.rankIndex < 0 ? Number.MAX_SAFE_INTEGER : a.rankIndex;
  const bRank = b.rankIndex < 0 ? Number.MAX_SAFE_INTEGER : b.rankIndex;
  const aSuit = a.suitIndex < 0 ? Number.MAX_SAFE_INTEGER : a.suitIndex;
  const bSuit = b.suitIndex < 0 ? Number.MAX_SAFE_INTEGER : b.suitIndex;
  return aRank - bRank || aSuit - bSuit || a.index - b.index;
}

export function autoSortVisibleHand() {
  const wrappers = Array.from(document.querySelectorAll(".game-page .hand .cards > .hand-card-wrap"));
  if (wrappers.length < 2) return { cardCount: wrappers.length, moved: 0 };

  const currentEntries = wrappers.map(cardSortEntry);
  if (currentEntries.some((entry) => !entry.id)) {
    throw new Error("The hand could not be sorted because a card identifier was unavailable.");
  }

  const desiredEntries = [...currentEntries].sort(compareCards);
  const currentIds = currentEntries.map((entry) => entry.id);
  const wrappersById = new Map(currentEntries.map((entry) => [entry.id, entry.wrapper]));
  let moved = 0;

  desiredEntries.forEach((desired, targetIndex) => {
    const sourceIndex = currentIds.indexOf(desired.id);
    if (sourceIndex === targetIndex) return;

    const targetId = currentIds[targetIndex];
    const targetWrapper = wrappersById.get(targetId);
    if (!targetWrapper) return;

    dispatchDragEvent(targetWrapper, "drop", createDataTransfer(desired.id));
    currentIds.splice(sourceIndex, 1);
    currentIds.splice(targetIndex, 0, desired.id);
    moved += 1;
  });

  return { cardCount: wrappers.length, moved };
}

export default function AutoSortEnhancer() {
  useEffect(() => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "autosort-hand-button";
    button.title = "Group matching ranks, face cards, and wild cards";
    button.setAttribute("aria-label", "Auto-sort hand by rank and card type");
    button.innerHTML = '<span aria-hidden="true">⇅</span><span>Auto-sort hand</span>';

    const status = document.createElement("span");
    status.className = "autosort-hand-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    let statusTimer = null;

    const refresh = () => {
      const advisor = document.querySelector(".game-page .selection-advisor");
      const cardCount = document.querySelectorAll(".game-page .hand .cards > .hand-card-wrap").length;
      button.disabled = cardCount < 2;

      if (advisor && button.parentElement !== advisor) {
        advisor.append(button, status);
      }
    };

    const announce = (message) => {
      status.textContent = message;
      window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(() => {
        status.textContent = "";
      }, 2500);
    };

    const handleClick = () => {
      try {
        const result = autoSortVisibleHand();
        announce(result.moved > 0
          ? `Sorted ${result.cardCount} cards into matching rank groups, with wild cards together.`
          : "Your hand is already sorted.");
      } catch (error) {
        announce(error.message || "The hand could not be sorted.");
      }
    };

    button.addEventListener("click", handleClick);
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(refresh, 750);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      window.clearTimeout(statusTimer);
      button.removeEventListener("click", handleClick);
      button.remove();
      status.remove();
    };
  }, []);

  return null;
}
