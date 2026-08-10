import React, { useEffect, useMemo, useState } from "react";
import StandardCard from "../../platform/StandardCard";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chooseGolfRobotMove, createGolfGame, GOLF_RULES, reduceGolf, scoreGolfGrid } from "./engine";

function HiddenGridCard({ selected = false, disabled = false, onClick }) {
  return <button type="button" className={`golf-hidden-card ${selected ? "selected" : ""}`} disabled={disabled} onClick={onClick} aria-label="Face-down golf card"><span>◆</span></button>;
}

function GolfGrid({ state, uid, interactive, onSwap, revealSelected, toggleReveal }) {
  const grid = state.grids?.[uid] || [];
  const faceUp = new Set(state.faceUp?.[uid] || []);
  return <div className="golf-grid">{grid.map((card, index) => {
    const visible = faceUp.has(index) || state.phase === "hole-end" || state.phase === "game-over";
    if (!visible) return <HiddenGridCard key={card.id} selected={revealSelected?.includes(index)} disabled={!interactive} onClick={() => toggleReveal ? toggleReveal(index) : onSwap?.(index)} />;
    return <StandardCard key={card.id} card={card} disabled={!interactive || Boolean(toggleReveal)} onClick={() => onSwap?.(index)} />;
  })}</div>;
}

function GolfTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const [revealSelected, setRevealSelected] = useState([]);
  const active = members[Number(state.currentPlayerIndex || 0)];
  const myTurn = state.phase === "playing" && active?.uid === user.uid;
  const myInitialDone = (state.faceUp?.[user.uid] || []).length === 2;
  const topDiscard = state.discardPile?.at(-1);
  const winner = members.find((member) => member.uid === state.winnerUid);
  const visibleMyScore = useMemo(() => state.phase === "hole-end" || state.phase === "game-over" ? scoreGolfGrid(state.grids?.[user.uid] || []) : null, [state, user.uid]);
  useEffect(() => setRevealSelected([]), [state.holeNumber]);
  function toggleReveal(index) { setRevealSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : current.length < 2 ? [...current, index] : current); }

  return (
    <main className="modular-game-shell golf-shell"><section className="modular-game-panel golf-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Hole {state.holeNumber} of {state.holes}</p><h1>Six Card Golf</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <PlayerChips members={members} renderDetail={(member) => `Total ${Number(state.totals?.[member.uid] || 0)}${state.holeScores?.[member.uid] != null ? ` · hole ${state.holeScores[member.uid]}` : ""}`} />
      <div className="new-game-status"><strong>{state.message}</strong><span>Lowest score wins</span></div>

      <div className="golf-center">
        <div className="golf-piles">
          <button type="button" className="golf-stock" disabled={busy || !myTurn || Boolean(state.drawnCard)} onClick={() => act({ type: "draw", source: "stock" })}><span>◆</span><small>Stock · {state.stock?.length || 0}</small></button>
          <button type="button" className="golf-discard" disabled={busy || !myTurn || Boolean(state.drawnCard) || !topDiscard} onClick={() => act({ type: "draw", source: "discard" })}>{topDiscard ? <StandardCard card={topDiscard} compact disabled /> : null}<small>Discard</small></button>
        </div>
        {state.drawnCard ? <div className="golf-drawn"><small>You drew</small><StandardCard card={state.drawnCard} disabled /><strong>Choose a grid card to replace, or discard the draw.</strong><button type="button" disabled={busy} onClick={() => act({ type: "discard-drawn" })}>Discard this card</button></div> : <p className="new-game-empty">Draw from the stock or visible discard, then decide whether it improves your six-card grid.</p>}
      </div>

      {state.phase === "reveal" && !myInitialDone ? <div className="golf-reveal-box"><strong>Choose exactly two starting cards to turn face up.</strong><button type="button" className="action-button" disabled={busy || revealSelected.length !== 2} onClick={() => act({ type: "reveal", indexes: revealSelected })}>Reveal selected cards</button></div> : null}
      {state.phase === "hole-end" ? <div className="golf-reveal-box"><strong>Your hole score: {visibleMyScore}</strong><button type="button" className="action-button" disabled={busy} onClick={() => act({ type: "next-hole" })}>Deal hole {Number(state.holeNumber) + 1}</button></div> : null}
      {state.phase === "game-over" ? <div className="golf-reveal-box"><h2>{winner?.nickname || "Winner"} wins the nine-hole game.</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to hub</button></div> : null}

      <div className="player-hand-heading"><span>{room.members?.[user.uid]?.avatar} <strong>{room.members?.[user.uid]?.nickname}</strong></span><span>{state.phase === "reveal" && !myInitialDone ? `${revealSelected.length}/2 selected` : myTurn && state.drawnCard ? "Tap a grid card to swap" : "Your six-card grid"}</span></div>
      <GolfGrid state={state} uid={user.uid} interactive={(state.phase === "reveal" && !myInitialDone) || (myTurn && Boolean(state.drawnCard))} onSwap={(index) => act({ type: "swap", index })} revealSelected={revealSelected} toggleReveal={state.phase === "reveal" && !myInitialDone ? toggleReveal : null} />
    </section></main>
  );
}

export default function GolfGame() {
  const controller = useModularTable({ gameId: "golf", maxPlayers: GOLF_RULES.playersMax, minimumPlayers: GOLF_RULES.playersMin, rules: { holes: GOLF_RULES.holes }, createGameState: createGolfGame, reduceGameState: reduceGolf, chooseRobotMove: chooseGolfRobotMove, robotDelay: 650 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Six Card Golf" kicker="Low score wins" summary="Build a six-card grid, pair matching columns to zero them out, and finish nine holes with the lowest total score." maxPlayers={GOLF_RULES.playersMax} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Golf room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Six Card Golf" minimumPlayers={GOLF_RULES.playersMin} maxPlayers={GOLF_RULES.playersMax} startLabel="Deal hole one" />;
  return <GolfTable controller={controller} />;
}
