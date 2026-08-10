import React, { useMemo, useState } from "react";
import StandardCard, { sortStandardHand } from "../../platform/StandardCard";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chooseIndiansRobotMove, createIndiansGame, legalIndiansCards, reduceIndians, INDIANS_RULES } from "./engine";

function IndiansTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const hand = sortStandardHand(state.hands?.[user.uid] || []);
  const active = members[Number(state.currentPlayerIndex || 0)];
  const legalIds = useMemo(() => new Set(legalIndiansCards(state, user.uid, members).map((card) => card.id)), [state, user.uid, members]);
  const [bid, setBid] = useState(2);
  const removed = state.removedRanks?.length ? state.removedRanks.join(", ") : "None";
  const teamMembers = (team) => members.filter((_, index) => index % 2 === team);
  return (
    <main className="modular-game-shell indians-shell"><section className="modular-game-panel indians-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Progressive hand {state.roundNumber}</p><h1>Indians</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      <div className="indians-progress"><strong>{state.cardsPerPlayer} cards each</strong><span>Removed ranks: {removed}</span><div><i style={{ width: `${Math.min(100, ((13 - state.cardsPerPlayer) / 8) * 100)}%` }} /></div></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <div className="indians-scoreboard">{[0,1].map((team) => <article key={team}><span>Team {team + 1}: {teamMembers(team).map((member) => member.nickname).join(" + ")}</span><strong>{Number(state.teamScores?.[team] || 0)}</strong><small>{Number(state.teamBags?.[team] || 0)} bags · {Number(state.roundScore?.[team] || 0)} this hand</small></article>)}</div>
      <PlayerChips members={members} renderDetail={(member) => `Bid ${state.bids?.[member.uid] == null ? "—" : Number(state.bids[member.uid]) === 0 ? "NIL" : state.bids[member.uid]} · ${Number(state.playerTricks?.[member.uid] || 0)} tricks`} />
      <div className="new-game-status"><strong>{state.message}</strong><span>{state.spadesBroken ? "Spades broken" : "Spades not broken"}</span></div>
      <div className="modular-table-center indians-trick">{(state.currentTrick || []).length ? state.currentTrick.map((play) => <div key={play.uid}><small>{members.find((member) => member.uid === play.uid)?.nickname}</small><StandardCard card={play.card} compact disabled /></div>) : <p className="new-game-empty">{state.phase === "bidding" ? `${active?.nickname} is bidding` : `${active?.nickname || "Next player"} leads the next trick.`}</p>}</div>
      {state.phase === "bidding" && active?.uid === user.uid ? <div className="indians-action-box"><label>Your bid<select value={Math.min(bid, state.cardsPerPlayer)} onChange={(event) => setBid(Number(event.target.value))}>{Array.from({ length: Number(state.cardsPerPlayer || 0) + 1 }, (_, value) => <option key={value} value={value}>{value === 0 ? "Nil" : value}</option>)}</select></label><button type="button" className="action-button" disabled={busy} onClick={() => act({ type: "bid", bid: Math.min(bid, state.cardsPerPlayer) })}>Submit bid</button></div> : null}
      {state.phase === "round-end" ? <div className="indians-action-box"><h2>{state.roundNumber >= 9 ? "Sudden death if tied" : "The deck shrinks again"}</h2><p>{state.roundNumber < 9 ? `Next hand removes all ${state.roundNumber + 1}s.` : "The deck stays at five cards per player until the tie breaks."}</p><button type="button" className="action-button" disabled={busy} onClick={() => act({ type: "next-round" })}>Deal next hand</button></div> : null}
      {state.phase === "game-over" ? <div className="indians-action-box"><h2>Team {Number(state.winnerTeam) + 1} wins.</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to hub</button></div> : null}
      <div className="player-hand-heading"><span>{room.members?.[user.uid]?.avatar} <strong>{room.members?.[user.uid]?.nickname}</strong></span><span>{hand.length} cards</span></div>
      <div className="modular-hand">{hand.map((card) => <StandardCard key={card.id} card={card} disabled={busy || !legalIds.has(card.id)} onClick={() => act({ type: "play", cardId: card.id })} />)}</div>
    </section></main>
  );
}

export default function IndiansGame() {
  const controller = useModularTable({ gameId: "indians", maxPlayers: 4, minimumPlayers: 4, rules: {}, createGameState: createIndiansGame, reduceGameState: reduceIndians, chooseRobotMove: chooseIndiansRobotMove, robotDelay: 650 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Indians" kicker="Progressive Spades" summary="Start with a full Spades deck. Each hand removes another complete low rank until every player has only five increasingly dangerous cards." maxPlayers={4} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Indians room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Indians" minimumPlayers={4} maxPlayers={4} startLabel="Deal first hand" />;
  return <IndiansTable controller={controller} />;
}
