export const BLOOD_ALIBI_RULES = Object.freeze({ playersMin: 2, playersMax: 6 });
export const BOARD_SIZE = 17;

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
  { id: "greenhouse", name: "Rooftop Greenhouse", detail: "Wet soil, shattered planters, and the city glowing far below.", theme: "greenhouse", bounds: { x: 0, y: 0, w: 5, h: 5 }, doors: [{ x: 5, y: 3 }, { x: 3, y: 5 }], passageTo: "boiler" },
  { id: "penthouse", name: "Penthouse Suite", detail: "The victim's private floor. Broken glass crunches near the minibar.", theme: "penthouse", bounds: { x: 6, y: 0, w: 5, h: 5 }, doors: [{ x: 5, y: 1 }, { x: 11, y: 3 }, { x: 8, y: 5 }] },
  { id: "security", name: "Security Office", detail: "A wall of cameras, one suspicious eleven-minute gap.", theme: "security", bounds: { x: 12, y: 0, w: 5, h: 5 }, doors: [{ x: 11, y: 1 }, { x: 13, y: 5 }], passageTo: "garage" },
  { id: "laundry", name: "Laundry Tunnel", detail: "Industrial washers hammer beside bins of ruined linen.", theme: "laundry", bounds: { x: 0, y: 6, w: 5, h: 5 }, doors: [{ x: 1, y: 5 }, { x: 5, y: 8 }, { x: 3, y: 11 }] },
  { id: "atrium", name: "Glass Atrium", detail: "Rain streaks the three-story windows beneath a chandelier of fractured glass.", theme: "atrium", bounds: { x: 6, y: 6, w: 5, h: 5 }, doors: [{ x: 8, y: 5 }, { x: 11, y: 8 }, { x: 8, y: 11 }, { x: 5, y: 8 }] },
  { id: "kitchen", name: "Service Kitchen", detail: "Cold steel counters, missing tools, and a sink that was scrubbed too hard.", theme: "kitchen", bounds: { x: 12, y: 6, w: 5, h: 5 }, doors: [{ x: 15, y: 5 }, { x: 11, y: 8 }, { x: 13, y: 11 }] },
  { id: "garage", name: "Parking Garage", detail: "Concrete, oil sheen, and a sedan with blood-dark upholstery.", theme: "garage", bounds: { x: 0, y: 12, w: 5, h: 5 }, doors: [{ x: 1, y: 11 }, { x: 5, y: 13 }], passageTo: "security" },
  { id: "nightclub", name: "Basement Nightclub", detail: "Bass still rattles empty bottles beneath a shut-down dance floor.", theme: "nightclub", bounds: { x: 6, y: 12, w: 5, h: 5 }, doors: [{ x: 5, y: 15 }, { x: 8, y: 11 }, { x: 11, y: 13 }] },
  { id: "boiler", name: "Boiler Room", detail: "Heat, pipe noise, and a floor drain that smells aggressively of bleach.", theme: "boiler", bounds: { x: 12, y: 12, w: 5, h: 5 }, doors: [{ x: 15, y: 11 }, { x: 11, y: 15 }], passageTo: "greenhouse" },
]);

const LOCATION_MAP = Object.freeze(Object.fromEntries(LOCATIONS.map((location) => [location.id, location])));
const START_SPACES = Object.freeze(["hall:5,0", "hall:11,0", "hall:0,5", "hall:16,5", "hall:0,11", "hall:16,11"]);

export function hallNodeId(x, y) { return `hall:${x},${y}`; }
export function roomNodeId(locationId) { return `room:${locationId}`; }
export function boardRoomId(nodeId) { return String(nodeId || "").startsWith("room:") ? String(nodeId).slice(5) : null; }
export function isHallNode(nodeId) { return String(nodeId || "").startsWith("hall:"); }

export const CORRIDOR_SPACES = Object.freeze((() => {
  const spaces = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (x === 5 || x === 11 || y === 5 || y === 11) spaces.push(Object.freeze({ id: hallNodeId(x, y), x, y }));
    }
  }
  return spaces;
})());

const HALL_MAP = Object.freeze(Object.fromEntries(CORRIDOR_SPACES.map((space) => [space.id, space])));
const ROOM_DOOR_MAP = Object.freeze((() => {
  const map = {};
  LOCATIONS.forEach((location) => {
    location.doors.forEach(({ x, y }) => {
      const id = hallNodeId(x, y);
      if (!map[id]) map[id] = [];
      map[id].push(roomNodeId(location.id));
    });
  });
  return map;
})());

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

