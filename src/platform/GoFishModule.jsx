import React, { useEffect, useMemo, useState } from "react";
import StandardCard, { RANKS, sortStandardHand } from "./StandardCard";
import useModularTable from "./useModularTable";
import { GameHome, GameLobby } from "./ModularGameChrome";
import { navigateToHub } from "../HubApp";
import { chooseGoFishRobotMove, createGoFishGame, GO_FISH_RULES, reduceGoFish } from "./goFishCore";

function titleCaseRank(rank) {
  const words = { J: "Jacks", Q: "Queens", K: "Kings", A: "Aces" };
  return words[rank] || `${rank}s`;
}

function formatRank(theme, rank) {
  return theme.rankLabels?.[rank] || titleCaseRank(rank);
}

function AdultGate({ title, onEnter }) {
  return (
    <main className="modular-game-shell fish-adult-shell">
      <section className="modular-game-panel fish-adult-gate">
        <p className="game-kicker">18+ table · adults only</p>
        <h1>{title}</h1>
        <p>This game contains profanity, raunchy jokes, sexual innuendo, terrible dating choices, and aggressively immature humor.</p>
        <p><strong>No explicit sexual imagery is part of the game.</strong> The point is to make your friends laugh and regret inviting you.</p>
        <div className="modular-lobby-actions">
          <button type="button" className="action-button" onClick={onEnter}>I’m 18+ · deal the bad decisions</button>
          <button type="button" className="action-button secondary" onClick={navigateToHub}>Nope · back to the respectable games</button>
        </div>
      </section>
    </main>
  );
}

function actionText(state, members, theme) {
  const action = state.lastAction;
  if (!action) return theme.openingLine || "Ask another player for a rank you already hold.";
  const actor = members.find((member) => member.uid === action.uid)?.nickname || "Someone";
  const target = members.find((member) => member.uid === action.targetUid)?.nickname || "someone";
  const label = formatRank(theme, action.rank);
  if (theme.adult) {
    if (action.result === "hit") {
      const book = action.completedBooks?.length ? ` Then ${actor} completed a filthy little book of ${formatRank(theme, action.completedBooks[0])}.` : "";
      return `${actor} asked ${target} for ${label}. Jackpot: ${action.count} card${action.count === 1 ? "" : "s"} changed hands.${book}`;
    }
    const draw = action.drewRank ? `${actor} drew from the pile of bad decisions.` : "The pond was bone dry.";
    return `${actor} asked ${target} for ${label}. ${target}: “Go F' Yourself.” ${draw}`;
  }
  if (action.result === "hit") {
    const book = action.completedBooks?.length ? ` ${actor} also completed a book of ${formatRank(theme, action.completedBooks[0])}.` : "";
    return `${actor} asked ${target} for ${label} and received ${action.count}.${book}`;
  }
  return action.drewRank
    ? `${actor} asked ${target} for ${label}. Go fish — a card was drawn.`
    : `${actor} asked ${target} for ${label}. No match, and the pond is empty.`;
}

