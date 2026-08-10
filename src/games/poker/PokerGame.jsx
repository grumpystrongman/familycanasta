import React, { useEffect, useMemo, useState } from "react";
import StandardCard from "../../platform/StandardCard";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { choosePokerRobotMove, createPokerGame, evaluatePokerHand, POKER_RULES, reducePoker } from "./engine";

const RANKING = ["Straight flush", "Four of a kind", "Full house", "Flush", "Straight", "Three of a kind", "Two pair", "One pair", "High card"];

function PokerTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const hand = state.hands?.[user.uid] || [];
  const active = members[Number(state.currentPlayerIndex || 0)];
  const [selected, setSelected] = useState([]);
  const myTurn = active?.uid === user.uid;
  const owed = Math.max(0, Number(state.currentBet || 0) - Number(state.bettingContrib?.[user.uid] || 0));
  const myEval = useMemo(() => hand.length === 5 ? evaluatePokerHand(hand) : null, [hand]);

  useEffect(() => setSelected([]), [state.phase, state.roundNumber]);
  function toggle(cardId) {
    if (state.phase !== "drawing" || !myTurn) return;
    setSelected((current) => current.includes(cardId) ? current.filter((id) => id !== cardId) : current.length < POKER_RULES.maxDraw ? [...current, cardId] : current);
  }

  return (
    <main className="modular-game-shell poker-shell"><section className="modular-game-panel poker-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Hand {state.roundNumber} · game points only</p><h1>Family Five-Card Draw</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <div className="poker-pot"><span>Pot</span><strong>★ {Number(state.pot || 0)}</strong><small>Fixed-limit family points — no money</small></div>
      <PlayerChips members={members} renderDetail={(member) => `${state.inHand?.[member.uid] ? state.folded?.[member.uid] ? "Folded · " : "" : "Sitting out · "}★ ${Number(state.balances?.[member.uid] || 0)}${state.drawn?.[member.uid] != null ? ` · drew ${state.drawn[member.uid]}` : ""}`} />
      <div className="new-game-status"><strong>{state.message}</strong><span>{["betting-1","betting-2"].includes(state.phase) ? `Current bet ★ ${state.currentBet || 0}` : state.phase === "drawing" ? "Draw up to 3" : ""}</span></div>

      <div className="poker-center">
        {state.phase === "round-end" && state.revealed ? <div className="poker-showdown">{members.filter((member) => state.inHand?.[member.uid] && !state.folded?.[member.uid]).map((member) => <article key={member.uid}><strong>{member.avatar} {member.nickname}</strong><div>{(state.hands?.[member.uid] || []).map((card) => <StandardCard key={card.id} card={card} compact disabled />)}</div><small>{evaluatePokerHand(state.hands?.[member.uid] || []).name}</small></article>)}</div> : <div className="poker-ranking"><strong>Hand ranking</strong><span>{RANKING.join(" › ")}</span></div>}
      </div>

      {["betting-1","betting-2"].includes(state.phase) && myTurn && !state.folded?.[user.uid] ? <div className="new-game-actions poker-actions"><button type="button" className="danger" disabled={busy} onClick={() => act({ type: "bet", move: "fold" })}>Fold</button><button type="button" disabled={busy} onClick={() => act({ type: "bet", move: "call" })}>{owed > 0 ? `Call ★ ${owed}` : "Check"}</button><button type="button" disabled={busy || Number(state.raises || 0) >= Number(state.maxRaises || POKER_RULES.maxRaises)} onClick={() => act({ type: "bet", move: "raise" })}>Raise</button></div> : null}

      {state.phase === "drawing" && myTurn && !state.folded?.[user.uid] ? <div className="poker-draw-box"><strong>Select 0–3 cards to replace.</strong><span>{selected.length} selected</span><button type="button" className="action-button" disabled={busy} onClick={() => act({ type: "draw", cardIds: selected })}>{selected.length ? `Replace ${selected.length}` : "Stand pat"}</button></div> : null}
      {state.phase === "round-end" ? <div className="new-game-actions"><button type="button" disabled={busy} onClick={() => act({ type: "next-round" })}>Deal next hand</button></div> : null}
      {state.phase === "game-over" ? <div className="new-game-actions"><button type="button" onClick={navigateToHub}>Return to hub</button></div> : null}

      <div className="player-hand-heading"><span>{room.members?.[user.uid]?.avatar} <strong>{room.members?.[user.uid]?.nickname}</strong>{myEval ? <small> · {myEval.name}</small> : null}</span><span>{state.folded?.[user.uid] ? "Folded" : state.phase === "drawing" && myTurn ? "Tap cards to replace" : "Your private hand"}</span></div>
      <div className="modular-hand poker-hand">{hand.map((card) => <StandardCard key={card.id} card={card} selected={selected.includes(card.id)} disabled={busy || state.phase !== "drawing" || !myTurn || state.folded?.[user.uid]} onClick={() => toggle(card.id)} />)}</div>
    </section></main>
  );
}

export default function PokerGame() {
  const controller = useModularTable({ gameId: "poker", maxPlayers: POKER_RULES.playersMax, minimumPlayers: POKER_RULES.playersMin, rules: { startingPoints: POKER_RULES.startingPoints, ante: POKER_RULES.ante, maxRaises: POKER_RULES.maxRaises }, createGameState: createPokerGame, reduceGameState: reducePoker, chooseRobotMove: choosePokerRobotMove, robotDelay: 700 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Five-Card Draw" kicker="Poker without the casino" summary="A family-friendly points version of classic Five-Card Draw: bet, replace up to three cards, bluff a little, and compare standard poker hands." maxPlayers={POKER_RULES.playersMax} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Poker room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Five-Card Draw" minimumPlayers={POKER_RULES.playersMin} maxPlayers={POKER_RULES.playersMax} startLabel="Deal Poker" />;
  return <PokerTable controller={controller} />;
}
