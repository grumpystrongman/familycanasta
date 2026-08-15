export const CHESS_RULES = Object.freeze({ playersMin: 2, playersMax: 2, boardSize: 8 });

const FILES = "abcdefgh";
const BACK_RANK = ["r", "n", "b", "q", "k", "b", "n", "r"];
const PIECE_VALUES = Object.freeze({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 });

function indexOf(row, column) { return row * 8 + column; }
function rowOf(index) { return Math.floor(index / 8); }
function colOf(index) { return index % 8; }
function inside(row, column) { return row >= 0 && row < 8 && column >= 0 && column < 8; }
function enemy(color) { return color === "white" ? "black" : "white"; }
export function chessSideForSeat(seat) { return Number(seat) === 0 ? "white" : "black"; }
export function chessSquareName(index) { return `${FILES[colOf(index)]}${8 - rowOf(index)}`; }
export function normalizeChessBoard(board) {
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

function makePiece(type, color) { return { type, color, moved: false }; }
function initialBoard() {
  const board = Array(64).fill(null);
  for (let column = 0; column < 8; column += 1) {
    board[indexOf(0, column)] = makePiece(BACK_RANK[column], "black");
    board[indexOf(1, column)] = makePiece("p", "black");
    board[indexOf(6, column)] = makePiece("p", "white");
    board[indexOf(7, column)] = makePiece(BACK_RANK[column], "white");
  }
  return board;
}

function findKing(board, color) {
  return board.findIndex((piece) => piece?.type === "k" && piece.color === color);
}

function squareAttacked(board, square, byColor) {
  const targetRow = rowOf(square);
  const targetColumn = colOf(square);
  const pawnDirection = byColor === "white" ? -1 : 1;
  for (const deltaColumn of [-1, 1]) {
    const row = targetRow - pawnDirection;
    const column = targetColumn - deltaColumn;
    if (!inside(row, column)) continue;
    const piece = board[indexOf(row, column)];
    if (piece?.color === byColor && piece.type === "p") return true;
  }

  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const row = targetRow + dr;
    const column = targetColumn + dc;
    if (!inside(row, column)) continue;
    const piece = board[indexOf(row, column)];
    if (piece?.color === byColor && piece.type === "n") return true;
  }

  for (const [dr, dc, types] of [[-1,0,"rq"],[1,0,"rq"],[0,-1,"rq"],[0,1,"rq"],[-1,-1,"bq"],[-1,1,"bq"],[1,-1,"bq"],[1,1,"bq"]]) {
    let row = targetRow + dr;
    let column = targetColumn + dc;
    while (inside(row, column)) {
      const piece = board[indexOf(row, column)];
      if (piece) {
        if (piece.color === byColor && types.includes(piece.type)) return true;
        break;
      }
      row += dr;
      column += dc;
    }
  }

  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue;
      const row = targetRow + dr;
      const column = targetColumn + dc;
      if (!inside(row, column)) continue;
      const piece = board[indexOf(row, column)];
      if (piece?.color === byColor && piece.type === "k") return true;
    }
  }
  return false;
}

export function chessInCheck(boardInput, color) {
  const board = normalizeChessBoard(boardInput);
  const king = findKing(board, color);
  return king >= 0 && squareAttacked(board, king, enemy(color));
}

function pushRayMoves(board, moves, from, color, directions) {
  const startRow = rowOf(from);
  const startColumn = colOf(from);
  for (const [dr, dc] of directions) {
    let row = startRow + dr;
    let column = startColumn + dc;
    while (inside(row, column)) {
      const to = indexOf(row, column);
      const target = board[to];
      if (!target) moves.push({ from, to });
      else {
        if (target.color !== color && target.type !== "k") moves.push({ from, to, capture: target });
        break;
      }
      row += dr;
      column += dc;
    }
  }
}

