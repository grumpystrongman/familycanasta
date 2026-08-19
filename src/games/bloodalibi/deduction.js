export function theoryCardIds(theory = {}) {
  return [
    theory.suspectId ? `suspect:${theory.suspectId}` : null,
    theory.methodId ? `method:${theory.methodId}` : null,
    theory.locationId ? `location:${theory.locationId}` : null,
  ].filter(Boolean);
}

export function matchingAlibiCards(hand = [], theory = {}) {
  const candidates = new Set(theoryCardIds(theory));
  return [...new Set(Array.isArray(hand) ? hand : [])].filter((cardId) => candidates.has(cardId)).sort();
}

export function buildDeductionGroups({ known = [], notebook = {}, suspects = [], methods = [], locations = [] } = {}) {
  const facts = new Set(Array.isArray(known) ? known : []);
  const manualClears = new Set(Object.entries(notebook || {}).filter(([, mark]) => mark === "cleared").map(([cardId]) => cardId));
  const groups = [
    ["suspect", "Suspect", suspects],
    ["method", "Weapon", methods],
    ["location", "Room", locations],
  ];

  return groups.map(([kind, label, items]) => {
    const entries = items.map((item) => {
      const cardId = `${kind}:${item.id}`;
      const status = facts.has(cardId) ? "fact" : manualClears.has(cardId) ? "manual" : notebook?.[cardId] === "watch" ? "watch" : "open";
      return { cardId, item, status, ruledOut: status === "fact" || status === "manual" };
    });
    const remaining = entries.filter((entry) => !entry.ruledOut);
    return {
      kind,
      label,
      entries,
      remaining,
      resolvedCardId: remaining.length === 1 ? remaining[0].cardId : null,
      conflict: remaining.length === 0,
    };
  });
}
