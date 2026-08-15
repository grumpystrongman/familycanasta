export const WORD_FOUNDRY_RULES = Object.freeze({ playersMin: 2, playersMax: 4, boardSize: 15, rackSize: 7 });

const DISTRIBUTION = Object.freeze({
  A:8, B:2, C:2, D:4, E:10, F:2, G:3, H:3, I:8, J:1, K:1, L:4, M:2,
  N:6, O:7, P:2, Q:1, R:6, S:5, T:6, U:4, V:2, W:2, X:1, Y:2, Z:1, "?":2,
});
export const LETTER_VALUES = Object.freeze({ A:1,B:4,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:7,K:5,L:2,M:3,N:1,O:1,P:3,Q:9,R:1,S:1,T:1,U:2,V:5,W:4,X:8,Y:4,Z:10,"?":0 });

function indexOf(row, column) { return row * 15 + column; }
function rowOf(index) { return Math.floor(index / 15); }
function colOf(index) { return index % 15; }
function inside(row, column) { return row >= 0 && row < 15 && column >= 0 && column < 15; }
function adjacent(index) {
  const row = rowOf(index);
  const column = colOf(index);
  return [[row-1,column],[row+1,column],[row,column-1],[row,column+1]].filter(([r,c]) => inside(r,c)).map(([r,c]) => indexOf(r,c));
}

const PREMIUM = (() => {
  const map = new Map();
  const add = (kind, coords) => coords.forEach(([r,c]) => map.set(indexOf(r,c), kind));
  add("3W", [[0,4],[0,10],[4,0],[4,14],[10,0],[10,14],[14,4],[14,10]]);
  add("2W", [[1,1],[1,13],[3,3],[3,11],[5,5],[5,9],[7,7],[9,5],[9,9],[11,3],[11,11],[13,1],[13,13]]);
  add("3L", [[1,7],[2,2],[2,12],[4,6],[4,8],[6,4],[6,10],[7,1],[7,13],[8,4],[8,10],[10,6],[10,8],[12,2],[12,12],[13,7]]);
  add("2L", [[0,7],[2,5],[2,9],[5,2],[5,7],[5,12],[7,0],[7,5],[7,9],[7,14],[9,2],[9,7],[9,12],[12,5],[12,9],[14,7]]);
  return map;
})();

export function wordFoundryBonusAt(index) { return PREMIUM.get(Number(index)) || null; }

export function normalizeWordBoard(board) {
  const dense = Array(225).fill(null);
  if (Array.isArray(board)) {
    for (let index = 0; index < 225; index += 1) dense[index] = board[index] ? { ...board[index], tile: { ...board[index].tile } } : null;
  } else if (board && typeof board === "object") {
    for (const [key, value] of Object.entries(board)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < 225) dense[index] = value ? { ...value, tile: { ...value.tile } } : null;
    }
  }
  return dense;
}

