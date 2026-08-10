import React from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chooseConnect4RobotMove, CONNECT4_RULES, createConnect4Game, normalizeConnect4Board, reduceConnect4 } from "./engine";
import "./styles.css";

function Connect4Table({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const board = normalizeConnect4Board(state.board);
  const current = members[Number(state.currentPlayerIndex || 0)];
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const winner = members.find((member) => member.uid === state.winnerUid);
  const winning = new Set(state.winningCells || []);

  return (
    <main className="modular-game-shell connect4-shell"><section className="modular-game-panel connect4-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Vertical strategy · four in a row</p><h1>Connect 4</h1></div><button type="button" className="secondary" onClick={navigateToHub}>← All games</button></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <PlayerChips activeUid={state.phase === "playing" ? current?.uid : state.winnerUid} members={members} renderDetail={(member) => current?.uid === member.uid && state.phase === "playing" ? "Dropping now" : member.uid === state.winnerUid ? "Winner" : "Waiting"} />
      <div className="connect4-status"><strong>{state.message}</strong><span>{myTurn ? "Your move — choose a column." : state.phase === "playing" ? `Waiting for ${current?.nickname}.` : "Round complete."}</span></div>
      <div className="connect4-board-wrap">
        <div className="connect4-drop-row" aria-label="Choose a column">
          {Array.from({ length: CONNECT4_RULES.columns }, (_, column) => (
            <button key={column} type="button" disabled={!myTurn || busy || board[column] != null} onClick={() => act({ type: "drop", column })} aria-label={`Drop in column ${column + 1}`}>▼</button>
          ))}
        </div>
        <div className="connect4-board" role="grid" aria-label="Connect 4 board">
          {board.map((uid, index) => {
            const playerIndex = members.findIndex((member) => member.uid === uid);
            return <span key={index} role="gridcell" className={`connect4-slot ${uid ? `p${playerIndex + 1}` : "empty"} ${winning.has(index) ? "winning" : ""}`} aria-label={uid ? `${members[playerIndex]?.nickname || "Player"} checker` : "Empty"}><i /></span>;
          })}
        </div>
      </div>
      <div className="connect4-legend">{members.map((member, index) => <span key={member.uid}><i className={`p${index + 1}`} /> {member.nickname}</span>)}</div>
      {state.phase === "game-over" ? <div className="connect4-game-over"><h2>{winner ? `${winner.nickname} wins` : "Draw game"}</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button></div> : null}
    </section></main>
  );
}

export default function Connect4Game() {
  const controller = useModularTable({ gameId: "connect4", maxPlayers: 2, minimumPlayers: 2, createGameState: createConnect4Game, reduceGameState: reduceConnect4, chooseRobotMove: chooseConnect4RobotMove });
  if (!controller.roomCode) return <GameHome controller={controller} title="Connect 4" kicker="Drop, block, connect" summary="The classic 7×6 vertical board: take turns dropping checkers, block your opponent, and connect four horizontally, vertically, or diagonally." maxPlayers={2} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Connect 4 room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Connect 4" minimumPlayers={2} maxPlayers={2} startLabel="Drop the first checker" seatLabels={["Red checkers", "Yellow checkers"]} />;
  return <Connect4Table controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "connect4", name: "Connect 4", players: "2" });
