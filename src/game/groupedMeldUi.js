import { isWild } from "./engine.js";

export function naturalMeldRanks(cards = []) {
  return [...new Set(
    cards
      .filter((card) => card && !isWild(card) && card.rank !== "3")
      .map((card) => card.rank),
  )];
}

export function groupedMeldUiState({
  cards = [],
  plan = {},
  teamOpened = false,
  openingNeed = 0,
  pendingError = "",
} = {}) {
  const naturalRanks = naturalMeldRanks(cards);
  const grouped = naturalRanks.length > 1;
  const groups = Array.isArray(plan.groups) ? plan.groups : [];
  const groupCount = groups.filter((group) => group.rank !== "3" && group.rank !== "Wild").length;
  const points = Number(plan.totalPoints || 0);
  const need = Math.max(0, Number(openingNeed || 0));
  const remaining = Math.max(0, need - points);
  const openingSatisfied = teamOpened || remaining === 0;
  const planValid = Boolean(plan.valid);
  const canCommit = grouped && planValid && !pendingError && openingSatisfied;
  const meldWord = groupCount === 1 ? "meld" : "melds";

  let buttonText;
  let statusText;
  if (!planValid) {
    buttonText = "Fix incomplete melds";
    statusText = "Each new rank needs at least three cards, with more natural cards than wild cards.";
  } else if (pendingError) {
    buttonText = "Complete discard-pile opening";
    statusText = pendingError;
  } else if (teamOpened) {
    buttonText = `Play ${groupCount} ${meldWord} together · ${points} pts`;
    statusText = "Every selected rank group will be committed in one play.";
  } else if (openingSatisfied) {
    buttonText = `Open with ${groupCount} ${meldWord} together · ${points} pts`;
    statusText = "Ready. Every proposed meld will be committed together.";
  } else {
    buttonText = `Need ${remaining} more · ${points}/${need} pts`;
    statusText = `The legal groups total ${points} points. Add ${remaining} more point${remaining === 1 ? "" : "s"} before opening.`;
  }

  return {
    naturalRanks,
    grouped,
    groupCount,
    points,
    need,
    remaining,
    openingSatisfied,
    planValid,
    canCommit,
    buttonText,
    statusText,
  };
}
