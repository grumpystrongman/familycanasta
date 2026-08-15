export const BLOOD_ALIBI_RULES = Object.freeze({ playersMin: 2, playersMax: 6 });

export const SUSPECTS = Object.freeze([
  { id: "mara-voss", name: "Mara Voss", role: "true-crime host", detail: "Built a career turning other people's worst nights into content." },
  { id: "dex-vale", name: "Dex Vale", role: "night manager", detail: "Knows every blind camera, master key, and off-book favor in the building." },
  { id: "imani-cross", name: "Dr. Imani Cross", role: "trauma surgeon", detail: "Calm under pressure, exact with a blade, and carrying a reason to hate the victim." },
  { id: "theo-rook", name: "Theo Rook", role: "political fixer", detail: "Makes scandals disappear before breakfast and people stop asking questions." },
  { id: "june-mercer", name: "June Mercer", role: "crime-scene cleaner", detail: "Professional discretion, industrial solvents, and a trunk nobody wants opened." },
  { id: "elias-flint", name: "Elias Flint", role: "tech founder", detail: "Rich enough to buy silence and reckless enough to think that makes him untouchable." },
]);

export const METHODS = Object.freeze([
  { id: "nail-gun", name: "Industrial Nail Gun", detail: "Fresh battery, wiped grip, one missing fastener strip." },
  { id: "cleaver", name: "Butcher's Cleaver", detail: "Taken from the service kitchen after midnight." },
  { id: "garrote", name: "Braided Garrote", detail: "Cut from high-tension stage cable." },
  { id: "revolver", name: "Antique Revolver", detail: "A display piece that turned out to be painfully functional." },
  { id: "poison", name: "Poisoned Nightcap", detail: "A bitter botanical hidden under expensive bourbon." },
  { id: "fire-axe", name: "Fire Axe", detail: "Missing from an emergency cabinet on the service level." },
]);

export const LOCATIONS = Object.freeze([
  { id: "atrium", name: "Glass Atrium", detail: "Rain streaks the three-story windows. Everyone started here.", links: ["security", "nightclub", "garage"] },
  { id: "security", name: "Security Office", detail: "A wall of cameras, one suspicious eleven-minute gap.", links: ["atrium", "penthouse", "laundry"] },
  { id: "nightclub", name: "Basement Nightclub", detail: "Bass still rattles empty bottles beneath a shut-down dance floor.", links: ["atrium", "kitchen", "boiler"] },
  { id: "garage", name: "Parking Garage", detail: "Concrete, oil sheen, and a sedan with blood-dark upholstery.", links: ["atrium", "laundry", "boiler"] },
  { id: "penthouse", name: "Penthouse Suite", detail: "The victim's private floor. Broken glass crunches near the minibar.", links: ["security", "greenhouse", "kitchen"] },
  { id: "laundry", name: "Laundry Tunnel", detail: "Industrial washers hammer beside bins of ruined linen.", links: ["security", "garage", "greenhouse"] },
  { id: "kitchen", name: "Service Kitchen", detail: "Cold steel counters, missing tools, and a sink that was scrubbed too hard.", links: ["nightclub", "penthouse", "boiler"] },
  { id: "boiler", name: "Boiler Room", detail: "Heat, pipe noise, and a floor drain that smells aggressively of bleach.", links: ["nightclub", "garage", "kitchen", "greenhouse"] },
  { id: "greenhouse", name: "Rooftop Greenhouse", detail: "Wet soil, shattered planters, and the city glowing far below.", links: ["penthouse", "laundry", "boiler"] },
]);

const LOCATION_MAP = Object.freeze(Object.fromEntries(LOCATIONS.map((location) => [location.id, location])));

