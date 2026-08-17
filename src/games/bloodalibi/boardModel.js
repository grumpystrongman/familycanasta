export const BLOOD_ALIBI_RULES = Object.freeze({ playersMin: 2, playersMax: 6 });
export const BOARD_SIZE = 25;

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

// The rooms deliberately do not share a grid rhythm. Their different sizes and offsets create
// broad hall loops, little choke points, side approaches and meaningful dice movement.
export const LOCATIONS = Object.freeze([
  { id: "greenhouse", name: "Rooftop Greenhouse", detail: "Wet soil, shattered planters, and the city glowing far below.", theme: "greenhouse", bounds: { x: 0, y: 0, w: 7, h: 6 }, doors: [{ x: 7, y: 2 }, { x: 4, y: 6 }], passageTo: "boiler" },
  { id: "penthouse", name: "Penthouse Suite", detail: "The victim's private floor. Broken glass crunches near the minibar.", theme: "penthouse", bounds: { x: 9, y: 0, w: 7, h: 7 }, doors: [{ x: 8, y: 3 }, { x: 16, y: 5 }, { x: 12, y: 7 }] },
  { id: "security", name: "Security Office", detail: "A wall of cameras, one suspicious eleven-minute gap.", theme: "security", bounds: { x: 18, y: 0, w: 7, h: 5 }, doors: [{ x: 17, y: 2 }, { x: 21, y: 5 }], passageTo: "garage" },
  { id: "laundry", name: "Laundry Tunnel", detail: "Industrial washers hammer beside bins of ruined linen.", theme: "laundry", bounds: { x: 0, y: 8, w: 6, h: 6 }, doors: [{ x: 6, y: 10 }, { x: 3, y: 7 }, { x: 4, y: 14 }] },
  { id: "atrium", name: "Glass Atrium", detail: "Rain streaks the three-story windows beneath a chandelier of fractured glass.", theme: "atrium", bounds: { x: 8, y: 9, w: 9, h: 7 }, doors: [{ x: 7, y: 12 }, { x: 17, y: 11 }, { x: 12, y: 8 }, { x: 13, y: 16 }] },
  { id: "kitchen", name: "Service Kitchen", detail: "Cold steel counters, missing tools, and a sink that was scrubbed too hard.", theme: "kitchen", bounds: { x: 19, y: 7, w: 6, h: 7 }, doors: [{ x: 18, y: 10 }, { x: 22, y: 6 }, { x: 20, y: 14 }] },
  { id: "garage", name: "Parking Garage", detail: "Concrete, oil sheen, and a sedan with blood-dark upholstery.", theme: "garage", bounds: { x: 0, y: 17, w: 7, h: 8 }, doors: [{ x: 7, y: 19 }, { x: 4, y: 16 }], passageTo: "security" },
  { id: "nightclub", name: "Basement Nightclub", detail: "Bass still rattles empty bottles beneath a shut-down dance floor.", theme: "nightclub", bounds: { x: 9, y: 18, w: 8, h: 7 }, doors: [{ x: 8, y: 21 }, { x: 13, y: 17 }, { x: 17, y: 20 }] },
  { id: "boiler", name: "Boiler Room", detail: "Heat, pipe noise, and a floor drain that smells aggressively of bleach.", theme: "boiler", bounds: { x: 19, y: 17, w: 6, h: 8 }, doors: [{ x: 18, y: 20 }, { x: 21, y: 16 }], passageTo: "greenhouse" },
]);

export const LOCATION_MAP = Object.freeze(Object.fromEntries(LOCATIONS.map((item) => [item.id, item])));
export const START_SPACES = Object.freeze(["hall:8,0", "hall:16,0", "hall:0,7", "hall:24,6", "hall:0,16", "hall:24,15"]);

export function hallNodeId(x, y) { return `hall:${x},${y}`; }
export function roomNodeId(locationId) { return `room:${locationId}`; }
export function boardRoomId(nodeId) { return String(nodeId || "").startsWith("room:") ? String(nodeId).slice(5) : null; }
export function isHallNode(nodeId) { return String(nodeId || "").startsWith("hall:"); }
function insideRoom(x, y, room) { const b = room.bounds; return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h; }

export const CORRIDOR_SPACES = Object.freeze((() => {
  const spaces = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) for (let x = 0; x < BOARD_SIZE; x += 1) {
    if (!LOCATIONS.some((room) => insideRoom(x, y, room))) spaces.push(Object.freeze({ id: hallNodeId(x, y), x, y }));
  }
  return spaces;
})());

const HALL_MAP = Object.freeze(Object.fromEntries(CORRIDOR_SPACES.map((space) => [space.id, space])));
const ROOM_DOOR_MAP = Object.freeze((() => {
  const map = {};
  LOCATIONS.forEach((room) => room.doors.forEach(({ x, y }) => {
    const id = hallNodeId(x, y);
    if (!HALL_MAP[id]) throw new Error(`Door ${id} for ${room.name} is not on a corridor tile.`);
    (map[id] ||= []).push(roomNodeId(room.id));
  }));
  return map;
})());

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

function neighbors(nodeId) {
  const roomId = boardRoomId(nodeId);
  if (roomId) return LOCATION_MAP[roomId]?.doors.map(({ x, y }) => hallNodeId(x, y)) || [];
  const hall = HALL_MAP[nodeId];
  if (!hall) return [];
  const next = [];
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const id = hallNodeId(hall.x + dx, hall.y + dy); if (HALL_MAP[id]) next.push(id); }
  return [...next, ...(ROOM_DOOR_MAP[nodeId] || [])];
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

export function getReachableBoardNodes(state, actorUid, members) {
  if (state?.phase !== "playing" || state?.turnPhase !== "move") return [];
  const actor = members.find((member) => member.uid === actorUid);
  const start = normalizeBoardPosition(state.positions?.[actorUid], actor?.seat);
  const max = Math.max(0, Number(state.moveRemaining || 0));
  const blocked = occupiedHallNodes(state, actorUid, members);
  const distance = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    const d = distance.get(node) || 0;
    if (d >= max || (node !== start && boardRoomId(node))) continue;
    for (const next of neighbors(node)) {
      const nd = d + 1;
      if (nd > max || distance.has(next) || blocked.has(next)) continue;
      distance.set(next, nd); queue.push(next);
    }
  }
  distance.delete(start);
  return [...distance.entries()].map(([id, distance]) => ({ id, distance, roomId: boardRoomId(id) })).sort((a,b) => a.distance - b.distance || a.id.localeCompare(b.id));
}
