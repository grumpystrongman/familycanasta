import React, { useMemo, useState } from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chessInCheck, chessPieceGlyph, chessSideForSeat, chessSquareName, chooseChessRobotMove, createChessGame, legalChessMoves, normalizeChessBoard, reduceChess } from "./engine";
import "./styles.css";

function ChessTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const board = normalizeChessBoard(state.board);
  const [selected, setSelected] = useState(null);
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  const mySeat = members.findIndex((member) => member.uid === user?.uid);
  const myColor = chessSideForSeat(mySeat);
  const currentColor = chessSideForSeat(currentIndex);
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const legal = useMemo(() => selected == null ? [] : legalChessMoves(state, currentColor, selected), [state, selected, currentColor]);
  const legalTargets = new Set(legal.map((move) => move.to));
  const winner = members.find((member) => member.uid === state.winnerUid);
  const indices = Array.from({ length: 64 }, (_, index) => myColor === "black" ? 63 - index : index);
  const inCheck = state.phase === "playing" && chessInCheck(board, currentColor);
  const lastSquares = new Set([state.lastMove?.from, state.lastMove?.to].filter((value) => value != null));

  function chooseSquare(index) {
    if (!myTurn || busy) return;
    const piece = board[index];
    if (selected != null && legalTargets.has(index)) {
      act({ type: "move", from: selected, to: index, promotion: "q" });
      setSelected(null);
      return;
    }
    if (piece?.color === myColor) setSelected((value) => value === index ? null : index);
    else setSelected(null);
  }

  return (
    <main className="modular-game-shell chess-shell"><section className="modular-game-panel chess-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Classic strategy · full legal movement</p><h1>Chess</h1></div><button type="button" className="secondary" onClick={navigateToHub}>← All games</button></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <PlayerChips members={members} activeUid={state.phase === "playing" ? current?.uid : state.winnerUid} renderDetail={(member) => `${chessSideForSeat(member.seat) === "white" ? "White" : "Black"}${member.uid === state.winnerUid ? " · Winner" : current?.uid === member.uid && state.phase === "playing" ? " · Moving" : ""}`} />
      <section className={`chess-status ${inCheck ? "check" : ""}`}><strong>{state.message}</strong><span>{state.phase === "playing" ? (myTurn ? "Your move. Select a piece; legal destinations will glow." : `Waiting for ${current?.nickname}.`) : state.result === "stalemate" ? "Draw by stalemate." : winner ? `${winner.nickname} closed the game.` : "Game complete."}</span></section>
      <div className="chess-layout">
        <div className="chess-board" role="grid" aria-label="Chess board">
          {indices.map((index) => {
            const row = Math.floor(index / 8);
            const column = index % 8;
            const piece = board[index];
            const square = chessSquareName(index);
            return <button key={index} type="button" role="gridcell" onClick={() => chooseSquare(index)} className={`chess-square ${(row + column) % 2 ? "dark" : "light"} ${selected === index ? "selected" : ""} ${legalTargets.has(index) ? "legal" : ""} ${lastSquares.has(index) ? "last" : ""}`} aria-label={`${square}${piece ? ` ${piece.color} ${piece.type}` : " empty"}`}>
              <span className={`chess-piece ${piece?.color || ""}`}>{chessPieceGlyph(piece)}</span>
              <small>{square}</small>
            </button>;
          })}
        </div>
        <aside className="chess-rules-card"><p className="game-kicker">At this table</p><h2>Standard chess</h2><ul><li>Check and checkmate are enforced.</li><li>Castling and en passant are supported.</li><li>Pawns auto-promote to queens for now.</li><li>Stalemate ends the game as a draw.</li></ul></aside>
      </div>
      {state.phase === "game-over" ? <div className="chess-game-over"><h2>{state.result === "stalemate" ? "Stalemate" : winner ? `${winner.nickname} wins` : "Game over"}</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button></div> : null}
    </section></main>
  );
}

export default function ChessGame() {
  const controller = useModularTable({ gameId: "chess", maxPlayers: 2, minimumPlayers: 2, createGameState: createChessGame, reduceGameState: reduceChess, chooseRobotMove: chooseChessRobotMove, robotDelay: 500 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Chess" kicker="Sixty-four squares · no luck required" summary="Play a full two-player chess table with legal-move enforcement, check, checkmate, castling, en passant, stalemate, and a quick robot opponent." maxPlayers={2} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening chess table…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Chess" minimumPlayers={2} maxPlayers={2} startLabel="Start the clock" seatLabels={["White pieces", "Black pieces"]} />;
  return <ChessTable controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "chess", name: "Chess", players: "2" });
