import React from "react";
import StandardCard from "../../platform/StandardCard";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chooseSpoonsRobotMove, createSpoonsGame, reduceSpoons, SPOONS_RULES } from "./engine";

const WORD = "SPOON";

function SpoonsTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const myHand = state.hands?.[user.uid] || [];
  const currentUid = state.flowOrder?.[Number(state.passPosition || 0)];
  const myTurn = state.phase === "passing" && currentUid === user.uid;
  const five = myTurn && state.incomingCard ? [...myHand, state.incomingCard] : myHand;
  const winner = members.find((member) => member.uid === state.winnerUid);
  return (
    <main className="modular-game-shell spoons-shell"><section className="modular-game-panel spoons-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Round {state.roundNumber}</p><h1>Spoons</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <PlayerChips members={members} renderDetail={(member) => state.eliminated?.[member.uid] ? "Out" : `${WORD.slice(0, Number(state.letters?.[member.uid] || 0)) || "No letters"}${state.grabbed?.[member.uid] ? " · 🥄" : ""}`} />
      <div className="new-game-status"><strong>{state.message}</strong><span>{state.phase === "passing" ? `${state.drawPile?.length || 0} cards in draw pile` : `${state.spoonsRemaining || 0} spoons left`}</span></div>
      <div className={`spoons-center ${state.phase === "grabbing" ? "scramble" : ""}`}>
        <div className="spoon-row" aria-label={`${state.spoonsRemaining || 0} spoons available`}>{Array.from({ length: Math.max(0, Number(state.spoonsRemaining || 0)) }, (_, index) => <span key={index}>🥄</span>)}</div>
        {state.phase === "passing" ? <p>Keep four cards. Pass one card left. Make four of a kind.</p> : null}
        {state.phase === "grabbing" ? <button type="button" className="spoon-grab" disabled={busy || state.grabbed?.[user.uid] || state.eliminated?.[user.uid]} onClick={() => act({ type: "grab" })}>GRAB A SPOON</button> : null}
        {state.phase === "round-end" ? <div className="new-game-actions"><button type="button" disabled={busy} onClick={() => act({ type: "next-round" })}>Deal next round</button></div> : null}
        {state.phase === "game-over" ? <div><h2>{winner?.nickname || "Winner"} wins!</h2><div className="new-game-actions"><button type="button" onClick={navigateToHub}>Return to hub</button></div></div> : null}
      </div>
      <div className="player-hand-heading"><span>{room.members?.[user.uid]?.avatar} <strong>{room.members?.[user.uid]?.nickname}</strong></span><span>{myTurn ? "Choose one card to pass" : `${myHand.length} cards`}</span></div>
      <div className="modular-hand spoons-hand">{five.map((card) => <StandardCard key={card.id} card={card} disabled={busy || !myTurn} onClick={() => act({ type: "pass", cardId: card.id })} />)}</div>
      {myTurn ? <p className="spoons-instruction">The arriving card is mixed with your four cards above. Tap the one card you want to send to the next player.</p> : null}
    </section></main>
  );
}

export default function SpoonsGame() {
  const controller = useModularTable({ gameId: "spoons", maxPlayers: SPOONS_RULES.playersMax, minimumPlayers: SPOONS_RULES.playersMin, rules: { lettersToLose: SPOONS_RULES.lettersToLose }, createGameState: createSpoonsGame, reduceGameState: reduceSpoons, chooseRobotMove: chooseSpoonsRobotMove, robotDelay: 520 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Spoons" kicker="Fast family scramble" summary="Make four of a kind, then grab a spoon before somebody else does. Miss five times and you spell SPOON." maxPlayers={SPOONS_RULES.playersMax} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Spoons room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Spoons" minimumPlayers={SPOONS_RULES.playersMin} maxPlayers={SPOONS_RULES.playersMax} startLabel="Deal Spoons" />;
  return <SpoonsTable controller={controller} />;
}
