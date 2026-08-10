import React from "react";
import StandardCard from "../../platform/StandardCard";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { chooseERSRobotMove, createERSGame, ERS_RULES, ersSlapReasons, reduceERS } from "./engine";

function ERSTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const pile = state.pile || [];
  const current = members[Number(state.currentPlayerIndex || 0)];
  const topCard = pile.at(-1) || null;
  const firstCard = pile[0] || null;
  const recentCards = pile.slice(Math.max(0, pile.length - 4), -1);
  const slapReasons = ersSlapReasons(pile);
  const winner = members.find((member) => member.uid === state.winnerUid);
  const myCards = state.hands?.[user.uid]?.length || 0;
  const eliminated = Boolean(state.out?.[user.uid]);
  const myTurn = state.phase === "playing" && current?.uid === user.uid && !state.pendingClaimUid;
  const canFlip = myTurn && myCards > 0 && !busy;
  const canSlap = state.phase === "playing" && pile.length > 0 && !eliminated && !busy;
  const claimOwner = members.find((member) => member.uid === state.pendingClaimUid);

  let turnPrompt = `${current?.nickname || "Another player"} reveals next.`;
  if (state.pendingClaimUid === user.uid) turnPrompt = "Challenge complete — take the pile, unless somebody lands a valid slap first.";
  else if (state.pendingClaimUid) turnPrompt = `${claimOwner?.nickname || "The challenger"} can take the pile; a valid slap still beats the claim.`;
  else if (myTurn && myCards > 0) turnPrompt = "Your turn — reveal the top card from your face-down stack.";
  else if (myTurn) turnPrompt = "You are out of cards. Watch the center for a valid slap to get back in.";

  return (
    <main className="modular-game-shell ers-shell"><section className="modular-game-panel ers-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Fast reaction card game</p><h1>Egyptian Rat Screw</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <PlayerChips members={members} renderDetail={(member) => state.out?.[member.uid] ? "Eliminated" : `${state.hands?.[member.uid]?.length || 0} cards`} />

      <div className="new-game-status ers-status">
        <strong>{state.message}</strong>
        <span>{state.challenge ? `Face-card challenge · ${state.challenge.chancesRemaining} chance${state.challenge.chancesRemaining === 1 ? "" : "s"} left` : `${pile.length} card${pile.length === 1 ? "" : "s"} in the center pile`}</span>
      </div>

      <div className="ers-center">
        <section className="ers-play-area" aria-label="Egyptian Rat Screw center pile">
          <div className="ers-active-zone">
            <span className="ers-zone-label">Current card</span>
            {topCard ? <div className="ers-active-card"><StandardCard card={topCard} disabled /></div> : <div className="ers-empty-pile">Reveal the first card</div>}
          </div>

          <div className="ers-memory-lane" aria-label="Recent card memory aids">
            <div className="ers-history-group">
              <span className="ers-zone-label">Previous cards</span>
              <div className="ers-recent-row">
                {recentCards.length ? recentCards.map((card) => <div key={card.id} className="ers-recent-card"><StandardCard card={card} compact disabled /></div>) : <span className="ers-history-empty">None yet</span>}
              </div>
            </div>
            <div className="ers-first-card">
              <span className="ers-zone-label">First card in this pile</span>
              {firstCard ? <StandardCard card={firstCard} compact disabled /> : <span className="ers-history-empty">—</span>}
            </div>
          </div>
        </section>

        <div className="ers-controls">
          <button type="button" className="ers-slap" disabled={!canSlap} onClick={() => act({ type: "slap" })}>{eliminated ? "OUT" : "SLAP"}</button>
          {state.pendingClaimUid === user.uid ? <button type="button" className="ers-claim" disabled={busy} onClick={() => act({ type: "claim" })}>Take challenge pile</button> : null}
          <div className="ers-turn-prompt" aria-live="polite">{turnPrompt}</div>
        </div>

        <div className="ers-patterns"><strong>What can I slap?</strong><span>Double · Sandwich · Top/Bottom · Tens · K/Q Marriage · Four in a Row</span>{slapReasons.length ? <em>Valid now: {slapReasons.join(", ")}</em> : <small>Watch the current card and the recent-card row. No cards overlap.</small>}</div>
      </div>

      {state.phase === "game-over" ? <div className="new-game-actions"><strong>{winner?.nickname || "Winner"} collected the deck.</strong><button type="button" onClick={navigateToHub}>Return to hub</button></div> : null}

      <div className="ers-my-stack">
        <span>{room.members?.[user.uid]?.avatar} <strong>{room.members?.[user.uid]?.nickname}</strong></span>
        <button type="button" className="ers-deck-action" disabled={!canFlip} onClick={() => act({ type: "flip" })} aria-label={canFlip ? "Reveal your top card" : "Your face-down card stack"}>
          <div className="standard-card card-back" aria-hidden="true"><span>◆</span></div>
          <span>{canFlip ? "Reveal top card" : myCards ? "Face-down stack" : "No cards"}</span>
        </button>
        <b>{myCards} card{myCards === 1 ? "" : "s"}</b>
      </div>
    </section></main>
  );
}

export default function ERSGame() {
  const controller = useModularTable({ gameId: "ers", maxPlayers: ERS_RULES.playersMax, minimumPlayers: ERS_RULES.playersMin, rules: { incorrectSlapPenalty: ERS_RULES.incorrectSlapPenalty }, createGameState: createERSGame, reduceGameState: reduceERS, chooseRobotMove: chooseERSRobotRobotMove, robotDelay: 620 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Egyptian Rat Screw" kicker="Flip, challenge, react" summary="Reveal from a face-down stack, survive J/Q/K/A challenges, and be the first to slap doubles, sandwiches, tens, marriages, and other valid patterns." maxPlayers={ERS_RULES.playersMax} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening ERS room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Egyptian Rat Screw" minimumPlayers={ERS_RULES.playersMin} maxPlayers={ERS_RULES.playersMax} startLabel="Deal the deck" />;
  return <ERSTable controller={controller} />;
}
