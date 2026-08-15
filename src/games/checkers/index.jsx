import React, { useMemo, useState } from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chooseCheckersRobotMove, createCheckersGame, legalCheckersMoves, normalizeCheckersBoard, reduceCheckers } from "./engine";
import "./styles.css";

function CheckersTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const board = normalizeCheckersBoard(state.board);
  const [selected, setSelected] = useState(null);
  const current = members[Number(state.currentPlayerIndex || 0)];
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const mySeat = members.findIndex((member) => member.uid === user?.uid);
  const indices = Array.from({ length: 64 }, (_, index) => mySeat === 1 ? 63 - index : index);
  const legalMoves = useMemo(() => myTurn ? legalCheckersMoves(state, user?.uid, members) : [], [state, myTurn, user?.uid, members]);
  const selectable = new Set(legalMoves.map((move) => move.from));
  const targets = new Set(legalMoves.filter((move) => selected == null || move.from === selected).map((move) => move.to));
  const winner = members.find((member) => member.uid === state.winnerUid);

  function clickSquare(index) {
    if (!myTurn || busy) return;
    if (selected != null && targets.has(index)) {
      act({ type: "move", from: selected, to: index });
      setSelected(null);
      return;
    }
    if (board[index]?.uid === user?.uid && selectable.has(index)) setSelected((value) => value === index ? null : index);
    else setSelected(null);
  }

  return <main className="modular-game-shell checkers-shell"><section className="modular-game-panel checkers-table">
    <div className="modular-game-toolbar"><div><p className="game-kicker">American checkers · forced captures</p><h1>Checkers</h1></div><button type="button" className="secondary" onClick={navigateToHub}>← All games</button></div>
    {error ? <p className="modular-error">{error}</p> : null}
    <PlayerChips members={members} activeUid={state.phase === "playing" ? current?.uid : state.winnerUid} renderDetail={(member) => `${Number(member.seat) === 0 ? "Crimson" : "Ivory"}${member.uid === state.winnerUid ? " · Winner" : state.forcedFrom != null && current?.uid === member.uid ? " · Continue jump" : ""}`} />
    <div className="checkers-status"><strong>{state.message}</strong><span>{myTurn ? (state.forcedFrom != null ? "Keep jumping with the same checker." : "Your move. Captures are mandatory when available.") : state.phase === "playing" ? `Waiting for ${current?.nickname}.` : "Round complete."}</span></div>
    <div className="checkers-layout">
      <div className="checkers-board" role="grid" aria-label="Checkers board">
        {indices.map((index) => {
          const row = Math.floor(index / 8); const column = index % 8; const piece = board[index];
          return <button key={index} type="button" role="gridcell" onClick={() => clickSquare(index)} className={`checkers-square ${(row + column) % 2 ? "dark" : "light"} ${selected === index ? "selected" : ""} ${targets.has(index) ? "target" : ""}`} aria-label={piece ? `${piece.uid === members[0]?.uid ? "crimson" : "ivory"} ${piece.king ? "king" : "checker"}` : "empty square"}>
            {piece ? <span className={`checker-piece ${piece.uid === members[0]?.uid ? "p1" : "p2"} ${piece.king ? "king" : ""}`}><i>{piece.king ? "♛" : ""}</i></span> : null}
          </button>;
        })}
      </div>
      <aside className="checkers-rules-card"><p className="game-kicker">Rules in play</p><h2>Fast, strict checkers</h2><ul><li>Diagonal movement on dark squares only.</li><li>If a capture exists, you must take it.</li><li>Multi-jumps continue in the same turn.</li><li>Reach the far edge to crown a king.</li></ul></aside>
    </div>
    {state.phase === "game-over" ? <div className="checkers-game-over"><h2>{winner ? `${winner.nickname} wins` : "Game over"}</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button></div> : null}
  </section></main>;
}

export default function CheckersGame() {
  const controller = useModularTable({ gameId: "checkers", maxPlayers: 2, minimumPlayers: 2, createGameState: createCheckersGame, reduceGameState: reduceCheckers, chooseRobotMove: chooseCheckersRobotMove, robotDelay: 450 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Checkers" kicker="Jump · crown · trap" summary="Classic American checkers with mandatory captures, chained jumps, kings, online rooms, and a quick robot opponent." maxPlayers={2} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening checkers table…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Checkers" minimumPlayers={2} maxPlayers={2} startLabel="Make the first move" seatLabels={["Crimson checkers", "Ivory checkers"]} />;
  return <CheckersTable controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "checkers", name: "Checkers", players: "2" });
