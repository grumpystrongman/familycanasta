import { isBlackThree, isWild } from "./engine.js";

export function discardFreezesPile(card, rules = {}) {
  return Boolean(isWild(card) && rules.freezeOnWild !== false);
}

export function shouldRepairBlackThreeFreeze(room) {
  const publicState = room?.publicState;
  const pile = publicState?.discardPile || [];
  const top = pile[pile.length - 1];

  // The opening pile is intentionally frozen until somebody takes it. A black
  // three on top of that opening pile must not cause the repair layer to open it.
  // After the pile has been taken, only an old black-three freeze is repaired;
  // an explicit wild-card freeze remains valid.
  return Boolean(
    publicState?.discardPileHasBeenTaken === true
    && publicState?.discardFrozen === true
    && publicState?.discardFreezeReason !== "wild"
    && isBlackThree(top)
  );
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
