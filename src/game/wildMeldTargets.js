import { isWild } from "./engine.js";

function normalizedWildLimit(rules = {}) {
  const configured = Number(rules?.maxWildsPerMeld || 3);
  return Number.isFinite(configured) && configured >= 0 ? configured : 3;
}

export function wildMeldTargetState(meld, selectedWildCount = 0, rules = {}) {
  const rank = String(meld?.rank || "");
  const cards = Array.isArray(meld?.cards) ? meld.cards : [];
  const incomingWilds = Math.max(0, Math.trunc(Number(selectedWildCount) || 0));
  const naturalCount = cards.filter((card) => !isWild(card)).length;
  const existingWildCount = cards.filter(isWild).length;
  const totalWildCount = existingWildCount + incomingWilds;
  const maxWilds = normalizedWildLimit(rules);

  if (!rank || !cards.length) {
    return {
      rank,
      legal: false,
      reason: "That meld is no longer available.",
      naturalCount,
      existingWildCount,
      totalWildCount,
      maxWilds,
    };
  }

  if (!incomingWilds) {
    return {
      rank,
      legal: false,
      reason: "Select a Two or Joker first.",
      naturalCount,
      existingWildCount,
      totalWildCount,
      maxWilds,
    };
  }

  if (totalWildCount > maxWilds) {
    return {
      rank,
      legal: false,
      reason: `This meld would have ${totalWildCount} wild cards; the limit is ${maxWilds}.`,
      naturalCount,
      existingWildCount,
      totalWildCount,
      maxWilds,
    };
  }

  if (totalWildCount >= naturalCount) {
    const neededNaturals = totalWildCount - naturalCount + 1;
    const naturalLabel = `${rank}${neededNaturals === 1 ? "" : "s"}`;
    const wildLabel = incomingWilds === 1 ? "this wild card" : "these wild cards";
    return {
      rank,
      legal: false,
      reason: `Add ${neededNaturals} more natural ${naturalLabel} before playing ${wildLabel} here.`,
      naturalCount,
      existingWildCount,
      totalWildCount,
      maxWilds,
    };
  }

  return {
    rank,
    legal: true,
    reason: "",
    naturalCount,
    existingWildCount,
    totalWildCount,
    maxWilds,
  };
}

export function wildMeldTargetOptions(board = [], selectedWildCount = 0, rules = {}) {
  return (Array.isArray(board) ? board : []).map((meld) => (
    wildMeldTargetState(meld, selectedWildCount, rules)
  ));
}
