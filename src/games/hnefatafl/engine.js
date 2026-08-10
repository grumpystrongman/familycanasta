export const HNEFATAFL_RULES = Object.freeze({ playersMin: 2, playersMax: 2, size: 11 });

const SIZE = HNEFATAFL_RULES.size;
const THRONE = 5 * SIZE + 5;
const CORNERS = new Set([0, SIZE - 1, SIZE * (SIZE - 1), SIZE * SIZE - 1]);
const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function indexOf(row, column) { return row * SIZE + column; }
function rowOf(index) { return Math.floor(index / SIZE); }
function colOf(index) { return index % SIZE; }
function inside(row, column) { return row >= 0 && row < SIZE && column >= 0 && column < SIZE; }
function sideFor(piece) { return piece === "A" ? "attackers" : piece === "D" || piece === "K" ? "defenders" : null; }
function restricted(index) { return index === THRONE || CORNERS.has(index); }

export function normalizeHnefataflBoard(board) {
  const dense = Array(SIZE * SIZE).fill(null);
  if (Array.isArray(board)) {
    for (let index = 0; index < dense.length; index += 1) dense[index] = board[index] ?? null;
    return dense;
  }
  if (board && typeof board === "object") {
    for (const [key, value] of Object.entries(board)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < dense.length) dense[index] = value ?? null;
    }
  }
  return dense;
}

function sideForUid(state, uid, members) {
  if (state?.attackerUid && uid === state.attackerUid) return "attackers";
  if (state?.defenderUid && uid === state.defenderUid) return "defenders";
  const index = members.findIndex((member) => member.uid === uid);
  return index === 0 ? "attackers" : index >= 0 ? "defenders" : null;
}

export function createHnefataflBoard() {
  const board = Array(SIZE * SIZE).fill(null);
  const attackers = [
    [0,3],[0,4],[0,5],[0,6],[0,7],[1,5],
    [10,3],[10,4],[10,5],[10,6],[10,7],[9,5],
    [3,0],[4,0],[5,0],[6,0],[7,0],[5,1],
    [3,10],[4,10],[5,10],[6,10],[7,10],[5,9],
  ];
  const defenders = [
    [5,3],[5,4],[5,6],[5,7],
    [3,5],[4,5],[6,5],[7,5],
    [4,4],[4,6],[6,4],[6,6],
  ];
  for (const [row, column] of attackers) board[indexOf(row, column)] = "A";
  for (const [row, column] of defenders) board[indexOf(row, column)] = "D";
  board[THRONE] = "K";
  return board;
}

export function legalHnefataflMoves(board, from) {
  const denseBoard = normalizeHnefataflBoard(board);
  const piece = denseBoard[from];
  if (!piece) return [];
  const moves = [];
  const row = rowOf(from);
  const column = colOf(from);
  for (const [dr, dc] of DIRECTIONS) {
    let nextRow = row + dr;
    let nextColumn = column + dc;
    while (inside(nextRow, nextColumn)) {
      const next = indexOf(nextRow, nextColumn);
      if (denseBoard[next]) break;
      if (piece !== "K" && restricted(next)) break;
      moves.push(next);
      nextRow += dr;
      nextColumn += dc;
    }
  }
  return moves;
}

function hostileAnchor(board, index, movingSide) {
  if (index < 0 || index >= board.length) return false;
  const piece = board[index];
  if (piece && sideFor(piece) === movingSide) return true;
  return restricted(index) && !piece;
}

function kingNeedsStrongCapture(index) {
  if (index === THRONE) return true;
  const row = rowOf(index);
  const column = colOf(index);
  const throneRow = rowOf(THRONE);
  const throneColumn = colOf(THRONE);
  return Math.abs(row - throneRow) + Math.abs(column - throneColumn) === 1;
}

function kingSurrounded(board, kingIndex) {
  if (kingIndex < 0) return true;
  const row = rowOf(kingIndex);
  const column = colOf(kingIndex);
  return DIRECTIONS.every(([dr, dc]) => {
    const nextRow = row + dr;
    const nextColumn = column + dc;
    if (!inside(nextRow, nextColumn)) return false;
    const next = indexOf(nextRow, nextColumn);
    return board[next] === "A" || (next === THRONE && !board[next]);
  });
}

function applyCaptures(board, to, movingSide) {
  const nextBoard = normalizeHnefataflBoard(board);
  const captures = [];
  const row = rowOf(to);
  const column = colOf(to);
  for (const [dr, dc] of DIRECTIONS) {
    const victimRow = row + dr;
    const victimColumn = column + dc;
    const anchorRow = row + dr * 2;
    const anchorColumn = column + dc * 2;
    if (!inside(victimRow, victimColumn) || !inside(anchorRow, anchorColumn)) continue;
    const victimIndex = indexOf(victimRow, victimColumn);
    const anchorIndex = indexOf(anchorRow, anchorColumn);
    const victim = nextBoard[victimIndex];
    if (!victim || sideFor(victim) === movingSide) continue;

    if (victim === "K" && movingSide === "attackers" && kingNeedsStrongCapture(victimIndex)) continue;
    if (hostileAnchor(nextBoard, anchorIndex, movingSide)) {
      nextBoard[victimIndex] = null;
      captures.push({ index: victimIndex, piece: victim });
    }
  }

  const kingIndex = nextBoard.indexOf("K");
  if (movingSide === "attackers" && kingIndex >= 0 && kingNeedsStrongCapture(kingIndex) && kingSurrounded(nextBoard, kingIndex)) {
    nextBoard[kingIndex] = null;
    captures.push({ index: kingIndex, piece: "K" });
  }
  return { board: nextBoard, captures };
}

