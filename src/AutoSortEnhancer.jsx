import { useEffect } from "react";

const RANK_ORDER = ["A", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "3", "2", "JOKER"];
const SUIT_ORDER = ["♠", "♥", "♦", "♣", "★"];
const CARD_ID_TYPE = "text/card-id";

function createDataTransfer(initialCardId = "") {
  const values = new Map();
  const types = [];
  const setData = (type, value) => {
    values.set(type, String(value));
    if (!types.includes(type)) types.push(type);
  };
  if (initialCardId) setData(CARD_ID_TYPE, initialCardId);
  return {
    dropEffect: "move",
    effectAllowed: "move",
    files: [],
    items: [],
    types,
    clearData(type) {
      if (type) {
        values.delete(type);
        const typeIndex = types.indexOf(type);
        if (typeIndex >= 0) types.splice(typeIndex, 1);
        return;
      }
      values.clear();
      types.splice(0, types.length);
    },
    getData(type) { return values.get(type) || ""; },
    setData,
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
  const currentEntries = wrappers.map((wrapper, index) => cardSortEntry(wrapper, index));
  if (currentEntries.some((entry) => !entry.id)) throw new Error("The hand could not be sorted because a card identifier was unavailable.");
  const desiredEntries = [...currentEntries].sort(compareCards);
  const currentIds = currentEntries.map((entry) => entry.id);
  const wrappersById = new Map(currentEntries.map((entry) => [entry.id, entry.wrapper]));
  let moved = 0;
  desiredEntries.forEach((desired, targetIndex) => {
    const sourceIndex = currentIds.indexOf(desired.id);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
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

function clearSelectedCards() {
  const selected = Array.from(document.querySelectorAll(".game-page .hand .hand-card-wrap.selected-wrap .real-card"));
  selected.forEach((card) => card.click());
  return selected.length;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : "The hand could not be sorted.";
}

function findMountTarget() {
  return document.querySelector(".game-page .selection-advisor") || document.querySelector(".game-page .hand");
}

export default function AutoSortEnhancer() {
  useEffect(() => {
    const body = document.body;
    if (!body) return undefined;

    const toolbar = document.createElement("div");
    toolbar.className = "hand-arrange-toolbar";
    toolbar.setAttribute("aria-label", "Hand arrangement controls");

    const sortLabel = document.createElement("label");
    sortLabel.textContent = "Arrange";
    const sortMode = document.createElement("select");
    sortMode.setAttribute("aria-label", "Hand arrangement mode");
    sortMode.innerHTML = '<option value="rank">By rank</option>';
    sortLabel.append(sortMode);

    const sortButton = document.createElement("button");
    sortButton.type = "button";
    sortButton.className = "autosort-hand-button autosort-always-available";
    sortButton.title = "Automatically arrange your hand";
    sortButton.setAttribute("aria-label", "Auto arrange hand by rank and card type");
    sortButton.innerHTML = '<span aria-hidden="true">⇅</span><span>Auto arrange</span>';

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "clear-hand-selection-button";
    clearButton.textContent = "Clear selection";
    clearButton.setAttribute("aria-label", "Clear selected cards");

    const status = document.createElement("span");
    status.className = "autosort-hand-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    toolbar.append(sortLabel, sortButton, clearButton, status);
    let statusTimer;

    const announce = (message) => {
      status.textContent = message;
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(() => { status.textContent = ""; }, 2500);
    };

    const refresh = () => {
      const mountTarget = findMountTarget();
      const cardCount = document.querySelectorAll(".game-page .hand .cards > .hand-card-wrap").length;
      const selectedCount = document.querySelectorAll(".game-page .hand .hand-card-wrap.selected-wrap").length;
      sortButton.disabled = cardCount < 2;
      clearButton.disabled = selectedCount === 0;
      if (mountTarget && toolbar.parentElement !== mountTarget) mountTarget.prepend(toolbar);
    };

    const handleSort = () => {
      try {
        const result = autoSortVisibleHand();
        announce(result.moved > 0 ? `Arranged ${result.cardCount} cards by rank, with wild cards together.` : "Your hand is already arranged.");
      } catch (error) {
        announce(errorMessage(error));
      }
    };

    const handleClear = () => {
      const count = clearSelectedCards();
      announce(count ? `Cleared ${count} selected card${count === 1 ? "" : "s"}.` : "No cards are selected.");
    };

    sortButton.addEventListener("click", handleSort);
    clearButton.addEventListener("click", handleClear);
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      sortButton.removeEventListener("click", handleSort);
      clearButton.removeEventListener("click", handleClear);
      toolbar.remove();
    };
  }, []);

  return null;
}
