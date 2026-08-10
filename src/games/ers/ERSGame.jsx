import React from "react";
import StandardCard from "../../platform/StandardCard";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chooseERSRobotMove, createERSGame, ERS_RULES, ersSlapReasons, reduceERS } from "./engine";

function ERSTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const current = members[Number(state.currentPlayerIndex || 0)];
  const topCards = (state.pile || []).slice(-3);
  const slapReasons = ersSlapReasons(state.pile || []);
  const winner = members.find((member) => member.uid === state.winnerUid);
  const myTurn = state.phase === "playing" && current?.uid === user.uid && !state.pendingClaimUid;
  return (
    <main className="modular-game-shell ers-shell"><section className="modular-game-panel ers-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Fast reaction card game</p><h1>Egyptian Rat Screw</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <PlayerChips members={members} renderDetail={(member) => state.out?.[member.uid] ? "Out — valid slap can return" : `${state.hands?.[member.uid]?.length || 0} cards`} />
      <div className="new-game-status"><strong>{state.message}</strong><span>{state.challenge ? `Challenge: ${state.challenge.chancesRemaining} left` : `${state.pile?.length || 0} cards in center`}</span></div>
      <div className="ers-center">
        <div className="ers-pile" aria-label="Center pile">{topCards.length ? topCards.map((card, index) => <div key={card.id} className={`ers-pile-card ers-depth-${topCards.length - index}`}><StandardCard card={card} disabled /></div>) : <div className="ers-empty-pile">Center pile</div>}</div>
        <div className="ers-controls">
          <button type="button" className="ers-slap" disabled={busy || state.phase === "game-over"} onClick={() => act({ type: "slap" })}>SLAP</button>
          {myTurn ? <button type="button" className="ers-flip" disabled={busy || !(state.hands?.[user.uid]?.length)} onClick={() => act({ type: "flip" })}>Flip next card</button> : null}
          {state.pendingClaimUid === user.uid ? <button type="button" className="ers-claim" disabled={busy} onClick={() => act({ type: "claim" })}>Claim pile</button> : null}
        </div>
        <div className="ers-patterns"><strong>Slap patterns</strong><span>Double · Sandwich · Top/Bottom · Tens · K/Q Marriage · Four in a Row</span>{slapReasons.length ? <em>Valid now: {slapReasons.join(", ")}</em> : null}</div>
      </div>
      {state.phase === "game-over" ? <div className="new-game-actions"><strong>{winner?.nickname || "Winner"} collected the deck.</strong><button type="button" onClick={navigateToHub}>Return to hub</button></div> : null}
      <div className="ers-my-stack"><span>{room.members?.[user.uid]?.avatar} <strong>{room.members?.[user.uid]?.nickname}</strong></span><div className="standard-card card-back compact" aria-label="Your face-down stack"><span>◆</span></div><b>{state.hands?.[user.uid]?.length || 0} cards</b></div>
    </section></main>
  );
}

export default function ERSGame() {
  const controller = useModularTable({ gameId: "ers", maxPlayers: ERS_RULES.playersMax, minimumPlayers: ERS_RULES.playersMin, rules: { incorrectSlapPenalty: ERS_RULES.incorrectSlapPenalty }, createGameState: createERSGame, reduceGameState: reduceERS, chooseRobotMove: chooseERSRobotMove, robotDelay: 620 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Egyptian Rat Screw" kicker="Flip, challenge, react" summary="Flip from a face-down stack, survive J/Q/K/A challenges, and be the first to slap doubles, sandwiches, tens, marriages, and other valid patterns." maxPlayers={ERS_RULES.playersMax} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening ERS room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Egyptian Rat Screw" minimumPlayers={ERS_RULES.playersMin} maxPlayers={ERS_RULES.playersMax} startLabel="Deal the deck" />;
  return <ERSTable controller={controller} />;
}
