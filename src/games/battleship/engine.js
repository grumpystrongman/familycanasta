export const BATTLESHIP_RULES = Object.freeze({ playersMin: 2, playersMax: 2, size: 10 });
export const BATTLESHIP_FLEET = Object.freeze([
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "cruiser", name: "Cruiser", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
]);

const SIZE = BATTLESHIP_RULES.size;
function indexOf(row, column) { return row * SIZE + column; }
function rowOf(index) { return Math.floor(index / SIZE); }
function colOf(index) { return index % SIZE; }

export function cellLabel(index) {
  return `${String.fromCharCode(65 + colOf(index))}${rowOf(index) + 1}`;
}

export function placeBattleshipFleet(random = Math.random) {
  const occupied = new Set();
  const ships = [];
  for (const template of BATTLESHIP_FLEET) {
    let placed = false;
    for (let attempt = 0; attempt < 500 && !placed; attempt += 1) {
      const horizontal = random() < 0.5;
      const row = Math.floor(random() * SIZE);
      const column = Math.floor(random() * SIZE);
      const endRow = row + (horizontal ? 0 : template.size - 1);
      const endColumn = column + (horizontal ? template.size - 1 : 0);
      if (endRow >= SIZE || endColumn >= SIZE) continue;
      const cells = Array.from({ length: template.size }, (_, offset) => indexOf(row + (horizontal ? 0 : offset), column + (horizontal ? offset : 0)));
      if (cells.some((cell) => occupied.has(cell))) continue;
      cells.forEach((cell) => occupied.add(cell));
      ships.push({ ...template, cells, hits: [] });
      placed = true;
    }
    if (!placed) throw new Error("Could not place the fleet.");
  }
  return ships;
}

function shipAt(fleet, cell) {
  return fleet.find((ship) => ship.cells.includes(cell));
}

function allSunk(fleet) {
  return fleet.every((ship) => ship.hits.length >= ship.cells.length);
}

export function createBattleshipGame(members) {
  if (members.length !== 2) throw new Error("Battleship needs exactly two players.");
  return {
    phase: "playing",
    roundNumber: 1,
    currentPlayerIndex: 0,
    fleets: Object.fromEntries(members.map((member) => [member.uid, placeBattleshipFleet()])),
    shots: Object.fromEntries(members.map((member) => [member.uid, {}])),
    winnerUid: null,
    lastAction: null,
    message: `${members[0].nickname} fires first. Fleets were auto-deployed.`,
  };
}

export function reduceBattleship(state, actorUid, action, members) {
  if (state.phase !== "playing") throw new Error("This battle is already over.");
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  if (action?.type !== "fire") throw new Error("Choose a target square.");
  const cell = Number(action.cell);
  if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) throw new Error("Choose a valid target square.");
  const target = members.find((member) => member.uid !== actorUid);
  if (!target) throw new Error("No enemy fleet is available.");
  if (state.shots?.[actorUid]?.[cell] != null) throw new Error("You already fired at that square.");

  const fleets = Object.fromEntries(Object.entries(state.fleets || {}).map(([uid, fleet]) => [uid, fleet.map((ship) => ({ ...ship, cells: [...ship.cells], hits: [...ship.hits] }))]));
  const shots = Object.fromEntries(Object.entries(state.shots || {}).map(([uid, fired]) => [uid, { ...fired }]));
  const targetFleet = fleets[target.uid];
  const ship = shipAt(targetFleet, cell);
  let result = "miss";
  let sunkName = null;
  if (ship) {
    result = "hit";
    if (!ship.hits.includes(cell)) ship.hits.push(cell);
    if (ship.hits.length === ship.cells.length) sunkName = ship.name;
  }
  shots[actorUid][cell] = result;

  if (allSunk(targetFleet)) {
    return {
      ...state,
      phase: "game-over",
      fleets,
      shots,
      winnerUid: actorUid,
      lastAction: { uid: actorUid, targetUid: target.uid, cell, result, sunkName },
      message: `${current.nickname} sank the entire enemy fleet.`,
    };
  }

  const nextIndex = (currentIndex + 1) % 2;
  return {
    ...state,
    fleets,
    shots,
    currentPlayerIndex: nextIndex,
    lastAction: { uid: actorUid, targetUid: target.uid, cell, result, sunkName },
    message: sunkName
      ? `${current.nickname} sank the ${sunkName}. ${members[nextIndex].nickname} fires next.`
      : `${current.nickname}: ${result.toUpperCase()} at ${cellLabel(cell)}. ${members[nextIndex].nickname} fires next.`,
  };
}

function candidateShots(state, uid) {
  const fired = state.shots?.[uid] || {};
  const all = Array.from({ length: SIZE * SIZE }, (_, index) => index).filter((index) => fired[index] == null);
  const adjacent = [];
  for (const [key, result] of Object.entries(fired)) {
    if (result !== "hit") continue;
    const cell = Number(key);
    const row = rowOf(cell);
    const column = colOf(cell);
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nextRow = row + dr;
      const nextColumn = column + dc;
      if (nextRow < 0 || nextRow >= SIZE || nextColumn < 0 || nextColumn >= SIZE) continue;
      const next = indexOf(nextRow, nextColumn);
      if (fired[next] == null && !adjacent.includes(next)) adjacent.push(next);
    }
  }
  return adjacent.length ? adjacent : all;
}

export function chooseBattleshipRobotMove(state, members) {
  if (state?.phase !== "playing") return null;
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current?.isRobot) return null;
  const options = candidateShots(state, current.uid);
  if (!options.length) return null;
  const checkerboard = options.filter((cell) => (rowOf(cell) + colOf(cell)) % 2 === 0);
  const pool = checkerboard.length ? checkerboard : options;
  const cell = pool[Math.floor(Math.random() * pool.length)];
  return { uid: current.uid, action: { type: "fire", cell }, key: `${Object.keys(state.shots?.[current.uid] || {}).length}:${current.uid}:${cell}` };
}
