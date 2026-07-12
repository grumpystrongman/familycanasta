export function dealOrderLength(publicState = {}) {
  const order = publicState?.dealOrder;
  if (Array.isArray(order)) return order.length;
  if (order && typeof order === "object") return Object.keys(order).length;
  return Math.max(0, Number(publicState?.dealAnimationIndex || 0));
}

export function buildRecoveredDealState(publicState) {
  if (!publicState || publicState.phase !== "dealing") return null;

  const finalIndex = Math.max(
    dealOrderLength(publicState),
    Number(publicState.dealAnimationIndex || 0),
  );

  return {
    ...publicState,
    phase: "playing",
    dealAnimationIndex: finalIndex,
    lastAction: "The first turn is ready.",
  };
}