export function normalizeBoardPosition(value, seat = 0) {
  const raw = String(value || "");
  if (HALL_MAP[raw]) return raw;
  const roomId = boardRoomId(raw);
  if (roomId && LOCATION_MAP[roomId]) return raw;
  if (LOCATION_MAP[raw]) return roomNodeId(raw);
  return START_SPACES[Number(seat || 0) % START_SPACES.length];
}

function nodeNeighbors(nodeId) {
  const roomId = boardRoomId(nodeId);
  if (roomId) {
    const room = LOCATION_MAP[roomId];
    return room ? room.doors.map(({ x, y }) => hallNodeId(x, y)) : [];
  }
  const hall = HALL_MAP[nodeId];
  if (!hall) return [];
  const neighbors = [];
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
    const next = hallNodeId(hall.x + dx, hall.y + dy);
    if (HALL_MAP[next]) neighbors.push(next);
  });
  return [...neighbors, ...(ROOM_DOOR_MAP[nodeId] || [])];
}

function occupiedHallNodes(state, actorUid, members) {
  const occupied = new Set();
  members.forEach((member) => {
    if (member.uid === actorUid || state.eliminated?.[member.uid]) return;
    const node = normalizeBoardPosition(state.positions?.[member.uid], member.seat);
    if (isHallNode(node)) occupied.add(node);
  });
  return occupied;
}

function reachableMap(state, actorUid, members, maxDistance) {
  const actor = members.find((member) => member.uid === actorUid);
  const start = normalizeBoardPosition(state.positions?.[actorUid], actor?.seat);
  const occupied = occupiedHallNodes(state, actorUid, members);
  const distance = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    const currentDistance = distance.get(node) || 0;
    if (currentDistance >= maxDistance) continue;
    if (node !== start && boardRoomId(node)) continue;
    for (const next of nodeNeighbors(node)) {
      const nextDistance = currentDistance + 1;
      if (nextDistance > maxDistance || distance.has(next)) continue;
      if (occupied.has(next)) continue;
      distance.set(next, nextDistance);
      queue.push(next);
    }
  }
  distance.delete(start);
  return distance;
}

