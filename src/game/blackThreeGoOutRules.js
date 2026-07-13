const isBlackThree = (card) => card?.rank === "3" && card?.color === "black";
const isRedThree = (card) => card?.rank === "3" && card?.color === "red";

export function blackThreeGoOutPlan(hand = [], selectedCards = [], teamOpened = false) {
  if (!Array.isArray(hand) || !Array.isArray(selectedCards)) {
    return { ok: false, reason: "The black-three go-out play could not be evaluated." };
  }

  if (!selectedCards.length || !selectedCards.every(isBlackThree)) {
    return { ok: false, reason: "Select only black threes for this go-out play." };
  }

  if (selectedCards.length < 3 || selectedCards.length > 4) {
    return { ok: false, reason: "A black-three go-out meld must contain exactly three or four black threes." };
  }

  if (!teamOpened) {
    return { ok: false, reason: "Complete your team’s opening first. Then you may go out with black threes later in the same turn." };
  }

  const selectedIds = new Set(selectedCards.map((card) => card.id));
  if (selectedIds.size !== selectedCards.length) {
    return { ok: false, reason: "The selected black threes could not be identified uniquely." };
  }

  if (selectedCards.some((card) => !hand.some((handCard) => handCard.id === card.id))) {
    return { ok: false, reason: "One of the selected black threes is no longer in your hand." };
  }

  const remainingCards = hand.filter((card) => !selectedIds.has(card.id));
  if (remainingCards.length > 1) {
    return {
      ok: false,
      reason: "Black threes may be melded only when this play, plus at most one final discard, empties your hand.",
      remainingCount: remainingCards.length,
    };
  }

  const finalDiscard = remainingCards[0] || null;
  if (finalDiscard && isRedThree(finalDiscard)) {
    return { ok: false, reason: "A red three cannot be used as the final discard." };
  }

  return {
    ok: true,
    selectedCards,
    finalDiscard,
    remainingCount: remainingCards.length,
  };
}
