import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

const RANK_ORDER = ["A", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "3", "2", "JOKER"];
const SUIT_ORDER = ["♠", "♥", "♦", "♣", "★"];
const CARD_ID_TYPE = "text/card-id";
const AUTO_SORT_KEY = "canastaAutoSortAfterDraw";

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
    getData(type) {
      return values.get(type) || "";
    },
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
  if (currentEntries.some((entry) => !entry.id)) {
    throw new Error("The hand could not be sorted because a card identifier was unavailable.");
  }

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

function appendButtonLabel(button) {
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "⇅";

  const label = document.createElement("span");
  label.textContent = "Sort hand now";
  button.append(icon, label);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : "The hand could not be sorted.";
}

function findMountTarget() {
  return document.querySelector(".game-page .selection-advisor")
    || document.querySelector(".game-page .hand");
}

function handToken() {
  const wrappers = Array.from(document.querySelectorAll(".game-page .hand .cards > .hand-card-wrap"));
  const ids = wrappers.map(readCardId).filter(Boolean).sort();
  return ids.join("|");
}

function isOwnDrawOrPickup() {
  const turnText = document.querySelector(".game-page .turn")?.textContent || "";
  if (!turnText.includes("YOUR TURN")) return false;

  const nickname = document.querySelector(".game-page .hand .identity b")?.textContent?.trim() || "";
  const action = document.querySelector(".game-page .dealer-orb span")?.textContent?.trim() || "";
  if (!nickname || !action.startsWith(`${nickname} `)) return false;

  return action.includes(" drew ")
    || action.includes(" took the discard pile")
    || action.includes(" drew from the discard pile");
}

export default function AutoSortEnhancer() {
  useEffect(() => {
    const body = document.body;
    if (!body) return undefined;

    let currentUid = auth?.currentUser?.uid || "anonymous";
    let enabled = true;
    let statusTimer;
    let automaticTimer;
    let lastAutomaticToken = "";

    const preferenceKey = () => `${AUTO_SORT_KEY}:${currentUid}`;
    const readPreference = () => {
      const saved = window.localStorage.getItem(preferenceKey());
      return saved === null ? true : saved !== "false";
    };

    const button = document.createElement("button");
    button.type = "button";
    button.className = "autosort-hand-button autosort-always-available";
    button.title = "Sort your hand by rank at any time";
    button.dataset.availability = "any-turn";
    button.setAttribute("aria-label", "Sort hand by rank and card type now");
    appendButtonLabel(button);

    const preference = document.createElement("label");
    preference.className = "autosort-preference";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("aria-label", "Automatically sort my hand after drawing or taking the discard pile");
    const preferenceText = document.createElement("span");
    preference.append(checkbox, preferenceText);

    const status = document.createElement("span");
    status.className = "autosort-hand-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const syncPreferenceDisplay = () => {
      enabled = readPreference();
      checkbox.checked = enabled;
      preferenceText.textContent = enabled ? "Auto-sort after draw: On" : "Auto-sort after draw: Off";
      preference.classList.toggle("enabled", enabled);
    };

    const announce = (message) => {
      status.textContent = message;
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(() => {
        status.textContent = "";
      }, 2500);
    };

    const runSort = (automatic = false) => {
      try {
        const result = autoSortVisibleHand();
        if (!automatic) {
          announce(result.moved > 0
            ? `Sorted ${result.cardCount} cards into matching rank groups, with wild cards together.`
            : "Your hand is already sorted.");
        }
        return result;
      } catch (error) {
        announce(errorMessage(error));
        return null;
      }
    };

    const scheduleAutomaticSort = () => {
      if (!enabled || !isOwnDrawOrPickup()) return;
      const token = `${document.querySelector(".game-page .dealer-orb span")?.textContent?.trim() || ""}|${handToken()}`;
      if (!token || token === lastAutomaticToken) return;

      if (automaticTimer !== undefined) window.clearTimeout(automaticTimer);
      automaticTimer = window.setTimeout(() => {
        if (!enabled || !isOwnDrawOrPickup()) return;
        const latestToken = `${document.querySelector(".game-page .dealer-orb span")?.textContent?.trim() || ""}|${handToken()}`;
        if (!latestToken || latestToken === lastAutomaticToken) return;
        const result = runSort(true);
        if (result) lastAutomaticToken = latestToken;
      }, 120);
    };

    const refresh = () => {
      const mountTarget = findMountTarget();
      const cardCount = document.querySelectorAll(".game-page .hand .cards > .hand-card-wrap").length;

      button.disabled = cardCount < 2;

      if (mountTarget && button.parentElement !== mountTarget) {
        mountTarget.append(preference, button, status);
      }

      scheduleAutomaticSort();
    };

    const handleClick = () => runSort(false);
    const handlePreferenceChange = () => {
      enabled = checkbox.checked;
      window.localStorage.setItem(preferenceKey(), String(enabled));
      syncPreferenceDisplay();
      announce(enabled
        ? "Automatic sorting is on for your draws and discard-pile pickups."
        : "Automatic sorting is off. Your manual card order will be preserved.");
      if (enabled) scheduleAutomaticSort();
    };

    const unsubscribeAuth = auth
      ? onAuthStateChanged(auth, (user) => {
        currentUid = user?.uid || "anonymous";
        syncPreferenceDisplay();
        refresh();
      })
      : undefined;

    button.addEventListener("click", handleClick);
    checkbox.addEventListener("change", handlePreferenceChange);
    syncPreferenceDisplay();
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      unsubscribeAuth?.();
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      if (automaticTimer !== undefined) window.clearTimeout(automaticTimer);
      button.removeEventListener("click", handleClick);
      checkbox.removeEventListener("change", handlePreferenceChange);
      preference.remove();
      button.remove();
      status.remove();
    };
  }, []);

  return null;
}