function pseudoMovesForPiece(board, from, state, includeCastle = true) {
  const piece = board[from];
  if (!piece) return [];
  const moves = [];
  const row = rowOf(from);
  const column = colOf(from);

  if (piece.type === "p") {
    const direction = piece.color === "white" ? -1 : 1;
    const startRow = piece.color === "white" ? 6 : 1;
    const promotionRow = piece.color === "white" ? 0 : 7;
    const oneRow = row + direction;
    if (inside(oneRow, column) && !board[indexOf(oneRow, column)]) {
      const to = indexOf(oneRow, column);
      moves.push({ from, to, promotion: oneRow === promotionRow });
      const twoRow = row + direction * 2;
      if (row === startRow && !piece.moved && !board[indexOf(twoRow, column)]) moves.push({ from, to: indexOf(twoRow, column), pawnDouble: true });
    }
    for (const dc of [-1, 1]) {
      const captureRow = row + direction;
      const captureColumn = column + dc;
      if (!inside(captureRow, captureColumn)) continue;
      const to = indexOf(captureRow, captureColumn);
      const target = board[to];
      if (target && target.color !== piece.color && target.type !== "k") moves.push({ from, to, capture: target, promotion: captureRow === promotionRow });
      if (!target && state?.enPassant != null && Number(state.enPassant) === to) {
        const captureIndex = indexOf(row, captureColumn);
        const captured = board[captureIndex];
        if (captured?.type === "p" && captured.color !== piece.color) moves.push({ from, to, enPassantCapture: captureIndex, capture: captured });
      }
    }
  } else if (piece.type === "n") {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nextRow = row + dr;
      const nextColumn = column + dc;
      if (!inside(nextRow, nextColumn)) continue;
      const to = indexOf(nextRow, nextColumn);
      const target = board[to];
      if (!target || (target.color !== piece.color && target.type !== "k")) moves.push({ from, to, capture: target || null });
    }
  } else if (piece.type === "b") {
    pushRayMoves(board, moves, from, piece.color, [[-1,-1],[-1,1],[1,-1],[1,1]]);
  } else if (piece.type === "r") {
    pushRayMoves(board, moves, from, piece.color, [[-1,0],[1,0],[0,-1],[0,1]]);
  } else if (piece.type === "q") {
    pushRayMoves(board, moves, from, piece.color, [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]);
  } else if (piece.type === "k") {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const nextRow = row + dr;
        const nextColumn = column + dc;
        if (!inside(nextRow, nextColumn)) continue;
        const to = indexOf(nextRow, nextColumn);
        const target = board[to];
        if (!target || (target.color !== piece.color && target.type !== "k")) moves.push({ from, to, capture: target || null });
      }
    }
    if (includeCastle && !piece.moved && !squareAttacked(board, from, enemy(piece.color))) {
      for (const side of ["king", "queen"]) {
        const rookColumn = side === "king" ? 7 : 0;
        const rookIndex = indexOf(row, rookColumn);
        const rook = board[rookIndex];
        if (rook?.type !== "r" || rook.color !== piece.color || rook.moved) continue;
        const betweenColumns = side === "king" ? [5, 6] : [1, 2, 3];
        if (betweenColumns.some((candidate) => board[indexOf(row, candidate)])) continue;
        const throughColumns = side === "king" ? [5, 6] : [3, 2];
        if (throughColumns.some((candidate) => squareAttacked(board, indexOf(row, candidate), enemy(piece.color)))) continue;
        moves.push({ from, to: indexOf(row, side === "king" ? 6 : 2), castle: side, rookFrom: rookIndex, rookTo: indexOf(row, side === "king" ? 5 : 3) });
      }
    }
  }
  return moves;
}

function applyMoveToBoard(boardInput, move, promotion = "q") {
  const board = normalizeChessBoard(boardInput);
  const piece = board[move.from];
  board[move.from] = null;
  if (move.enPassantCapture != null) board[move.enPassantCapture] = null;
  if (move.castle) {
    const rook = board[move.rookFrom];
    board[move.rookFrom] = null;
    board[move.rookTo] = rook ? { ...rook, moved: true } : null;
  }
  const nextType = move.promotion && ["q", "r", "b", "n"].includes(promotion) ? promotion : piece.type;
  board[move.to] = { ...piece, type: nextType, moved: true };
  return board;
}