function shuffled(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
function cardId(kind, id) { return `${kind}:${id}`; }
export function evidenceLabel(id) {
  const [kind, value] = String(id || "").split(":");
  if (kind === "suspect") return SUSPECTS.find((item) => item.id === value)?.name || value;
  if (kind === "method") return METHODS.find((item) => item.id === value)?.name || value;
  if (kind === "location") return LOCATIONS.find((item) => item.id === value)?.name || value;
  return id;
}

function activePlayerIndexes(state, members) {
  return members.map((member, index) => ({ member, index })).filter(({ member }) => !state.eliminated?.[member.uid]);
}

function nextActiveIndex(state, members, fromIndex) {
  for (let offset = 1; offset <= members.length; offset += 1) {
    const index = (fromIndex + offset) % members.length;
    const member = members[index];
    if (member && !state.eliminated?.[member.uid]) return index;
  }
  return -1;
}

function advanceTurn(state, members, currentIndex, message) {
  const nextIndex = nextActiveIndex(state, members, currentIndex);
  if (nextIndex < 0) return { ...state, phase: "game-over", winnerUid: null, message: "The case collapsed with nobody left to accuse." };
  return { ...state, currentPlayerIndex: nextIndex, turnPhase: "move", turnNumber: Number(state.turnNumber || 1) + 1, message: `${message} ${members[nextIndex].nickname}'s move.` };
}

function dealEvidence(members, solution) {
  const cards = [
    ...SUSPECTS.filter((item) => item.id !== solution.suspectId).map((item) => cardId("suspect", item.id)),
    ...METHODS.filter((item) => item.id !== solution.methodId).map((item) => cardId("method", item.id)),
    ...LOCATIONS.filter((item) => item.id !== solution.locationId).map((item) => cardId("location", item.id)),
  ];
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  shuffled(cards).forEach((card, index) => hands[members[index % members.length].uid].push(card));
  return hands;
}

export function createBloodAlibiGame(members) {
  if (members.length < 2 || members.length > 6) throw new Error("Blood & Alibi supports two to six investigators.");
  const solution = { suspectId: pick(SUSPECTS).id, methodId: pick(METHODS).id, locationId: pick(LOCATIONS).id };
  const hands = dealEvidence(members, solution);
  const positions = Object.fromEntries(members.map((member) => [member.uid, "atrium"]));
  return {
    phase: "playing",
    roundNumber: 1,
    turnNumber: 1,
    turnPhase: "move",
    currentPlayerIndex: 0,
    positions,
    hands,
    solution,
    eliminated: {},
    reveals: [],
    caseLog: [{ type: "opening", text: "A body was found before dawn. One suspect, one method, one location form the hidden truth." }],
    winnerUid: null,
    message: `${members[0].nickname} starts in the Glass Atrium. Follow the evidence, not your instincts.`,
  };
}

function validateChoice(action, key, collection, label) {
  const value = String(action?.[key] || "");
  if (!collection.some((item) => item.id === value)) throw new Error(`Choose a valid ${label}.`);
  return value;
}

export function reduceBloodAlibi(state, actorUid, action, members) {
  if (state.phase !== "playing") throw new Error("This case is already closed.");
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  if (state.eliminated?.[actorUid]) throw new Error("Your accusation was wrong; you can still hold evidence but no longer investigate.");
  const positions = { ...(state.positions || {}) };
  const caseLog = Array.isArray(state.caseLog) ? [...state.caseLog] : [];
  const reveals = Array.isArray(state.reveals) ? [...state.reveals] : [];

  if (state.turnPhase === "move") {
    if (action?.type !== "move") throw new Error("Move to a connected hotel location first.");
    const from = positions[actorUid] || "atrium";
    const to = String(action.locationId || "");
    const room = LOCATION_MAP[from];
    if (!LOCATION_MAP[to] || !room?.links?.includes(to)) throw new Error("That location is not connected to your current position.");
    positions[actorUid] = to;
    caseLog.push({ type: "move", uid: actorUid, text: `${current.nickname} moved to ${LOCATION_MAP[to].name}.` });
    return { ...state, positions, caseLog: caseLog.slice(-40), turnPhase: "investigate", message: `${current.nickname} entered ${LOCATION_MAP[to].name}. Make a theory, accuse, or end the turn.` };
  }

  if (state.turnPhase !== "investigate") throw new Error("The case is between turns.");

  if (action?.type === "suggest") {
    const suspectId = validateChoice(action, "suspectId", SUSPECTS, "suspect");
    const methodId = validateChoice(action, "methodId", METHODS, "method");
    const locationId = positions[actorUid];
    const candidates = [cardId("suspect", suspectId), cardId("method", methodId), cardId("location", locationId)];
    let refuter = null;
    let shownCard = null;
    for (let offset = 1; offset < members.length; offset += 1) {
      const candidate = members[(currentIndex + offset) % members.length];
      const matches = (state.hands?.[candidate.uid] || []).filter((card) => candidates.includes(card)).sort();
      if (matches.length) { refuter = candidate; shownCard = matches[0]; break; }
    }
    if (refuter) {
      reveals.push({ toUid: actorUid, fromUid: refuter.uid, cardId: shownCard, turn: state.turnNumber });
      caseLog.push({ type: "suggestion", uid: actorUid, text: `${current.nickname}'s theory in ${LOCATION_MAP[locationId].name} was refuted by ${refuter.nickname}.` });
      return advanceTurn({ ...state, positions, reveals: reveals.slice(-80), caseLog: caseLog.slice(-40) }, members, currentIndex, `${refuter.nickname} produced an alibi card.`);
    }
    caseLog.push({ type: "suggestion", uid: actorUid, text: `${current.nickname}'s theory in ${LOCATION_MAP[locationId].name} could not be refuted.` });
    return advanceTurn({ ...state, positions, reveals: reveals.slice(-80), caseLog: caseLog.slice(-40) }, members, currentIndex, "Nobody at the table could refute the theory.");
  }

  if (action?.type === "accuse") {
    const suspectId = validateChoice(action, "suspectId", SUSPECTS, "suspect");
    const methodId = validateChoice(action, "methodId", METHODS, "method");
    const locationId = validateChoice(action, "locationId", LOCATIONS, "location");
    const solution = state.solution || {};
    const correct = suspectId === solution.suspectId && methodId === solution.methodId && locationId === solution.locationId;
    if (correct) {
      caseLog.push({ type: "accusation", uid: actorUid, text: `${current.nickname} named the killer, method, and scene correctly.` });
      return { ...state, phase: "game-over", winnerUid: actorUid, caseLog: caseLog.slice(-40), message: `${current.nickname} solved the murder.` };
    }
    const eliminated = { ...(state.eliminated || {}), [actorUid]: true };
    caseLog.push({ type: "accusation", uid: actorUid, text: `${current.nickname} made a final accusation and got it wrong.` });
    const remaining = activePlayerIndexes({ ...state, eliminated }, members);
    if (remaining.length === 1) {
      const survivor = remaining[0].member;
      return { ...state, phase: "game-over", eliminated, winnerUid: survivor.uid, caseLog: caseLog.slice(-40), message: `${current.nickname}'s accusation failed. ${survivor.nickname} is the last investigator standing.` };
    }
    return advanceTurn({ ...state, eliminated, caseLog: caseLog.slice(-40) }, members, currentIndex, `${current.nickname} is out of the investigation after a false accusation.`);
  }

  if (action?.type === "end") {
    caseLog.push({ type: "end", uid: actorUid, text: `${current.nickname} ended the turn without naming a theory.` });
    return advanceTurn({ ...state, caseLog: caseLog.slice(-40) }, members, currentIndex, `${current.nickname} kept the theory off the record.`);
  }

  throw new Error("Make a theory, accuse, or end the turn.");
}

export function chooseBloodAlibiRobotMove(state, members) {
  if (state?.phase !== "playing") return null;
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current?.isRobot || state.eliminated?.[current.uid]) return null;
  if (state.turnPhase === "move") {
    const from = state.positions?.[current.uid] || "atrium";
    const links = LOCATION_MAP[from]?.links || [];
    const locationId = links[(Number(state.turnNumber || 1) + Number(current.seat || 0)) % Math.max(1, links.length)] || links[0];
    if (!locationId) return null;
    return { uid: current.uid, action: { type: "move", locationId }, key: `${state.turnNumber}:${current.uid}:move:${locationId}` };
  }
  const suspect = SUSPECTS[(Number(state.turnNumber || 1) + 1) % SUSPECTS.length];
  const method = METHODS[(Number(state.turnNumber || 1) + 2) % METHODS.length];
  return { uid: current.uid, action: { type: "suggest", suspectId: suspect.id, methodId: method.id }, key: `${state.turnNumber}:${current.uid}:suggest:${suspect.id}:${method.id}` };
}
