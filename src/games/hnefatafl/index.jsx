import React, { useEffect, useMemo, useState } from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chooseHnefataflRobotMove, CORNERS, createHnefataflGame, HNEFATAFL_RULES, legalHnefataflMoves, reduceHnefatafl, THRONE } from "./engine";
import "./styles.css";

const pieceLabel = { A: "Attacker", D: "Defender", K: "King" };
const pieceGlyph = { A: "●", D: "○", K: "♔" };

function HnefataflTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  const myIndex = members.findIndex((member) => member.uid === user?.uid);
  const mySide = myIndex === 0 ? "attackers" : "defenders";
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const [selected, setSelected] = useState(null);
  const legal = useMemo(() => selected == null ? [] : legalHnefataflMoves(state.board || [], selected), [selected, state.board]);
  const legalSet = useMemo(() => new Set(legal), [legal]);
  const winner = members.find((member) => member.uid === state.winnerUid);

  useEffect(() => setSelected(null), [state.lastMove?.from, state.lastMove?.to]);

  function ownPiece(piece) {
    return mySide === "attackers" ? piece === "A" : piece === "D" || piece === "K";
  }

  function handleSquare(index) {
    if (!myTurn || busy || state.phase !== "playing") return;
    const piece = state.board[index];
    if (selected != null && legalSet.has(index)) {
      act({ type: "move", from: selected, to: index });
      return;
    }
    if (piece && ownPiece(piece)) setSelected(selected === index ? null : index);
    else setSelected(null);
  }

  return (
    <main className="modular-game-shell hnef-shell"><section className="modular-game-panel hnef-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Viking siege game · king versus raiders</p><h1>Hnefatafl</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <PlayerChips members={members} renderDetail={(member) => Number(member.seat) === 0 ? "Attackers · capture the king" : "Defenders · escape the king"} />
      <section className="hnef-status" aria-live="polite"><strong>{state.message}</strong><span>{myTurn ? `You command the ${mySide}. Select a piece, then an open square.` : state.phase === "playing" ? `${current?.nickname} is moving.` : "Battle complete."}</span></section>
      <div className="hnef-layout">
        <div className="hnef-board" role="grid" aria-label="11 by 11 Hnefatafl board">
          {(state.board || []).map((piece, index) => {
            const row = Math.floor(index / HNEFATAFL_RULES.size);
            const column = index % HNEFATAFL_RULES.size;
            const corner = CORNERS.has(index);
            const throne = index === THRONE;
            const canMove = legalSet.has(index);
            const selectedHere = selected === index;
            return (
              <button
                type="button"
                key={index}
                role="gridcell"
                className={`${(row + column) % 2 ? "dark" : "light"} ${corner ? "corner" : ""} ${throne ? "throne" : ""} ${canMove ? "legal" : ""} ${selectedHere ? "selected" : ""}`}
                onClick={() => handleSquare(index)}
                disabled={!myTurn || busy}
                aria-label={`${String.fromCharCode(65 + column)}${row + 1}${piece ? ` ${pieceLabel[piece]}` : " empty"}`}
              >
                {piece ? <span className={`hnef-piece ${piece === "A" ? "attacker" : piece === "K" ? "king" : "defender"}`}>{pieceGlyph[piece]}</span> : corner ? <span className="hnef-marker">✦</span> : throne ? <span className="hnef-marker">♜</span> : null}
              </button>
            );
          })}
        </div>
        <aside className="hnef-rules-card">
          <h3>Fast rules</h3>
          <p><b>Attackers:</b> surround and capture the king.</p>
          <p><b>Defenders:</b> move the king to any corner.</p>
          <p>All pieces move any distance orthogonally through open squares. Capture ordinary pieces by sandwiching them between two hostile sides.</p>
          <p>The throne and corners are restricted squares; only the king may occupy them.</p>
          <small>This table uses an approachable 11×11 tafl ruleset without shield-wall, repetition, or fort variants.</small>
        </aside>
      </div>
      {state.phase === "game-over" ? <div className="hnef-game-over"><h2>{winner?.nickname || "Winner"} wins for the {state.winnerSide}</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button></div> : null}
    </section></main>
  );
}

export default function HnefataflGame() {
  const controller = useModularTable({ gameId: "hnefatafl", maxPlayers: 2, minimumPlayers: 2, createGameState: createHnefataflGame, reduceGameState: reduceHnefatafl, chooseRobotMove: chooseHnefataflRobotMove, robotDelay: 850 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Hnefatafl" kicker="Viking king hunt" summary="An asymmetric 11×11 Viking strategy game: one side commands the raiders trying to capture the king while the defenders fight to escort him to a corner." maxPlayers={2} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Hnefatafl room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Hnefatafl" minimumPlayers={2} maxPlayers={2} startLabel="Begin the siege" />;
  return <HnefataflTable controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "hnefatafl", name: "Hnefatafl", players: "2" });