function FishTable({ controller, theme }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const current = members[Number(state.currentPlayerIndex || 0)];
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const hand = sortStandardHand(state.hands?.[user?.uid] || []);
  const ranksInHand = useMemo(() => RANKS.filter((rank) => hand.some((card) => card.rank === rank)), [hand]);
  const targets = members.filter((member) => member.uid !== user?.uid && (state.hands?.[member.uid]?.length || 0) > 0);
  const [rank, setRank] = useState("");
  const [targetUid, setTargetUid] = useState("");

  useEffect(() => {
    if (!ranksInHand.includes(rank)) setRank(ranksInHand[0] || "");
  }, [rank, ranksInHand]);

  useEffect(() => {
    if (!targets.some((target) => target.uid === targetUid)) setTargetUid(targets[0]?.uid || "");
  }, [targetUid, targets]);

  const winners = (state.winnerUids || []).map((uid) => members.find((member) => member.uid === uid)?.nickname).filter(Boolean);
  const publicAction = actionText(state, members, theme);

  return (
    <main className={`modular-game-shell fish-shell ${theme.adult ? "fish-after-dark" : ""}`}>
      <section className="modular-game-panel fish-table">
        <div className="modular-game-toolbar">
          <div><p className="game-kicker">{theme.tableKicker}</p><h1>{theme.title}</h1></div>
          <button type="button" className="secondary" onClick={navigateToHub}>All games</button>
        </div>
        {error ? <p className="modular-error">{error}</p> : null}

        <div className="fish-player-grid" aria-label="Players and books">
          {members.map((member) => {
            const isCurrent = current?.uid === member.uid && state.phase === "playing";
            const isMe = member.uid === user?.uid;
            const books = state.books?.[member.uid] || [];
            return (
              <article key={member.uid} className={`${isCurrent ? "current" : ""} ${isMe ? "me" : ""}`}>
                <div><span className="fish-avatar">{member.avatar}</span><strong>{member.nickname}{member.isRobot ? " · BOT" : ""}</strong></div>
                <small>{state.hands?.[member.uid]?.length || 0} cards · {books.length} books</small>
                <div className="fish-books">{books.map((book) => <span key={book}>{formatRank(theme, book)}</span>)}</div>
              </article>
            );
          })}
        </div>

        <section className="fish-status" aria-live="polite">
          <strong>{state.message}</strong>
          <p>{publicAction}</p>
          <span>{state.stock?.length || 0} cards left in the pond</span>
        </section>

        {state.phase === "playing" ? (
          <section className="fish-ask-panel">
            <div>
              <span className="fish-control-label">1 · Pick what you’re asking for</span>
              <div className="fish-rank-picker">
                {ranksInHand.map((value) => (
                  <button key={value} type="button" className={rank === value ? "selected" : ""} onClick={() => setRank(value)} disabled={!myTurn || busy}>
                    <b>{value}</b><small>{formatRank(theme, value)}</small>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="fish-control-label">2 · Pick your victim{theme.adult ? "... politely, obviously" : ""}</span>
              <div className="fish-target-picker">
                {targets.map((member) => (
                  <button key={member.uid} type="button" className={targetUid === member.uid ? "selected" : ""} onClick={() => setTargetUid(member.uid)} disabled={!myTurn || busy}>
                    {member.avatar} {member.nickname} <small>{state.hands?.[member.uid]?.length || 0} cards</small>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="action-button fish-ask-button"
              disabled={!myTurn || busy || !rank || !targetUid}
              onClick={() => act({ type: "ask", rank, targetUid })}
            >
              {myTurn ? (theme.askButton || `Ask for ${formatRank(theme, rank)}`) : `Waiting for ${current?.nickname || "another player"}`}
            </button>
          </section>
        ) : null}

        <section className="fish-hand-area">
          <div className="fish-hand-heading"><span>Your hand</span><strong>{hand.length} cards</strong></div>
          <div className="fish-hand">
            {hand.length ? hand.map((card) => (
              <div key={card.id} className="fish-card-wrap">
                <StandardCard card={card} compact disabled={!myTurn} selected={rank === card.rank} onClick={() => myTurn && setRank(card.rank)} />
                {theme.adult ? <small>{formatRank(theme, card.rank)}</small> : null}
              </div>
            )) : <p className="fish-empty-hand">No cards in hand. {state.stock?.length ? "You’ll draw when your turn reaches you." : "Watch the last books land."}</p>}
          </div>
        </section>

        {state.phase === "game-over" ? (
          <div className="fish-game-over">
            <h2>{winners.length > 1 ? `${winners.join(" & ")} tied` : `${winners[0] || "Winner"} wins`}</h2>
            <p>{theme.adult ? "The table is out of cards and dignity." : "Most completed books wins the pond."}</p>
            <button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default function GoFishModule({ theme }) {
  const [adultAccepted, setAdultAccepted] = useState(() => !theme.adult || localStorage.getItem("familyGameAdultAccepted") === "yes");
  const controller = useModularTable({
    gameId: theme.gameId,
    maxPlayers: GO_FISH_RULES.playersMax,
    minimumPlayers: GO_FISH_RULES.playersMin,
    createGameState: createGoFishGame,
    reduceGameState: reduceGoFish,
    chooseRobotMove: chooseGoFishRobotMove,
  });

  if (theme.adult && !adultAccepted) {
    return <AdultGate title={theme.title} onEnter={() => { localStorage.setItem("familyGameAdultAccepted", "yes"); setAdultAccepted(true); }} />;
  }
  if (!controller.roomCode) {
    return <GameHome controller={controller} title={theme.title} kicker={theme.homeKicker} summary={theme.summary} maxPlayers={GO_FISH_RULES.playersMax} />;
  }
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening {theme.title} room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title={theme.title} minimumPlayers={GO_FISH_RULES.playersMin} maxPlayers={GO_FISH_RULES.playersMax} startLabel={theme.startLabel || "Deal the cards"} />;
  return <FishTable controller={controller} theme={theme} />;
}