export function getReachableBoardNodes(state, actorUid, members) {
  if (state?.phase !== "playing" || state?.turnPhase !== "move") return [];
  const remaining = Math.max(0, Number(state.moveRemaining || 0));
  const map = reachableMap(state, actorUid, members, remaining);
  return [...map.entries()].map(([id, distance]) => ({ id, distance, roomId: boardRoomId(id) })).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
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
  return {
    ...state,
    currentPlayerIndex: nextIndex,
    turnPhase: "roll",
    moveRemaining: 0,
    lastRoll: null,
    turnNumber: Number(state.turnNumber || 1) + 1,
    message: `${message} ${members[nextIndex].nickname}'s turn.`,
  };
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
  const positions = Object.fromEntries(members.map((member, index) => [member.uid, START_SPACES[index % START_SPACES.length]]));
  const suspectPositions = Object.fromEntries(SUSPECTS.map((suspect, index) => [suspect.id, LOCATIONS[index % LOCATIONS.length].id]));
  return {
    phase: "playing",
    roundNumber: 1,
    turnNumber: 1,
    turnPhase: "roll",
    currentPlayerIndex: 0,
    positions,
    hands,
    solution,
    eliminated: {},
    reveals: [],
    suspectPositions,
    moveRemaining: 0,
    lastRoll: null,
    caseLog: [{ type: "opening", text: "A body was found before dawn. One suspect, one method, one room form the hidden truth." }],
    winnerUid: null,
    message: `${members[0].nickname} has the first move. Roll the die and enter the hotel.`,
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
  positions[actorUid] = normalizeBoardPosition(positions[actorUid], current.seat);
  const caseLog = Array.isArray(state.caseLog) ? [...state.caseLog] : [];
  const reveals = Array.isArray(state.reveals) ? [...state.reveals] : [];
  const currentRoomId = boardRoomId(positions[actorUid]);

  if (state.turnPhase === "roll") {
    if (action?.type === "passage") {
      if (!currentRoomId) throw new Error("You must be in a room with a secret passage.");
      const destination = LOCATION_MAP[currentRoomId]?.passageTo;
      if (!destination) throw new Error("There is no secret passage from this room.");
      positions[actorUid] = roomNodeId(destination);
      caseLog.push({ type: "passage", uid: actorUid, text: `${current.nickname} slipped through a secret passage into ${LOCATION_MAP[destination].name}.` });
      return { ...state, positions, caseLog: caseLog.slice(-50), turnPhase: "investigate", lastRoll: null, moveRemaining: 0, message: `${current.nickname} emerged in ${LOCATION_MAP[destination].name}. Build a theory or accuse.` };
    }
    if (action?.type === "investigateHere") {
      if (!currentRoomId) throw new Error("You must be inside a room to investigate without moving.");
      return { ...state, positions, turnPhase: "investigate", lastRoll: null, moveRemaining: 0, message: `${current.nickname} stayed in ${LOCATION_MAP[currentRoomId].name} to question the scene.` };
    }
    if (action?.type !== "roll") throw new Error("Roll the die, use a secret passage, or investigate the room you are already in.");
    const roll = 1 + Math.floor(Math.random() * 6);
    caseLog.push({ type: "roll", uid: actorUid, text: `${current.nickname} rolled ${roll}.` });
    const rolledState = { ...state, positions, caseLog: caseLog.slice(-50), turnPhase: "move", lastRoll: roll, moveRemaining: roll, message: `${current.nickname} rolled ${roll}. Move up to ${roll} spaces; entering a room ends movement.` };
    const reachable = getReachableBoardNodes(rolledState, actorUid, members);
    if (!reachable.length) return advanceTurn(rolledState, members, currentIndex, `${current.nickname} had no open path.`);
    return rolledState;
  }

  if (state.turnPhase === "move") {
    if (action?.type === "endMove") {
      caseLog.push({ type: "move", uid: actorUid, text: `${current.nickname} stopped in the corridor.` });
      return advanceTurn({ ...state, positions, caseLog: caseLog.slice(-50) }, members, currentIndex, `${current.nickname} ended movement without entering a room.`);
    }
    if (action?.type !== "move") throw new Error("Choose a highlighted board space or end movement.");
    const targetNodeId = String(action.nodeId || "");
    const reachable = getReachableBoardNodes({ ...state, positions }, actorUid, members);
    const target = reachable.find((item) => item.id === targetNodeId);
    if (!target) throw new Error("That board space is not reachable with the movement you have left.");
    positions[actorUid] = targetNodeId;
    const remaining = Math.max(0, Number(state.moveRemaining || 0) - target.distance);
    const roomId = boardRoomId(targetNodeId);
    if (roomId) {
      caseLog.push({ type: "move", uid: actorUid, text: `${current.nickname} entered ${LOCATION_MAP[roomId].name}.` });
      return { ...state, positions, caseLog: caseLog.slice(-50), turnPhase: "investigate", moveRemaining: 0, message: `${current.nickname} entered ${LOCATION_MAP[roomId].name}. Test a theory, accuse, or end the turn.` };
    }
    caseLog.push({ type: "move", uid: actorUid, text: `${current.nickname} moved ${target.distance} space${target.distance === 1 ? "" : "s"}.` });
    if (remaining <= 0) return advanceTurn({ ...state, positions, caseLog: caseLog.slice(-50), moveRemaining: 0 }, members, currentIndex, `${current.nickname} ended movement in the corridor.`);
    return { ...state, positions, caseLog: caseLog.slice(-50), moveRemaining: remaining, message: `${current.nickname} has ${remaining} move${remaining === 1 ? "" : "s"} left.` };
  }

  if (state.turnPhase !== "investigate") throw new Error("The case is between turns.");
  const investigationRoomId = boardRoomId(positions[actorUid]);

  if (action?.type === "suggest") {
    if (!investigationRoomId) throw new Error("Enter a room before testing a theory.");
    const suspectId = validateChoice(action, "suspectId", SUSPECTS, "suspect");
    const methodId = validateChoice(action, "methodId", METHODS, "method");
    const candidates = [cardId("suspect", suspectId), cardId("method", methodId), cardId("location", investigationRoomId)];
    const suspectPositions = { ...(state.suspectPositions || {}), [suspectId]: investigationRoomId };
    let refuter = null;
    let shownCard = null;
    for (let offset = 1; offset < members.length; offset += 1) {
      const candidate = members[(currentIndex + offset) % members.length];
      const matches = (state.hands?.[candidate.uid] || []).filter((card) => candidates.includes(card)).sort();
      if (matches.length) { refuter = candidate; shownCard = matches[0]; break; }
    }
    if (refuter) {
      reveals.push({ toUid: actorUid, fromUid: refuter.uid, cardId: shownCard, turn: state.turnNumber });
      caseLog.push({ type: "suggestion", uid: actorUid, text: `${current.nickname} placed ${SUSPECTS.find((item) => item.id === suspectId)?.name} in ${LOCATION_MAP[investigationRoomId].name} with ${METHODS.find((item) => item.id === methodId)?.name}; ${refuter.nickname} refuted it.` });
      return advanceTurn({ ...state, positions, suspectPositions, reveals: reveals.slice(-80), caseLog: caseLog.slice(-50) }, members, currentIndex, `${refuter.nickname} produced an alibi card.`);
    }
    caseLog.push({ type: "suggestion", uid: actorUid, text: `${current.nickname}'s theory in ${LOCATION_MAP[investigationRoomId].name} could not be refuted.` });
    return advanceTurn({ ...state, positions, suspectPositions, reveals: reveals.slice(-80), caseLog: caseLog.slice(-50) }, members, currentIndex, "Nobody at the table could refute the theory.");
  }

  if (action?.type === "accuse") {
    const suspectId = validateChoice(action, "suspectId", SUSPECTS, "suspect");
    const methodId = validateChoice(action, "methodId", METHODS, "method");
    const locationId = validateChoice(action, "locationId", LOCATIONS, "location");
    const solution = state.solution || {};
    const correct = suspectId === solution.suspectId && methodId === solution.methodId && locationId === solution.locationId;
    if (correct) {
      caseLog.push({ type: "accusation", uid: actorUid, text: `${current.nickname} named the killer, method, and scene correctly.` });
      return { ...state, positions, phase: "game-over", winnerUid: actorUid, caseLog: caseLog.slice(-50), message: `${current.nickname} solved the murder.` };
    }
    const eliminated = { ...(state.eliminated || {}), [actorUid]: true };
    caseLog.push({ type: "accusation", uid: actorUid, text: `${current.nickname} made a final accusation and got it wrong.` });
    const remaining = activePlayerIndexes({ ...state, eliminated }, members);
    if (remaining.length === 1) {
      const survivor = remaining[0].member;
      return { ...state, positions, phase: "game-over", eliminated, winnerUid: survivor.uid, caseLog: caseLog.slice(-50), message: `${current.nickname}'s accusation failed. ${survivor.nickname} is the last investigator standing.` };
    }
    return advanceTurn({ ...state, positions, eliminated, caseLog: caseLog.slice(-50) }, members, currentIndex, `${current.nickname} is out of the investigation after a false accusation.`);
  }

  if (action?.type === "end") {
    caseLog.push({ type: "end", uid: actorUid, text: `${current.nickname} ended the turn without naming a theory.` });
    return advanceTurn({ ...state, positions, caseLog: caseLog.slice(-50) }, members, currentIndex, `${current.nickname} kept the theory off the record.`);
  }

  throw new Error("Make a theory, accuse, or end the turn.");
}

export function chooseBloodAlibiRobotMove(state, members) {
  if (state?.phase !== "playing") return null;
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current?.isRobot || state.eliminated?.[current.uid]) return null;
  const node = normalizeBoardPosition(state.positions?.[current.uid], current.seat);
  const roomId = boardRoomId(node);
  if (state.turnPhase === "roll") {
    if (roomId && LOCATION_MAP[roomId]?.passageTo && Number(state.turnNumber || 0) % 5 === 0) {
      return { uid: current.uid, action: { type: "passage" }, key: `${state.turnNumber}:${current.uid}:passage:${roomId}` };
    }
    return { uid: current.uid, action: { type: "roll" }, key: `${state.turnNumber}:${current.uid}:roll` };
  }
  if (state.turnPhase === "move") {
    const reachable = getReachableBoardNodes(state, current.uid, members);
    const rooms = reachable.filter((item) => item.roomId);
    const choices = rooms.length ? rooms : reachable;
    if (!choices.length) return { uid: current.uid, action: { type: "endMove" }, key: `${state.turnNumber}:${current.uid}:endMove` };
    const target = [...choices].sort((a, b) => b.distance - a.distance || a.id.localeCompare(b.id))[(Number(state.turnNumber || 1) + Number(current.seat || 0)) % choices.length];
    return { uid: current.uid, action: { type: "move", nodeId: target.id }, key: `${state.turnNumber}:${current.uid}:move:${state.moveRemaining}:${target.id}` };
  }
  if (state.turnPhase === "investigate") {
    if (!roomId) return { uid: current.uid, action: { type: "end" }, key: `${state.turnNumber}:${current.uid}:end` };
    const suspect = SUSPECTS[(Number(state.turnNumber || 1) + 1) % SUSPECTS.length];
    const method = METHODS[(Number(state.turnNumber || 1) + 2) % METHODS.length];
    return { uid: current.uid, action: { type: "suggest", suspectId: suspect.id, methodId: method.id }, key: `${state.turnNumber}:${current.uid}:suggest:${suspect.id}:${method.id}:${roomId}` };
  }
  return null;
}
