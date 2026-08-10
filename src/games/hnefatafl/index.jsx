import React, { useEffect, useMemo, useState } from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import {
  chooseHnefataflRobotMove,
  CORNERS,
  createHnefataflGame,
  HNEFATAFL_RULES,
  legalHnefataflMoves,
  normalizeHnefataflBoard,
  reduceHnefatafl,
  THRONE,
} from "./engine";
import "./styles.css";

const pieceLabel = { A: "Raider", D: "Guard", K: "King" };
const pieceGlyph = { A: "✦", D: "◆", K: "♔" };
const files = Array.from({ length: HNEFATAFL_RULES.size }, (_, index) => String.fromCharCode(65 + index));

function HnefataflTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const board = useMemo(() => normalizeHnefataflBoard(state.board), [state.board]);
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  const attackerUid = state.attackerUid || members[0]?.uid;
  const defenderUid = state.defenderUid || members[1]?.uid;
  const attacker = members.find((member) => member.uid === attackerUid);
  const defender = members.find((member) => member.uid === defenderUid);
  const mySide = user?.uid === attackerUid ? "attackers" : user?.uid === defenderUid ? "defenders" : "spectator";
  const currentSide = current?.uid === attackerUid ? "attackers" : "defenders";
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const [selected, setSelected] = useState(null);
  const legal = useMemo(() => selected == null ? [] : legalHnefataflMoves(board, selected), [selected, board]);
  const legalSet = useMemo(() => new Set(legal), [legal]);
  const winner = members.find((member) => member.uid === state.winnerUid);
  const selectedPiece = selected == null ? null : board[selected];
  const attackersLeft = board.filter((piece) => piece === "A").length;
  const defendersLeft = board.filter((piece) => piece === "D").length;
  const lastCaptures = state.lastMove?.captures || [];

  useEffect(() => setSelected(null), [state.lastMove?.from, state.lastMove?.to]);

  function ownPiece(piece) {
    return mySide === "attackers" ? piece === "A" : mySide === "defenders" ? piece === "D" || piece === "K" : false;
  }

  function handleSquare(index) {
    if (!myTurn || busy || state.phase !== "playing") return;
    const piece = board[index];
    if (selected != null && legalSet.has(index)) {
      act({ type: "move", from: selected, to: index });
      return;
    }
    if (piece && ownPiece(piece)) setSelected(selected === index ? null : index);
    else setSelected(null);
  }

  const myObjective = mySide === "attackers"
    ? "Close the net and capture the king. Ordinary pieces fall when sandwiched between hostile sides."
    : mySide === "defenders"
      ? "Open an escape lane and move the king onto any glowing corner before the raiders surround him."
      : "Watch the raiders hunt the king while the defenders race for a corner.";

  return (
    <main className="modular-game-shell hnef-shell">
      <section className="modular-game-panel hnef-table">
        <div className="modular-game-toolbar hnef-toolbar">
          <div><p className="game-kicker">Viking siege · asymmetric strategy</p><h1>Hnefatafl</h1></div>
          <button type="button" className="secondary" onClick={navigateToHub}>← All games</button>
        </div>
        {error ? <p className="modular-error">{error}</p> : null}

        <PlayerChips
          activeUid={state.phase === "playing" ? current?.uid : state.winnerUid}
          members={members}
          renderDetail={(member) => member.uid === attackerUid ? "Raiders · capture the king" : "Defenders · escape to a corner"}
        />

        <section className={`hnef-turn-banner ${myTurn ? "mine" : ""}`} aria-live="polite">
          <div className="hnef-turn-icon">{currentSide === "attackers" ? "⚔" : "♔"}</div>
          <div>
            <small>{state.phase === "game-over" ? "BATTLE COMPLETE" : myTurn ? "YOUR TURN" : "CURRENT TURN"}</small>
            <strong>{state.message}</strong>
            <span>{state.phase === "playing" ? (myTurn ? "Choose one of your pieces. Its legal destinations will light up." : `${current?.nickname} commands the ${currentSide}.`) : `${winner?.nickname || "The winner"} has ended the siege.`}</span>
          </div>
        </section>

        <div className="hnef-objective-strip">
          <article className={`${mySide === "attackers" ? "yours" : ""} ${currentSide === "attackers" && state.phase === "playing" ? "active" : ""}`}>
            <span className="hnef-side-symbol attacker">✦</span>
            <div><small>RAIDERS</small><strong>{attacker?.nickname || "Attackers"}</strong><p>Capture the king.</p></div>
          </article>
          <div className="hnef-versus">VS</div>
          <article className={`${mySide === "defenders" ? "yours" : ""} ${currentSide === "defenders" && state.phase === "playing" ? "active" : ""}`}>
            <span className="hnef-side-symbol defender">♔</span>
            <div><small>DEFENDERS</small><strong>{defender?.nickname || "Defenders"}</strong><p>Escort the king to a corner.</p></div>
          </article>
        </div>

        <div className="hnef-layout">
          <section className="hnef-board-zone">
            <div className="hnef-board-frame">
              <div className="hnef-file-labels" aria-hidden="true">{files.map((file) => <span key={file}>{file}</span>)}</div>
              <div className="hnef-board-with-ranks">
                <div className="hnef-rank-labels" aria-hidden="true">{Array.from({ length: HNEFATAFL_RULES.size }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
                <div className="hnef-board" role="grid" aria-label="11 by 11 Hnefatafl board">
                  {board.map((piece, index) => {
                    const row = Math.floor(index / HNEFATAFL_RULES.size);
                    const column = index % HNEFATAFL_RULES.size;
                    const corner = CORNERS.has(index);
                    const throne = index === THRONE;
                    const canMove = legalSet.has(index);
                    const selectedHere = selected === index;
                    const selectable = myTurn && piece && ownPiece(piece);
                    const wasDestination = state.lastMove?.to === index;
                    const wasOrigin = state.lastMove?.from === index;
                    return (
                      <button
                        type="button"
                        key={index}
                        role="gridcell"
                        className={`${(row + column) % 2 ? "dark" : "light"} ${corner ? "corner" : ""} ${throne ? "throne" : ""} ${canMove ? "legal" : ""} ${selectedHere ? "selected" : ""} ${selectable ? "selectable" : ""} ${wasDestination ? "last-to" : ""} ${wasOrigin ? "last-from" : ""}`}
                        onClick={() => handleSquare(index)}
                        disabled={!myTurn || busy}
                        aria-label={`${files[column]}${row + 1}${piece ? ` ${pieceLabel[piece]}` : " empty"}${canMove ? ", legal destination" : ""}`}
                      >
                        {piece ? <span className={`hnef-piece ${piece === "A" ? "attacker" : piece === "K" ? "king" : "defender"}`}><i>{pieceGlyph[piece]}</i><em>{piece === "K" ? "K" : piece === "A" ? "R" : "G"}</em></span> : corner ? <span className="hnef-marker corner-marker">✦</span> : throne ? <span className="hnef-marker">♜</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`hnef-selection-help ${selectedPiece ? "has-selection" : ""}`}>
              <span className="hnef-help-icon">{selectedPiece ? pieceGlyph[selectedPiece] : myTurn ? "☝" : "…"}</span>
              <div>
                <strong>{selectedPiece ? `${pieceLabel[selectedPiece]} selected` : myTurn ? "Choose a piece" : `Waiting for ${current?.nickname || "opponent"}`}</strong>
                <p>{selectedPiece ? `${legal.length} legal destination${legal.length === 1 ? "" : "s"} highlighted. Click a glowing square to move, or another piece to change selection.` : myTurn ? "Your movable pieces glow subtly. Pieces move any distance horizontally or vertically through open squares." : "The board will update automatically after the move."}</p>
              </div>
              {selectedPiece ? <button type="button" className="secondary" onClick={() => setSelected(null)}>Clear</button> : null}
            </div>
          </section>

          <aside className="hnef-side-panel">
            <section className="hnef-mission-card">
              <small>YOUR MISSION</small>
              <h2>{mySide === "attackers" ? "Hunt the King" : mySide === "defenders" ? "Break the Siege" : "The Siege"}</h2>
              <p>{myObjective}</p>
            </section>

            <section className="hnef-count-card">
              <div><span className="hnef-mini-piece attacker">✦</span><p><strong>{attackersLeft}</strong><small>Raiders left</small></p></div>
              <div><span className="hnef-mini-piece defender">◆</span><p><strong>{defendersLeft}</strong><small>Guards left</small></p></div>
            </section>

            <section className="hnef-rules-card">
              <h3>How a turn works</h3>
              <ol>
                <li><b>Select</b> one of your pieces.</li>
                <li><b>Move</b> like a rook: any distance up, down, left, or right.</li>
                <li><b>Capture</b> by trapping an enemy between hostile sides.</li>
              </ol>
              <div className="hnef-rule-note"><span>✦</span><p><b>Corner squares are exits.</b> Only the king may land there. The throne and corners also help form captures.</p></div>
              {lastCaptures.length ? <div className="hnef-last-capture"><small>LAST MOVE</small><strong>{lastCaptures.length} piece{lastCaptures.length === 1 ? "" : "s"} captured</strong></div> : null}
            </section>
          </aside>
        </div>

        {state.phase === "game-over" ? <div className="hnef-game-over"><span>{state.winnerSide === "defenders" ? "♔" : "⚔"}</span><div><small>SIEGE ENDED</small><h2>{winner?.nickname || "Winner"} wins as the {state.winnerSide}</h2><p>{state.winnerSide === "defenders" ? "The king escaped the encirclement." : "The raiders closed the net around the king."}</p></div><button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button></div> : null}
      </section>
    </main>
  );
}

export default function HnefataflGame() {
  const controller = useModularTable({ gameId: "hnefatafl", maxPlayers: 2, minimumPlayers: 2, createGameState: createHnefataflGame, reduceGameState: reduceHnefatafl, chooseRobotMove: chooseHnefataflRobotMove, robotDelay: 850 });
  if (!controller.roomCode) return <GameHome
    controller={controller}
    title="Hnefatafl"
    kicker="Viking king hunt"
    summary="An asymmetric Viking strategy game: raiders tighten a deadly net around the king while the defenders carve an escape route to one of four corner strongholds."
    maxPlayers={2}
    quickPlayChoices={[
      { icon: "♔", label: "Defend the King", description: "Recommended first game. Escape the king to a corner while the robot attacks.", rules: { humanSide: "defenders" } },
      { icon: "⚔", label: "Lead the Raiders", description: "Surround the king and crush the escape routes while the robot defends.", rules: { humanSide: "attackers" } },
    ]}
  />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Hnefatafl room…</h1><p>Carving the board and placing the warbands.</p></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Hnefatafl" minimumPlayers={2} maxPlayers={2} startLabel="Begin the siege" seatLabels={["Raiders · move first", "Defenders · protect the king"]} lobbyHint="Seat one leads the raiders; seat two protects the king. Add a robot for an instant opponent." />;
  return <HnefataflTable controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "hnefatafl", name: "Hnefatafl", players: "2" });