function shuffled(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function makeBag() {
  const tiles = [];
  let serial = 1;
  for (const [letter, count] of Object.entries(DISTRIBUTION)) {
    for (let index = 0; index < count; index += 1) {
      tiles.push({ id: `wf-${serial++}`, letter, value: LETTER_VALUES[letter] || 0 });
    }
  }
  return shuffled(tiles);
}

function drawTiles(bag, count) {
  const nextBag = [...bag];
  const drawn = nextBag.splice(0, Math.max(0, count));
  return { bag: nextBag, drawn };
}

function normalizeRacks(racks, members) {
  const result = {};
  for (const member of members) result[member.uid] = Array.isArray(racks?.[member.uid]) ? racks[member.uid].map((tile) => ({ ...tile })) : [];
  return result;
}

function collectWord(board, index, dr, dc) {
  let row = rowOf(index);
  let column = colOf(index);
  while (inside(row - dr, column - dc) && board[indexOf(row - dr, column - dc)]) { row -= dr; column -= dc; }
  const cells = [];
  while (inside(row, column) && board[indexOf(row, column)]) {
    const boardIndex = indexOf(row, column);
    cells.push(boardIndex);
    row += dr;
    column += dc;
  }
  return cells;
}

function wordText(board, cells) { return cells.map((index) => board[index]?.tile?.letter || "?").join(""); }

function scoreWord(board, cells, newIndexes) {
  let subtotal = 0;
  let wordMultiplier = 1;
  for (const index of cells) {
    const tile = board[index]?.tile;
    if (!tile) continue;
    let letterScore = Number(tile.value || 0);
    if (newIndexes.has(index)) {
      const bonus = wordFoundryBonusAt(index);
      if (bonus === "2L") letterScore *= 2;
      if (bonus === "3L") letterScore *= 3;
      if (bonus === "2W") wordMultiplier *= 2;
      if (bonus === "3W") wordMultiplier *= 3;
    }
    subtotal += letterScore;
  }
  return subtotal * wordMultiplier;
}

function analyzePlacement(boardBefore, boardAfter, placementIndexes) {
  const rows = new Set(placementIndexes.map(rowOf));
  const columns = new Set(placementIndexes.map(colOf));
  if (rows.size > 1 && columns.size > 1) throw new Error("New tiles must form one horizontal or vertical line.");

  let direction = null;
  if (placementIndexes.length > 1) direction = rows.size === 1 ? [0,1] : [1,0];
  else {
    const index = placementIndexes[0];
    const horizontal = collectWord(boardAfter, index, 0, 1);
    const vertical = collectWord(boardAfter, index, 1, 0);
    direction = horizontal.length >= vertical.length ? [0,1] : [1,0];
  }

  if (placementIndexes.length > 1) {
    const [dr, dc] = direction;
    const values = placementIndexes.map((index) => dr ? rowOf(index) : colOf(index));
    const fixed = dr ? colOf(placementIndexes[0]) : rowOf(placementIndexes[0]);
    for (let value = Math.min(...values); value <= Math.max(...values); value += 1) {
      const index = dr ? indexOf(value, fixed) : indexOf(fixed, value);
      if (!boardAfter[index]) throw new Error("Tiles cannot leave a gap in the played word.");
    }
  }

  const occupiedBefore = boardBefore.some(Boolean);
  const center = indexOf(7, 7);
  if (!occupiedBefore && !placementIndexes.includes(center)) throw new Error("The opening word must cover the center forge.");
  if (occupiedBefore) {
    const connects = placementIndexes.some((index) => adjacent(index).some((neighbor) => boardBefore[neighbor]));
    if (!connects) throw new Error("Your play must connect to at least one tile already on the board.");
  }

  const words = [];
  const seen = new Set();
  const addWord = (cells) => {
    if (cells.length < 2) return;
    const key = cells.join(",");
    if (!seen.has(key)) { seen.add(key); words.push(cells); }
  };
  if (placementIndexes.length > 1) addWord(collectWord(boardAfter, placementIndexes[0], direction[0], direction[1]));
  for (const index of placementIndexes) {
    addWord(collectWord(boardAfter, index, 0, 1));
    addWord(collectWord(boardAfter, index, 1, 0));
  }
  if (!words.length) throw new Error("A play must create a word of at least two tiles.");
  return words;
}

function finalizeGame(state, members, racks, scores, message) {
  const finalScores = { ...scores };
  let finisher = null;
  for (const member of members) {
    const rackValue = (racks[member.uid] || []).reduce((sum, tile) => sum + Number(tile.value || 0), 0);
    finalScores[member.uid] = Number(finalScores[member.uid] || 0) - rackValue;
    if (!racks[member.uid]?.length) finisher = member.uid;
  }
  if (finisher) {
    const bonus = members.filter((member) => member.uid !== finisher).reduce((sum, member) => sum + (racks[member.uid] || []).reduce((inner, tile) => inner + Number(tile.value || 0), 0), 0);
    finalScores[finisher] = Number(finalScores[finisher] || 0) + bonus;
  }
  const ranked = [...members].sort((a, b) => Number(finalScores[b.uid] || 0) - Number(finalScores[a.uid] || 0));
  const winnerUid = ranked[0]?.uid || null;
  return { ...state, phase: "game-over", racks, scores: finalScores, winnerUid, message };
}

export function createWordFoundryGame(members) {
  if (members.length < 2 || members.length > 4) throw new Error("Lexicon Forge supports two to four players.");
  let bag = makeBag();
  const racks = {};
  const scores = {};
  for (const member of members) {
    const draw = drawTiles(bag, WORD_FOUNDRY_RULES.rackSize);
    bag = draw.bag;
    racks[member.uid] = draw.drawn;
    scores[member.uid] = 0;
  }
  return {
    phase: "playing",
    roundNumber: 1,
    board: Array(225).fill(null),
    bag,
    racks,
    scores,
    currentPlayerIndex: 0,
    consecutivePasses: 0,
    winnerUid: null,
    lastPlay: null,
    message: `${members[0].nickname} has the first word.`,
  };
}

export function reduceWordFoundry(state, actorUid, action, members) {
  if (state.phase !== "playing") throw new Error("This Lexicon Forge game is already over.");
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  const boardBefore = normalizeWordBoard(state.board);
  const racks = normalizeRacks(state.racks, members);
  const rack = racks[actorUid] || [];
  let bag = Array.isArray(state.bag) ? state.bag.map((tile) => ({ ...tile })) : [];
  const scores = { ...(state.scores || {}) };
  const nextIndex = (currentIndex + 1) % members.length;

  if (action?.type === "pass") {
    const passes = Number(state.consecutivePasses || 0) + 1;
    if (passes >= members.length * 2) return finalizeGame(state, members, racks, scores, "The table closed after two full rounds without a play.");
    return { ...state, currentPlayerIndex: nextIndex, consecutivePasses: passes, roundNumber: Number(state.roundNumber || 1) + 1, message: `${current.nickname} passed. ${members[nextIndex].nickname}'s turn.` };
  }

  if (action?.type === "exchange") {
    const tileIds = [...new Set(Array.isArray(action.tileIds) ? action.tileIds : [])];
    if (!tileIds.length || tileIds.length > rack.length) throw new Error("Choose at least one rack tile to exchange.");
    if (bag.length < tileIds.length) throw new Error("There are not enough tiles left in the bag to exchange.");
    const selected = tileIds.map((id) => rack.find((tile) => tile.id === id));
    if (selected.some((tile) => !tile)) throw new Error("One of those tiles is no longer in your rack.");
    const kept = rack.filter((tile) => !tileIds.includes(tile.id));
    const draw = drawTiles(bag, tileIds.length);
    bag = shuffled([...draw.bag, ...selected]);
    racks[actorUid] = [...kept, ...draw.drawn];
    return { ...state, bag, racks, currentPlayerIndex: nextIndex, consecutivePasses: Number(state.consecutivePasses || 0) + 1, roundNumber: Number(state.roundNumber || 1) + 1, message: `${current.nickname} exchanged ${tileIds.length} tile${tileIds.length === 1 ? "" : "s"}.` };
  }

  if (action?.type !== "play") throw new Error("Play tiles, exchange, or pass.");
  const placements = Array.isArray(action.placements) ? action.placements : [];
  if (!placements.length) throw new Error("Place at least one tile before playing the word.");
  const uniqueTileIds = new Set();
  const uniqueIndexes = new Set();
  const boardAfter = normalizeWordBoard(boardBefore);
  for (const placement of placements) {
    const index = Number(placement.index);
    const tileId = String(placement.tileId || "");
    if (!Number.isInteger(index) || index < 0 || index >= 225) throw new Error("A tile is outside the board.");
    if (boardBefore[index]) throw new Error("You cannot place a tile on an occupied square.");
    if (uniqueIndexes.has(index) || uniqueTileIds.has(tileId)) throw new Error("Each tile and square can only be used once per play.");
    const tile = rack.find((candidate) => candidate.id === tileId);
    if (!tile) throw new Error("A placed tile is no longer in your rack.");
    const chosenLetter = tile.letter === "?" ? String(placement.letter || "").toUpperCase() : tile.letter;
    if (tile.letter === "?" && !/^[A-Z]$/.test(chosenLetter)) throw new Error("Choose a letter for the wild tile.");
    uniqueIndexes.add(index);
    uniqueTileIds.add(tileId);
    boardAfter[index] = { uid: actorUid, tile: { ...tile, letter: chosenLetter, value: tile.letter === "?" ? 0 : tile.value, wild: tile.letter === "?" } };
  }

  const placementIndexes = [...uniqueIndexes];
  const words = analyzePlacement(boardBefore, boardAfter, placementIndexes);
  const newIndexSet = new Set(placementIndexes);
  const wordScores = words.map((cells) => ({ word: wordText(boardAfter, cells), score: scoreWord(boardAfter, cells, newIndexSet) }));
  const bingo = placements.length === WORD_FOUNDRY_RULES.rackSize ? 35 : 0;
  const turnScore = wordScores.reduce((sum, entry) => sum + entry.score, 0) + bingo;
  scores[actorUid] = Number(scores[actorUid] || 0) + turnScore;
  const remainingRack = rack.filter((tile) => !uniqueTileIds.has(tile.id));
  const draw = drawTiles(bag, WORD_FOUNDRY_RULES.rackSize - remainingRack.length);
  bag = draw.bag;
  racks[actorUid] = [...remainingRack, ...draw.drawn];
  const lastPlay = { uid: actorUid, words: wordScores, score: turnScore, bingo, placements: placementIndexes };

  if (!bag.length && !racks[actorUid].length) return finalizeGame({ ...state, board: boardAfter, bag, lastPlay }, members, racks, scores, `${current.nickname} emptied the rack and closed the forge.`);
  return { ...state, board: boardAfter, bag, racks, scores, lastPlay, currentPlayerIndex: nextIndex, consecutivePasses: 0, roundNumber: Number(state.roundNumber || 1) + 1, message: `${current.nickname} forged ${wordScores.map((entry) => entry.word).join(" + ")} for ${turnScore} points. ${members[nextIndex].nickname}'s turn.` };
}

export function chooseWordFoundryRobotMove(state, members) {
  if (state?.phase !== "playing") return null;
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current?.isRobot) return null;
  const rack = Array.isArray(state.racks?.[current.uid]) ? state.racks[current.uid] : [];
  if (!rack.length) return { uid: current.uid, action: { type: "pass" }, key: `${state.roundNumber}:${current.uid}:pass` };
  const board = normalizeWordBoard(state.board);
  if (!board.some(Boolean)) {
    const count = Math.min(3, rack.length);
    const start = 7 * 15 + (7 - Math.floor(count / 2));
    return { uid: current.uid, action: { type: "play", placements: rack.slice(0, count).map((tile, offset) => ({ tileId: tile.id, index: start + offset, letter: tile.letter === "?" ? "E" : undefined })) }, key: `${state.roundNumber}:${current.uid}:open` };
  }
  for (let existing = 0; existing < board.length; existing += 1) {
    if (!board[existing]) continue;
    for (const target of adjacent(existing)) {
      if (board[target]) continue;
      const tile = rack[0];
      return { uid: current.uid, action: { type: "play", placements: [{ tileId: tile.id, index: target, letter: tile.letter === "?" ? "A" : undefined }] }, key: `${state.roundNumber}:${current.uid}:${target}` };
    }
  }
  return { uid: current.uid, action: { type: "pass" }, key: `${state.roundNumber}:${current.uid}:pass` };
}