export function legalChessMoves(state, color, fromFilter = null) {
  const board = normalizeChessBoard(state.board);
  const legal = [];
  for (let from = 0; from < 64; from += 1) {
    const piece = board[from];
    if (!piece || piece.color !== color || (fromFilter != null && from !== Number(fromFilter))) continue;
    for (const move of pseudoMovesForPiece(board, from, state, true)) {
      const nextBoard = applyMoveToBoard(board, move, "q");
      if (!chessInCheck(nextBoard, color)) legal.push(move);
    }
  }
  return legal;
}

function currentColor(state) { return Number(state.currentPlayerIndex || 0) === 0 ? "white" : "black"; }

export function createChessGame(members) {
  if (members.length !== 2) throw new Error("Chess needs exactly two players.");
  return {
    phase: "playing",
    roundNumber: 1,
    board: initialBoard(),
    currentPlayerIndex: 0,
    winnerUid: null,
    result: null,
    enPassant: null,
    lastMove: null,
    moveNumber: 1,
    message: `${members[0].nickname} plays White and moves first.`,
  };
}

export function reduceChess(state, actorUid, action, members) {
  if (state.phase !== "playing") throw new Error("This chess game is already over.");
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  if (action?.type !== "move") throw new Error("Choose a chess piece and a legal destination.");
  const from = Number(action.from);
  const to = Number(action.to);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 64 || to < 0 || to >= 64) throw new Error("Choose a valid square.");
  const color = currentColor(state);
  const move = legalChessMoves(state, color, from).find((candidate) => candidate.to === to);
  if (!move) throw new Error("That piece cannot move there.");

  const promotion = ["q", "r", "b", "n"].includes(action.promotion) ? action.promotion : "q";
  const board = applyMoveToBoard(state.board, move, promotion);
  const movedPiece = state.board?.[from];
  const fromRow = rowOf(from);
  const toRow = rowOf(to);
  const enPassant = movedPiece?.type === "p" && Math.abs(toRow - fromRow) === 2 ? indexOf((fromRow + toRow) / 2, colOf(from)) : null;
  const nextIndex = (currentIndex + 1) % 2;
  const nextColor = nextIndex === 0 ? "white" : "black";
  const nextState = { ...state, board, currentPlayerIndex: nextIndex, enPassant, lastMove: { uid: actorUid, from, to, capture: Boolean(move.capture), promotion: move.promotion ? promotion : null }, moveNumber: Number(state.moveNumber || 1) + (color === "black" ? 1 : 0) };
  const opponentMoves = legalChessMoves(nextState, nextColor);
  const opponentInCheck = chessInCheck(board, nextColor);

  if (!opponentMoves.length) {
    if (opponentInCheck) return { ...nextState, phase: "game-over", winnerUid: actorUid, result: "checkmate", message: `${current.nickname} wins by checkmate.` };
    return { ...nextState, phase: "game-over", winnerUid: null, result: "stalemate", message: "Stalemate — the game is a draw." };
  }
  return { ...nextState, message: `${members[nextIndex].nickname}'s turn${opponentInCheck ? " — check." : "."}` };
}

export function chooseChessRobotMove(state, members) {
  if (state?.phase !== "playing") return null;
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current?.isRobot) return null;
  const color = currentIndex === 0 ? "white" : "black";
  const moves = legalChessMoves(state, color);
  if (!moves.length) return null;
  const board = normalizeChessBoard(state.board);
  const scored = moves.map((move) => {
    const captured = move.enPassantCapture != null ? board[move.enPassantCapture] : board[move.to];
    const center = 3.5 - (Math.abs(3.5 - rowOf(move.to)) + Math.abs(3.5 - colOf(move.to))) / 2;
    const score = (captured ? (PIECE_VALUES[captured.type] || 0) * 20 : 0) + (move.promotion ? 25 : 0) + center;
    return { move, score };
  }).sort((a, b) => b.score - a.score || a.move.from - b.move.from || a.move.to - b.move.to);
  const move = scored[0].move;
  return { uid: current.uid, action: { type: "move", from: move.from, to: move.to, promotion: "q" }, key: `${state.moveNumber}:${current.uid}:${move.from}-${move.to}` };
}

export function chessPieceGlyph(piece) {
  if (!piece) return "";
  const glyphs = {
    white: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    black: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  };
  return glyphs[piece.color]?.[piece.type] || "";
}
