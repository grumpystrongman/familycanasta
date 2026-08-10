export const CONNECT4_RULES = Object.freeze({ playersMin: 2, playersMax: 2, rows: 6, columns: 7 });

function cellIndex(row, column) {
  return row * CONNECT4_RULES.columns + column;
}

function winningLine(board, uid) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let row = 0; row < CONNECT4_RULES.rows; row += 1) {
    for (let column = 0; column < CONNECT4_RULES.columns; column += 1) {
      if (board[cellIndex(row, column)] !== uid) continue;
      for (const [dr, dc] of directions) {
        const cells = [];
        for (let step = 0; step < 4; step += 1) {
          const nextRow = row + dr * step;
          const nextColumn = column + dc * step;
          if (nextRow < 0 || nextRow >= CONNECT4_RULES.rows || nextColumn < 0 || nextColumn >= CONNECT4_RULES.columns) break;
          const index = cellIndex(nextRow, nextColumn);
          if (board[index] !== uid) break;
          cells.push(index);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return [];
}

export function availableConnect4Columns(board) {
  return Array.from({ length: CONNECT4_RULES.columns }, (_, column) => column)
    .filter((column) => board[cellIndex(0, column)] == null);
}

function dropIntoBoard(board, column, uid) {
  for (let row = CONNECT4_RULES.rows - 1; row >= 0; row -= 1) {
    const index = cellIndex(row, column);
    if (board[index] == null) {
      const next = [...board];
      next[index] = uid;
      return { board: next, index };
    }
  }
  throw new Error("That column is full.");
}

export function createConnect4Game(members) {
  if (members.length !== 2) throw new Error("Connect 4 needs exactly two players.");
  return {
    phase: "playing",
    roundNumber: 1,
    board: Array(CONNECT4_RULES.rows * CONNECT4_RULES.columns).fill(null),
    currentPlayerIndex: 0,
    winnerUid: null,
    winningCells: [],
    lastMove: null,
    message: `${members[0].nickname} drops first.`,
  };
}

export function reduceConnect4(state, actorUid, action, members) {
  if (state.phase !== "playing") throw new Error("This game is already over.");
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  if (action?.type !== "drop") throw new Error("Choose a column to drop your checker.");
  const column = Number(action.column);
  if (!Number.isInteger(column) || column < 0 || column >= CONNECT4_RULES.columns) throw new Error("Choose a valid column.");

  const dropped = dropIntoBoard(state.board || [], column, actorUid);
  const line = winningLine(dropped.board, actorUid);
  if (line.length) {
    return {
      ...state,
      phase: "game-over",
      board: dropped.board,
      winnerUid: actorUid,
      winningCells: line,
      lastMove: { uid: actorUid, column, index: dropped.index },
      message: `${current.nickname} connected four.`,
    };
  }

  if (!availableConnect4Columns(dropped.board).length) {
    return {
      ...state,
      phase: "game-over",
      board: dropped.board,
      winnerUid: null,
      winningCells: [],
      lastMove: { uid: actorUid, column, index: dropped.index },
      message: "The board is full — draw game.",
    };
  }

  const nextIndex = (Number(state.currentPlayerIndex || 0) + 1) % members.length;
  return {
    ...state,
    board: dropped.board,
    currentPlayerIndex: nextIndex,
    lastMove: { uid: actorUid, column, index: dropped.index },
    message: `${members[nextIndex].nickname}'s turn.`,
  };
}

function wouldWin(board, column, uid) {
  try {
    const dropped = dropIntoBoard(board, column, uid);
    return winningLine(dropped.board, uid).length > 0;
  } catch {
    return false;
  }
}

export function chooseConnect4RobotMove(state, members) {
  if (state?.phase !== "playing") return null;
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current?.isRobot) return null;
  const options = availableConnect4Columns(state.board || []);
  if (!options.length) return null;
  const opponent = members.find((member) => member.uid !== current.uid);
  const winning = options.find((column) => wouldWin(state.board, column, current.uid));
  if (winning != null) return { uid: current.uid, action: { type: "drop", column: winning } };
  const block = opponent ? options.find((column) => wouldWin(state.board, column, opponent.uid)) : null;
  const priorities = [3, 2, 4, 1, 5, 0, 6];
  const column = block ?? priorities.find((candidate) => options.includes(candidate)) ?? options[0];
  return { uid: current.uid, action: { type: "drop", column }, key: `${state.board.filter(Boolean).length}:${current.uid}:${column}` };
}
