import { isWild } from "./engine.js";

export function discardFreezesPile(card, rules = {}) {
  return Boolean(isWild(card) && rules.freezeOnWild !== false);
}

export function applyDiscardFreezeState(publicState, card, rules = {}) {
  if (!publicState) return false;

  const freezes = discardFreezesPile(card, rules);
  if (freezes) {
    publicState.discardFrozen = true;
    publicState.discardFreezeReason = "wild";
    return true;
  }

  // Once the pile has been picked up, it stays open through ordinary and
  // black-three discards. Only a subsequently discarded two or Joker may
  // freeze it again.
  if (publicState.discardPileHasBeenTaken === true) {
    publicState.discardFrozen = false;
    publicState.discardFreezeReason = null;
  }

  return false;
}