export function createHnefataflGame(members, rules = {}) {
  if (members.length !== 2) throw new Error("Hnefatafl needs exactly two players.");
  const human = members.find((member) => !member.isRobot);
  let attackerUid = members[0].uid;
  let defenderUid = members[1].uid;
  if (human && rules.humanSide === "defenders") {
    defenderUid = human.uid;
    attackerUid = members.find((member) => member.uid !== human.uid)?.uid || attackerUid;
  } else if (human && rules.humanSide === "attackers") {
    attackerUid = human.uid;
    defenderUid = members.find((member) => member.uid !== human.uid)?.uid || defenderUid;
  }
  const attackerIndex = Math.max(0, members.findIndex((member) => member.uid === attackerUid));
  const attacker = members[attackerIndex];
  return {
    phase: "playing",
    roundNumber: 1,
    board: createHnefataflBoard(),
    attackerUid,
    defenderUid,
    currentPlayerIndex: attackerIndex,
    winnerUid: null,
    winnerSide: null,
    lastMove: null,
    message: `${attacker.nickname} commands the attackers and moves first.`,
  };
}

export function reduceHnefatafl(state, actorUid, action, members) {
  if (state.phase !== "playing") throw new Error("This game is already over.");
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  if (action?.type !== "move") throw new Error("Choose a piece and a destination.");
  const from = Number(action.from);
  const to = Number(action.to);
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new Error("Choose a valid move.");
  const board = normalizeHnefataflBoard(state.board);
  const piece = board[from];
  if (!piece) throw new Error("There is no piece there.");
  const actorSide = sideForUid(state, actorUid, members);
  if (sideFor(piece) !== actorSide) throw new Error("That piece belongs to the other side.");
  if (!legalHnefataflMoves(board, from).includes(to)) throw new Error("Pieces move like rooks through open squares.");

  const moved = [...board];
  moved[from] = null;
  moved[to] = piece;
  const captured = applyCaptures(moved, to, actorSide);
  const kingIndex = captured.board.indexOf("K");

  if (piece === "K" && CORNERS.has(to)) {
    return {
      ...state,
      phase: "game-over",
      board: captured.board,
      winnerUid: actorUid,
      winnerSide: "defenders",
      lastMove: { uid: actorUid, from, to, captures: captured.captures },
      message: `${current.nickname} escaped the king to a corner.`,
    };
  }

  if (kingIndex < 0) {
    return {
      ...state,
      phase: "game-over",
      board: captured.board,
      winnerUid: actorUid,
      winnerSide: "attackers",
      lastMove: { uid: actorUid, from, to, captures: captured.captures },
      message: `${current.nickname} captured the king.`,
    };
  }

  const nextSide = actorSide === "attackers" ? "defenders" : "attackers";
  const mappedUid = nextSide === "attackers" ? state.attackerUid : state.defenderUid;
  let nextIndex = mappedUid ? members.findIndex((member) => member.uid === mappedUid) : -1;
  if (nextIndex < 0) nextIndex = (currentIndex + 1) % members.length;
  return {
    ...state,
    board: captured.board,
    currentPlayerIndex: nextIndex,
    lastMove: { uid: actorUid, from, to, captures: captured.captures },
    message: `${members[nextIndex].nickname} to move.`,
  };
}

function moveScore(state, member, from, to, members) {
  const board = normalizeHnefataflBoard(state.board);
  const piece = board[from];
  if (piece === "K" && CORNERS.has(to)) return 100000;
  let score = 0;
  const toRow = rowOf(to);
  const toColumn = colOf(to);
  const memberSide = sideForUid(state, member.uid, members);
  if (memberSide === "defenders" && piece === "K") {
    const cornerDistance = Math.min(
      toRow + toColumn,
      toRow + (SIZE - 1 - toColumn),
      (SIZE - 1 - toRow) + toColumn,
      (SIZE - 1 - toRow) + (SIZE - 1 - toColumn),
    );
    score += 200 - cornerDistance * 10;
  }
  if (memberSide === "attackers") {
    const kingIndex = board.indexOf("K");
    const kingRow = rowOf(kingIndex);
    const kingColumn = colOf(kingIndex);
    score += 60 - (Math.abs(toRow - kingRow) + Math.abs(toColumn - kingColumn)) * 3;
  }
  try {
    const next = reduceHnefatafl({ ...state, board }, member.uid, { type: "move", from, to }, members);
    if (next.phase === "game-over" && next.winnerUid === member.uid) score += 50000;
    score += Number(next.lastMove?.captures?.length || 0) * 100;
  } catch {
    return -Infinity;
  }
  return score;
}

export function chooseHnefataflRobotMove(state, members) {
  if (state?.phase !== "playing") return null;
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current?.isRobot) return null;
  const board = normalizeHnefataflBoard(state.board);
  const side = sideForUid(state, current.uid, members);
  const candidates = [];
  for (let from = 0; from < board.length; from += 1) {
    if (sideFor(board[from]) !== side) continue;
    for (const to of legalHnefataflMoves(board, from)) {
      candidates.push({ from, to, score: moveScore({ ...state, board }, current, from, to, members) });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  const bestScore = candidates[0].score;
  const best = candidates.filter((candidate) => candidate.score === bestScore);
  const chosen = best[Math.floor(Math.random() * best.length)];
  return { uid: current.uid, action: { type: "move", from: chosen.from, to: chosen.to }, key: `${state.lastMove?.to ?? "start"}:${current.uid}:${chosen.from}-${chosen.to}` };
}

export { CORNERS, THRONE };
