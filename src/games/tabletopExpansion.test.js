import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chooseConnect4RobotMove, createConnect4Game, reduceConnect4 } from "./connect4/engine.js";
import { createHnefataflBoard, legalHnefataflMoves, reduceHnefatafl } from "./hnefatafl/engine.js";
import { BATTLESHIP_FLEET, placeBattleshipFleet, reduceBattleship } from "./battleship/engine.js";
import { extractBooks, reduceGoFish } from "../platform/goFishCore.js";

const members2 = [
  { uid: "a", nickname: "A", seat: 0, isRobot: false },
  { uid: "b", nickname: "B", seat: 1, isRobot: false },
];
const card = (rank, suit, n = 0) => ({ id: `${rank}-${suit}-${n}`, rank, suit, value: Number(rank) || 10, color: ["hearts", "diamonds"].includes(suit) ? "red" : "black" });

test("Connect 4 detects a vertical four", () => {
  let state = createConnect4Game(members2);
  const columns = [0, 1, 0, 1, 0, 1, 0];
  for (let index = 0; index < columns.length; index += 1) state = reduceConnect4(state, members2[index % 2].uid, { type: "drop", column: columns[index] }, members2);
  assert.equal(state.phase, "game-over");
  assert.equal(state.winnerUid, "a");
  assert.equal(state.winningCells.length, 4);
});

test("Connect 4 robot blocks an immediate opponent win", () => {
  const members = [{ ...members2[0], isRobot: true }, members2[1]];
  const board = Array(42).fill(null);
  board[35] = "b"; board[36] = "b"; board[37] = "b";
  const move = chooseConnect4RobotMove({ phase: "playing", currentPlayerIndex: 0, board }, members);
  assert.equal(move.action.column, 3);
});

test("Hnefatafl starts with 24 attackers, 12 defenders, and one king", () => {
  const board = createHnefataflBoard();
  assert.equal(board.filter((piece) => piece === "A").length, 24);
  assert.equal(board.filter((piece) => piece === "D").length, 12);
  assert.equal(board.filter((piece) => piece === "K").length, 1);
  assert.ok(legalHnefataflMoves(board, 3).length > 0);
});

test("Hnefatafl defenders win when the king reaches a corner", () => {
  const board = Array(121).fill(null);
  board[1] = "K";
  const state = { phase: "playing", board, currentPlayerIndex: 1, winnerUid: null, winnerSide: null, lastMove: null };
  const next = reduceHnefatafl(state, "b", { type: "move", from: 1, to: 0 }, members2);
  assert.equal(next.phase, "game-over");
  assert.equal(next.winnerSide, "defenders");
  assert.equal(next.winnerUid, "b");
});

test("Hnefatafl captures an ordinary piece by sandwiching it", () => {
  const board = Array(121).fill(null);
  const idx = (row, col) => row * 11 + col;
  board[idx(4, 2)] = "A";
  board[idx(4, 4)] = "D";
  board[idx(4, 5)] = "A";
  board[idx(6, 6)] = "K";
  const state = { phase: "playing", board, currentPlayerIndex: 0, winnerUid: null, winnerSide: null, lastMove: null };
  const next = reduceHnefatafl(state, "a", { type: "move", from: idx(4, 2), to: idx(4, 3) }, members2);
  assert.equal(next.board[idx(4, 4)], null);
});

test("Battleship deployment creates the classic non-overlapping 17-cell fleet", () => {
  let seed = 123456789;
  const random = () => { seed = (1664525 * seed + 1013904223) % 4294967296; return seed / 4294967296; };
  const fleet = placeBattleshipFleet(random);
  assert.deepEqual(fleet.map((ship) => ship.size), BATTLESHIP_FLEET.map((ship) => ship.size));
  const cells = fleet.flatMap((ship) => ship.cells);
  assert.equal(cells.length, 17);
  assert.equal(new Set(cells).size, 17);
});

test("Battleship records a hit and can sink the final ship", () => {
  const state = {
    phase: "playing",
    currentPlayerIndex: 0,
    fleets: {
      a: [{ id: "d", name: "Destroyer", size: 2, cells: [10, 11], hits: [] }],
      b: [{ id: "d", name: "Destroyer", size: 2, cells: [20, 21], hits: [20] }],
    },
    shots: { a: { 20: "hit" }, b: {} },
    winnerUid: null,
  };
  const next = reduceBattleship(state, "a", { type: "fire", cell: 21 }, members2);
  assert.equal(next.shots.a[21], "hit");
  assert.equal(next.phase, "game-over");
  assert.equal(next.winnerUid, "a");
});

test("Go Fish turns four matching cards into a book", () => {
  const hand = [card("7", "clubs", 1), card("7", "diamonds", 2), card("7", "hearts", 3), card("7", "spades", 4), card("2", "clubs", 5)];
  const result = extractBooks(hand, []);
  assert.deepEqual(result.books, ["7"]);
  assert.equal(result.hand.length, 1);
});

test("Go Fish successful asks transfer every matching card and keep the turn", () => {
  const state = {
    phase: "playing",
    hands: {
      a: [card("7", "clubs", 1), card("7", "diamonds", 2), card("7", "hearts", 3), card("2", "clubs", 5)],
      b: [card("7", "spades", 4), card("4", "clubs", 6)],
    },
    books: { a: [], b: [] },
    stock: [card("9", "clubs", 7)],
    currentPlayerIndex: 0,
    winnerUids: [],
  };
  const next = reduceGoFish(state, "a", { type: "ask", rank: "7", targetUid: "b" }, members2);
  assert.deepEqual(next.books.a, ["7"]);
  assert.equal(next.currentPlayerIndex, 0);
  assert.equal(next.hands.b.length, 1);
});

test("the adult variant is explicitly gated and branded Go F' Yourself", async () => {
  const source = await readFile(new URL("./gofyourself/index.jsx", import.meta.url), "utf8");
  const moduleSource = await readFile(new URL("../platform/GoFishModule.jsx", import.meta.url), "utf8");
  assert.match(source, /Go F' Yourself/);
  assert.match(source, /adult:\s*true/);
  assert.match(moduleSource, /18\+ table/);
  assert.match(moduleSource, /Go F' Yourself/);
});

test("the hub expands beyond card games and installs all five new routes", async () => {
  const hub = await readFile(new URL("../HubApp.jsx", import.meta.url), "utf8");
  for (const gameId of ["hnefatafl", "connect4", "gofish", "gofyourself", "battleship"]) {
    assert.match(hub, new RegExp(`id: "${gameId}"`));
  }
  assert.match(hub, /Family Game Room/);
  assert.match(hub, /cards, boards, strategy/);
  assert.match(hub, /Go F' Yourself/);
});

test("new tabletop games have dedicated learn-to-play guides", async () => {
  const learning = await readFile(new URL("../platform/TabletopLearningCenter.jsx", import.meta.url), "utf8");
  for (const gameId of ["hnefatafl", "connect4", "gofish", "gofyourself", "battleship"]) {
    assert.match(learning, new RegExp(`\\b${gameId}:\\s*\\{`));
  }
  assert.match(learning, /Learn to play/);
  assert.match(learning, /Full rules/);
  assert.match(learning, /18\+ only/);
});
