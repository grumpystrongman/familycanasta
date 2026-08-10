import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StandardCard from "../../platform/StandardCard";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby } from "../../platform/ModularGameChrome";
import { applyModularAction } from "../../platform/modularRoomService";
import { navigateToHub } from "../../HubApp";
import { chooseERSRobotMove, createERSGame, ERS_RULES, reduceERS } from "./engine";

function playerDetail(state, member, currentUid) {
  const count = state.hands?.[member.uid]?.length || 0;
  if (state.out?.[member.uid]) return "Out";
  if (count === 0) return "No cards · can slap back in";
  if (!state.pendingClaimUid && currentUid === member.uid) return `Flipping · ${count} cards`;
  return `${count} cards`;
}

function ERSTable({ controller }) {
  const { room, roomCode, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const current = members[Number(state.currentPlayerIndex || 0)];
  const winner = members.find((member) => member.uid === state.winnerUid);
  const pile = state.pile || [];
  const burnPile = state.burnPile || [];
  const centerCardCount = pile.length + burnPile.length;
  const topCard = pile.at(-1);
  const recentCards = pile.slice(-4, -1);
  const myCards = state.hands?.[user.uid]?.length || 0;
  const permanentlyOut = Boolean(state.out?.[user.uid]);
  const watchingWithoutCards = myCards === 0 && !permanentlyOut;
  const myTurn = state.phase === "playing" && !state.pendingClaimUid && current?.uid === user.uid && myCards > 0 && !permanentlyOut;
  const canSlap = state.phase === "playing" && Boolean(topCard) && !permanentlyOut;
  const pendingOwner = members.find((member) => member.uid === state.pendingClaimUid);
  const challengeLimit = Number(state.challenge?.limit || state.challenge?.chancesRemaining || 0);
  const challengeRemaining = Number(state.challenge?.chancesRemaining || 0);
  const [slapBusy, setSlapBusy] = useState(false);
  const [reactionMessage, setReactionMessage] = useState("");
  const slapLock = useRef(false);
  const robotMoveKey = useRef("");

  const fastSlap = useCallback(async () => {
    const observedTopCardId = state.pile?.at(-1)?.id;
    if (!roomCode || !user?.uid || !observedTopCardId || state.phase !== "playing" || state.out?.[user.uid] || slapLock.current) return;

    slapLock.current = true;
    setSlapBusy(true);
    setReactionMessage("");
    try {
      await applyModularAction(roomCode, user.uid, { type: "slap", observedTopCardId }, reduceERS);
    } catch (event) {
      const message = String(event?.message || "That slap was not accepted.");
      if (/pile changed|no center pile|not accepted/i.test(message)) {
        setReactionMessage("Someone else got there first — no penalty.");
      } else {
        setReactionMessage(message);
      }
    } finally {
      slapLock.current = false;
      setSlapBusy(false);
    }
  }, [roomCode, state.phase, state.pile, state.out, user?.uid]);

  const flipCard = useCallback(() => {
    if (!myTurn || busy) return;
    act({ type: "flip" });
  }, [act, busy, myTurn]);

  useEffect(() => {
    if (!reactionMessage) return undefined;
    const timer = window.setTimeout(() => setReactionMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [reactionMessage]);

  // Only the host client drives robots in ERS. That prevents several online clients
  // from racing to submit the same robot action at the same time.
  useEffect(() => {
    if (room.hostUid !== user?.uid || room.status !== "playing") {
      robotMoveKey.current = "";
      return undefined;
    }
    const move = chooseERSRobotMove(state, members);
    if (!move?.uid || !move?.action) {
      robotMoveKey.current = "";
      return undefined;
    }
    const key = move.key || `${move.uid}:${move.action.type}:${topCard?.id || centerCardCount}`;
    if (robotMoveKey.current === key) return undefined;
    robotMoveKey.current = key;
    const timer = window.setTimeout(() => {
      applyModularAction(roomCode, move.uid, move.action, reduceERS).catch(() => {
        robotMoveKey.current = "";
      });
    }, Number(move.delayMs || 900));
    return () => window.clearTimeout(timer);
  }, [centerCardCount, members, room.hostUid, room.status, roomCode, state, topCard?.id, user?.uid]);

  useEffect(() => {
    if (!state.pendingClaimUid || !topCard?.id || !roomCode || !user?.uid || state.phase !== "playing") return undefined;
    const observedTopCardId = topCard.id;
    const timer = window.setTimeout(() => {
      applyModularAction(roomCode, user.uid, { type: "settle", observedTopCardId }, reduceERS).catch(() => {});
    }, ERS_RULES.onlineAwardDelayMs);
    return () => window.clearTimeout(timer);
  }, [roomCode, state.pendingClaimUid, state.phase, topCard?.id, user?.uid]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.repeat) return;
      const tag = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tag)) return;
      if (event.code === "Space") {
        if (!canSlap || slapBusy) return;
        event.preventDefault();
        fastSlap();
        return;
      }
      if ((event.key === "f" || event.key === "F" || event.key === "Enter") && myTurn && !busy) {
        event.preventDefault();
        flipCard();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, canSlap, fastSlap, flipCard, myTurn, slapBusy]);

  const instruction = useMemo(() => {
    if (state.phase === "game-over") return "Game complete.";
    if (permanentlyOut) return "You are out after an empty-stack false slap. You can watch the rest of the game.";
    if (watchingWithoutCards) return "You have no cards, but you are still alive. Watch the pile and land a valid slap to jump back in.";
    if (state.pendingClaimUid) return `${pendingOwner?.nickname || "The challenger"} is about to collect. A valid slap can still steal the pile during this short online reaction window.`;
    if (state.challenge && myTurn) return `Face-card challenge: you have ${challengeRemaining} chance${challengeRemaining === 1 ? "" : "s"} left to reveal J, Q, K, or A.`;
    if (state.challenge) return `${current?.nickname || "The next player"} is answering the face-card challenge. Keep watching — anyone can slap.`;
    if (myTurn) return "Your turn: flip one card, then keep your eyes on the center pile.";
    return `${current?.nickname || "The next player"} flips next. You can slap at any time when you spot a legal pattern.`;
  }, [challengeRemaining, current?.nickname, myTurn, pendingOwner?.nickname, permanentlyOut, state.challenge, state.pendingClaimUid, state.phase, watchingWithoutCards]);

  const phaseLabel = state.phase === "game-over"
    ? "Game over"
    : state.pendingClaimUid
      ? "Reaction window"
      : state.challenge
        ? `${state.challenge.faceRank || "Face-card"} challenge`
        : myTurn
          ? "Your turn"
          : "Watch the pile";

  const flipLabel = myTurn ? "FLIP CARD" : current?.uid === user.uid && myCards === 0 ? "NO CARDS TO FLIP" : `WAIT FOR ${current?.nickname || "PLAYER"}`;

  return (
    <main className="modular-game-shell ers-shell">
      <section className="modular-game-panel ers-table">
        <div className="modular-game-toolbar ers-toolbar">
          <div>
            <p className="game-kicker">Online reaction card game · first to all 52 cards</p>
            <h1>Egyptian Rat Screw</h1>
          </div>
          <button type="button" className="secondary" onClick={navigateToHub}>All games</button>
        </div>

        {error ? <p className="modular-error">{error}</p> : null}
        {reactionMessage ? <p className="ers-reaction-note" role="status">{reactionMessage}</p> : null}

        <div className="ers-player-rail" aria-label="Players">
          {members.map((member) => {
            const isCurrent = !state.pendingClaimUid && current?.uid === member.uid && state.phase === "playing";
            const isMe = member.uid === user.uid;
            const isOut = Boolean(state.out?.[member.uid]);
            return (
              <article key={member.uid} className={`${isCurrent ? "is-current" : ""} ${isMe ? "is-me" : ""} ${isOut ? "is-out" : ""}`}>
                <span className="ers-player-avatar">{member.avatar}</span>
                <div>
                  <strong>{member.nickname}{member.isRobot ? " · BOT" : ""}</strong>
                  <small>{playerDetail(state, member, current?.uid)}</small>
                </div>
              </article>
            );
          })}
        </div>

        <section className="ers-status-board" aria-live="polite">
          <span className="ers-phase-pill">{phaseLabel}</span>
          <strong>{state.message}</strong>
          <p>{instruction}</p>
          {state.challenge ? (
            <div className="ers-challenge-meter" aria-label={`${challengeRemaining} challenge chances remaining`}>
              <span>{state.challenge.faceRank || "Face"} challenge</span>
              <div>
                {Array.from({ length: Math.max(1, challengeLimit) }, (_, index) => (
                  <i key={index} className={index < challengeRemaining ? "remaining" : "spent"} />
                ))}
              </div>
              <b>{challengeRemaining} left</b>
            </div>
          ) : null}
        </section>

        <section className="ers-arena">
          <div className="ers-history-panel">
            <span>Recent cards</span>
            <div className="ers-history-cards">
              {recentCards.length ? recentCards.map((card) => <StandardCard key={card.id} card={card} compact disabled />) : <small>Cards you need for doubles and sandwiches will stay visible here.</small>}
            </div>
          </div>

          <div className="ers-pile-stage">
            <span className="ers-pile-count">{centerCardCount} {centerCardCount === 1 ? "card" : "cards"} in center{burnPile.length ? ` · ${burnPile.length} burned underneath` : ""}</span>
            <div className={`ers-focus-card ${canSlap ? "can-slap" : ""}`}>
              {topCard ? (
                <StandardCard card={topCard} disabled={!canSlap || slapBusy} onClick={fastSlap} />
              ) : (
                <div className="ers-empty-pile"><span>Center pile</span><small>The first flip appears here.</small></div>
              )}
            </div>
            <strong>{topCard ? "Tap the card or SLAP when you see a pattern" : "Waiting for the first card"}</strong>
          </div>

          <aside className="ers-my-deck">
            <span>Your deck</span>
            <button type="button" className={`ers-deck-button ${myTurn ? "ready" : ""}`} onClick={flipCard} disabled={!myTurn || busy} aria-label={`Your face-down deck, ${myCards} cards`}>
              <span className="standard-card card-back"><span>◆</span></span>
            </button>
            <strong>{myCards} cards</strong>
            <small>{watchingWithoutCards ? "Watch for a slap-back chance" : myTurn ? "Click your deck to flip" : "Keep watching the pile"}</small>
          </aside>
        </section>

        <div className="ers-action-dock" aria-label="Game actions">
          <button type="button" className="ers-flip" disabled={!myTurn || busy} onClick={flipCard}>
            <span>{flipLabel}</span>
            <small>F / Enter</small>
          </button>
          <button type="button" className="ers-slap" disabled={!canSlap || slapBusy} onClick={fastSlap}>
            <span>{slapBusy ? "SLAPPING…" : "SLAP!"}</span>
            <small>Space bar · works off-turn</small>
          </button>
        </div>

        <details className="ers-quick-guide">
          <summary>Quick slap guide</summary>
          <div>
            <span><b>Double</b> same rank twice</span>
            <span><b>Sandwich</b> same rank with one between</span>
            <span><b>Tens</b> two number values total 10 (Ace = 1)</span>
            <span><b>Marriage</b> King + Queen</span>
            <span><b>Top/Bottom</b> newest rank matches the pile's first card</span>
            <span><b>Four in a row</b> four consecutive ranks up or down</span>
          </div>
          <p>The table never tells you when a slap is currently valid. Spotting it is the game.</p>
        </details>

        {state.phase === "game-over" ? (
          <div className="ers-game-over">
            <strong>{winner?.nickname || "Winner"} collected the deck.</strong>
            <button type="button" className="action-button" onClick={navigateToHub}>Return to hub</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default function ERSGame() {
  const controller = useModularTable({
    gameId: "ers",
    maxPlayers: ERS_RULES.playersMax,
    minimumPlayers: ERS_RULES.playersMin,
    rules: { incorrectSlapPenalty: ERS_RULES.incorrectSlapPenalty },
    createGameState: createERSGame,
    reduceGameState: reduceERS,
  });

  if (!controller.roomCode) {
    return (
      <GameHome
        controller={controller}
        title="Egyptian Rat Screw"
        kicker="Flip, challenge, react"
        summary="A real-time online table: flip from your face-down stack, answer J/Q/K/A challenges, and race every player to slap doubles, sandwiches, tens, marriages, and other legal patterns."
        maxPlayers={ERS_RULES.playersMax}
      />
    );
  }
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening ERS room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Egyptian Rat Screw" minimumPlayers={ERS_RULES.playersMin} maxPlayers={ERS_RULES.playersMax} startLabel="Deal the deck" />;
  return <ERSTable controller={controller} />;
}
