import React, { useEffect, useMemo, useState } from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chooseWordFoundryRobotMove, createWordFoundryGame, normalizeWordBoard, reduceWordFoundry, wordFoundryBonusAt } from "./engine";
import "./styles.css";

function RackTile({ tile, selected, onClick }) {
  return <button type="button" className={`forge-rack-tile ${selected ? "selected" : ""}`} onClick={onClick}><strong>{tile.letter}</strong><small>{tile.value}</small></button>;
}

function LexiconForgeTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const board = normalizeWordBoard(state.board);
  const rack = Array.isArray(state.racks?.[user?.uid]) ? state.racks[user.uid] : [];
  const current = members[Number(state.currentPlayerIndex || 0)];
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [draft, setDraft] = useState({});
  const winner = members.find((member) => member.uid === state.winnerUid);
  const draftTileIds = new Set(Object.values(draft).map((item) => item.tileId));
  const availableRack = rack.filter((tile) => !draftTileIds.has(tile.id));
  const selectedTile = rack.find((tile) => tile.id === selectedTileId);
  const draftPlacements = Object.entries(draft).map(([index, item]) => ({ index: Number(index), ...item }));
  const boardCells = useMemo(() => board.map((cell, index) => cell || (draft[index] ? { uid: user?.uid, tile: draft[index].tile, draft: true } : null)), [board, draft, user?.uid]);

  useEffect(() => { setDraft({}); setSelectedTileId(null); }, [state.roundNumber]);

  function placeAt(index) {
    if (!myTurn || busy || board[index]) return;
    if (draft[index]) {
      setDraft((currentDraft) => { const next = { ...currentDraft }; delete next[index]; return next; });
      return;
    }
    if (!selectedTile) return;
    let letter = selectedTile.letter;
    if (letter === "?") {
      const choice = window.prompt("Choose a letter for the wild tile:", "E")?.trim().toUpperCase();
      if (!choice || !/^[A-Z]$/.test(choice)) return;
      letter = choice;
    }
    setDraft((currentDraft) => ({ ...currentDraft, [index]: { tileId: selectedTile.id, letter: selectedTile.letter === "?" ? letter : undefined, tile: { ...selectedTile, letter, value: selectedTile.letter === "?" ? 0 : selectedTile.value } } }));
    setSelectedTileId(null);
  }

  function playDraft() {
    if (!draftPlacements.length) return;
    act({ type: "play", placements: draftPlacements.map(({ index, tileId, letter }) => ({ index, tileId, letter })) });
  }

  function exchangeSelected() {
    if (!selectedTileId) return;
    act({ type: "exchange", tileIds: [selectedTileId] });
  }

  return <main className="modular-game-shell forge-shell"><section className="modular-game-panel forge-table">
    <div className="modular-game-toolbar"><div><p className="game-kicker">Original word-tile strategy</p><h1>Lexicon Forge</h1></div><button type="button" className="secondary" onClick={navigateToHub}>← All games</button></div>
    {error ? <p className="modular-error">{error}</p> : null}
    <PlayerChips members={members} activeUid={state.phase === "playing" ? current?.uid : state.winnerUid} renderDetail={(member) => `${Number(state.scores?.[member.uid] || 0)} pts · ${(state.racks?.[member.uid] || []).length} tiles${member.uid === state.winnerUid ? " · Winner" : ""}`} />
    <div className="forge-status"><div><strong>{state.message}</strong><span>{myTurn ? "Build one connected word line, then strike the forge." : state.phase === "playing" ? `Waiting for ${current?.nickname}.` : "The forge is closed."}</span></div><aside><b>{state.bag?.length || 0}</b><small>tiles left</small></aside></div>
    <div className="forge-board-scroll"><div className="forge-board" role="grid" aria-label="Lexicon Forge word board">
      {boardCells.map((cell, index) => {
        const bonus = wordFoundryBonusAt(index);
        const bonusClass = bonus ? `bonus-${bonus.toLowerCase()}` : "";
        return <button key={index} type="button" role="gridcell" disabled={!myTurn || busy || Boolean(board[index])} onClick={() => placeAt(index)} className={`forge-cell ${bonusClass} ${cell?.draft ? "draft" : ""}`} aria-label={cell ? `${cell.tile.letter} worth ${cell.tile.value}` : bonus ? `${bonus} premium square` : "empty square"}>
          {cell ? <span className="forge-board-tile"><strong>{cell.tile.letter}</strong><small>{cell.tile.value}</small></span> : <small className="forge-bonus-label">{index === 112 ? "FORGE" : bonus || ""}</small>}
        </button>;
      })}
    </div></div>
    <section className="forge-rack-panel"><div><p className="game-kicker">Your rack</p><div className="forge-rack">{availableRack.map((tile) => <RackTile key={tile.id} tile={tile} selected={selectedTileId === tile.id} onClick={() => setSelectedTileId((value) => value === tile.id ? null : tile.id)} />)}{!availableRack.length ? <span className="forge-empty-rack">No loose tiles</span> : null}</div></div><div className="forge-actions"><button type="button" className="secondary" disabled={!myTurn || busy || !Object.keys(draft).length} onClick={() => setDraft({})}>Clear draft</button><button type="button" className="secondary" disabled={!myTurn || busy || !selectedTileId || Object.keys(draft).length > 0} onClick={exchangeSelected}>Exchange selected</button><button type="button" className="secondary" disabled={!myTurn || busy || Object.keys(draft).length > 0} onClick={() => act({ type: "pass" })}>Pass</button><button type="button" className="action-button" disabled={!myTurn || busy || !draftPlacements.length} onClick={playDraft}>Strike the forge · Play</button></div></section>
    <div className="forge-note"><strong>House lexicon:</strong> the game enforces placement and scoring, but it intentionally does not ship another publisher's dictionary or word list. Players decide challenges at the table. The tile distribution, values, premium layout, branding, and artwork are original to Lexicon Forge.</div>
    {state.lastPlay?.words?.length ? <div className="forge-last-play"><strong>Last play:</strong> {state.lastPlay.words.map((entry) => `${entry.word} (${entry.score})`).join(" · ")}{state.lastPlay.bingo ? ` · Full-rack bonus +${state.lastPlay.bingo}` : ""}</div> : null}
    {state.phase === "game-over" ? <div className="forge-game-over"><h2>{winner ? `${winner.nickname} wins with ${state.scores?.[winner.uid] || 0}` : "Game over"}</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button></div> : null}
  </section></main>;
}

export default function LexiconForgeGame() {
  const controller = useModularTable({ gameId: "lexiconforge", maxPlayers: 4, minimumPlayers: 2, createGameState: createWordFoundryGame, reduceGameState: reduceWordFoundry, chooseRobotMove: chooseWordFoundryRobotMove, robotDelay: 650 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Lexicon Forge" kicker="Build words · claim premiums · empty the rack" summary="A fresh word-tile table with familiar crossword-building strategy, original tile math and premium layout, seven-tile racks, exchanges, passes, cross-word scoring, and no copied branding or dictionary content." maxPlayers={4} quickPlayChoices={[{ icon:"⚒️", label:"Practice vs forge bot", description:"Test the mechanics quickly. Word validity is still an honor-system table rule.", rules:{} }]} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Heating the forge…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Lexicon Forge" minimumPlayers={2} maxPlayers={4} startLabel="Draw the first rack" lobbyHint="Best with people: the table enforces board legality and scoring while your group owns word challenges." />;
  return <LexiconForgeTable controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "lexiconforge", name: "Lexicon Forge", players: "2–4" });
