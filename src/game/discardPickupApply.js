export function applyImmediateDiscardPickup(hand = [], board = [], plan = {}) {
  if (plan.mode !== "immediate" || !plan.top) {
    throw new Error("An immediate discard-pile pickup plan is required.");
  }

  const usedIds = new Set(plan.usedHandCardIds || plan.usedNaturalIds || []);
  const supportCards = hand.filter((card) => usedIds.has(card.id));
  if (supportCards.length !== usedIds.size) {
    throw new Error("The cards used to take the discard pile are no longer in the player's hand.");
  }

  const committedCards = [plan.top, ...supportCards];
  const target = board.find((meld) => meld.rank === plan.top.rank);

  if (plan.existing) {
    if (!target) throw new Error(`The existing ${plan.top.rank} meld could not be found.`);
    target.cards = [...(target.cards || []), ...committedCards];
  } else {
    if (committedCards.length < 3) {
      throw new Error(`Taking the discard pile must create a three-card ${plan.top.rank} meld.`);
    }
    if (target) {
      target.cards = [...(target.cards || []), ...committedCards];
    } else {
      board.push({ rank: plan.top.rank, cards: committedCards });
    }
  }

  return {
    committedCards,
    remainingHand: [
      ...hand.filter((card) => !usedIds.has(card.id)),
      ...(plan.lowerPile || []),
    ],
  };
}
