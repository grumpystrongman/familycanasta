export const CHECKERS_RULES = Object.freeze({ playersMin: 2, playersMax: 2, boardSize: 8 });

function indexOf(row, column) { return row * 8 + column; }
function rowOf(index) { return Math.floor(index / 8); }
function colOf(index) { return index % 8; }
function inside(row, column) { return row >= 0 && row < 8 && column >= 0 && column < 8; }
function seatForUid(members, uid) { return members.findIndex((member) => member.uid === uid); }
function forwardForSeat(seat) { return seat === 0 ? -1 : 1; }
function crownRowForSeat(seat) { return seat === 0 ? 0 : 7; }

export function normalizeCheckersBoard(board) {
  const dense = Array(64).fill(null);
  if (Array.isArray(board)) {
    for (let index = 0; index < 64; index += 1) dense[index] = board[index] ? { ...board[index] } : null;
  } else if (board && typeof board === "object") {
    for (const [key, value] of Object.entries(board)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < 64) dense[index] = value ? { ...value } : null;
    }
  }
  return dense;
}

function initialBoard(members) {
  const board = Array(64).fill(null);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      if ((row + column) % 2 === 1) board[indexOf(row, column)] = { uid: members[1].uid, king: false };
    }
  }
  for (let row = 5; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      if ((row + column) % 2 === 1) board[indexOf(row, column)] = { uid: members[0].uid, king: false };
    }
  }
  return board;
}

function pieceDirections(piece, members) {
  const seat = seatForUid(members, piece.uid);
  if (piece.king) return [[-1,-1],[-1,1],[1,-1],[1,1]];
  const forward = forwardForSeat(seat);
  return [[forward, -1], [forward, 1]];
}

function capturesFrom(board, from, members) {
  const piece = board[from];
  if (!piece) return [];
  const row = rowOf(from);
  const column = colOf(from);
  const captures = [];
  for (const [dr, dc] of pieceDirections(piece, members)) {
    const middleRow = row + dr;
    const middleColumn = column + dc;
    const targetRow = row + dr * 2;
    const targetColumn = column + dc * 2;
    if (!inside(targetRow, targetColumn)) continue;
    const middle = board[indexOf(middleRow, middleColumn)];
    const to = indexOf(targetRow, targetColumn);
    if (middle && middle.uid !== piece.uid && !board[to]) captures.push({ from, to, capture: indexOf(middleRow, middleColumn) });
  }
  return captures;
}

function stepsFrom(board, from, members) {
  const piece = board[from];
  if (!piece) return [];
  const row = rowOf(from);
  const column = colOf(from);
  const moves = [];
  for (const [dr, dc] of pieceDirections(piece, members)) {
    const targetRow = row + dr;
    const targetColumn = column + dc;
    if (!inside(targetRow, targetColumn)) continue;
    const to = indexOf(targetRow, targetColumn);
    if (!board[to]) moves.push({ from, to, capture: null });
  }
  return moves;
}

export function legalCheckersMoves(state, actorUid, members) {
  const board = normalizeCheckersBoard(state.board);
  const forcedFrom = state.forcedFrom == null ? null : Number(state.forcedFrom);
  if (forcedFrom != null) return capturesFrom(board, forcedFrom, members);
  const captures = [];
  const steps = [];
  for (let from = 0; from < 64; from += 1) {
    if (board[from]?.uid !== actorUid) continue;
    captures.push(...capturesFrom(board, from, members));
    steps.push(...stepsFrom(board, from, members));
  }
  return captures.length ? captures : steps;
}

function nextPlayableIndex(state, members, startIndex) {
  for (let offset = 1; offset <= members.length; offset += 1) {
    const index = (startIndex + offset) % members.length;
    const uid = members[index]?.uid;
    if (!uid) continue;
    const probe = { ...state, currentPlayerIndex: index, forcedFrom: null };
    if (legalCheckersMoves(probe, uid, members).length) return index;
  }
  return -1;
}

export function createCheckersGame(members) {
  if (members.length !== 2) throw new Error("Checkers needs exactly two players.");
  return {
    phase: "playing",
    roundNumber: 1,
    board: initialBoard(members),
    currentPlayerIndex: 0,
    forcedFrom: null,
    winnerUid: null,
    lastMove: null,
    message: `${members[0].nickname} moves first.`,
  };
}

export function reduceCheckers(state, actorUid, action, members) {
  if (state.phase !== "playing") throw new Error("This checkers game is already over.");
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  if (action?.type !== "move") throw new Error("Choose a checker and a legal destination.");
  const from = Number(action.from);
  const to = Number(action.to);
  const move = legalCheckersMoves(state, actorUid, members).find((candidate) => candidate.from === from && candidate.to === to);
  if (!move) throw new Error("That checker cannot move there. Captures are mandatory when available.");

  const board = normalizeCheckersBoard(state.board);
  const piece = board[from];
  board[from] = null;
  if (move.capture != null) board[move.capture] = null;
  const seat = seatForUid(members, actorUid);
  const promoted = !piece.king && rowOf(to) === crownRowForSeat(seat);
  board[to] = { ...piece, king: piece.king || promoted };

  const opponent = members.find((member) => member.uid !== actorUid);
  const opponentPieces = board.filter((candidate) => candidate?.uid === opponent?.uid).length;
  if (!opponentPieces) {
    return { ...state, phase: "game-over", board, winnerUid: actorUid, forcedFrom: null, lastMove: { uid: actorUid, from, to, capture: move.capture }, message: `${current.nickname} captured every opposing checker.` };
  }

  if (move.capture != null && !promoted) {
    const followUps = capturesFrom(board, to, members);
    if (followUps.length) {
      return { ...state, board, forcedFrom: to, lastMove: { uid: actorUid, from, to, capture: move.capture }, message: `${current.nickname} must continue the jump.` };
    }
  }

  const probeState = { ...state, board, forcedFrom: null };
  const nextIndex = nextPlayableIndex(probeState, members, currentIndex);
  if (nextIndex < 0 || nextIndex === currentIndex) {
    return { ...state, phase: "game-over", board, winnerUid: actorUid, forcedFrom: null, lastMove: { uid: actorUid, from, to, capture: move.capture }, message: `${current.nickname} wins — the opponent has no legal move.` };
  }
  return { ...state, board, currentPlayerIndex: nextIndex, forcedFrom: null, lastMove: { uid: actorUid, from, to, capture: move.capture }, message: `${members[nextIndex].nickname}'s turn.` };
}

export function chooseCheckersRobotMove(state, members) {
  if (state?.phase !== "playing") return null;
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current?.isRobot) return null;
  const moves = legalCheckersMoves(state, current.uid, members);
  if (!moves.length) return null;
  const move = [...moves].sort((a, b) => {
    if (Boolean(a.capture) !== Boolean(b.capture)) return a.capture != null ? -1 : 1;
    const ac = Math.abs(3.5 - colOf(a.to));
    const bc = Math.abs(3.5 - colOf(b.to));
    return ac - bc || a.from - b.from || a.to - b.to;
  })[0];
  return { uid: current.uid, action: { type: "move", from: move.from, to: move.to }, key: `${state.roundNumber}:${current.uid}:${state.lastMove?.to ?? "start"}:${move.from}-${move.to}` };
}
