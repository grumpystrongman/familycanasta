import React, { useEffect, useMemo, useState } from "react";
import StandardCard, { RANKS } from "./StandardCard";
import useModularTable from "./useModularTable";
import { GameHome, GameLobby } from "./ModularGameChrome";
import { navigateToHub } from "../HubApp";
import { chooseGoFishRobotMove, createGoFishGame, GO_FISH_RULES, reduceGoFish } from "./goFishCore";

const SUIT_ORDER = Object.freeze({ clubs: 0, diamonds: 1, hearts: 2, spades: 3 });

function titleCaseRank(rank) {
  const words = { J: "Jacks", Q: "Queens", K: "Kings", A: "Aces" };
  return words[rank] || `${rank}s`;
}

function formatRank(theme, rank) {
  return theme.rankLabels?.[rank] || titleCaseRank(rank);
}

function formatCard(theme, card) {
  return theme.cardLabel?.(card) || formatRank(theme, card?.rank);
}

export function groupGoFishHand(cards = []) {
  const list = Array.isArray(cards) ? cards.filter(Boolean) : Object.values(cards || {}).filter(Boolean);
  return RANKS.map((rank) => ({
    rank,
    cards: list
      .filter((card) => card.rank === rank)
      .sort((a, b) => (SUIT_ORDER[a.suit] ?? 99) - (SUIT_ORDER[b.suit] ?? 99)),
  })).filter((group) => group.cards.length > 0);
}

function adultMissRoast(theme, rank) {
  const lines = theme.missLines || [];
  if (!lines.length) return "Take the L and fish from the pile of consequences.";
  const index = Math.max(0, RANKS.indexOf(rank));
  return lines[index % lines.length];
}

function AdultGate({ title, onEnter }) {
  return (
    <main className="modular-game-shell fish-adult-shell">
      <section className="modular-game-panel fish-adult-gate">
        <p className="game-kicker">18+ table · adults only</p>
        <h1>{title}</h1>
        <p>This game contains profanity, raunchy jokes, sexual innuendo, terrible dating choices, biological betrayals, and aggressively immature adult humor.</p>
        <p><strong>The matching still works exactly like Go Fish:</strong> four different joke cards belong to each named set. Ask for the set, collect all four, and complete the book.</p>
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
      const book = action.completedBooks?.length
        ? ` Then ${actor} completed the whole disgusting set of ${formatRank(theme, action.completedBooks[0])}. Somewhere, their mother just sighed and doesn't know why.`
        : "";
      return `${actor} asked ${target}, “Got any ${label}?” ${target} had ${action.count}. That's either good luck or deeply concerning evidence.${book}`;
    }
    const draw = action.drewRank ? `${actor} fishes from the pile of bad decisions.` : "The pile is empty, much like everyone's remaining dignity.";
    return `${actor} asked ${target}, “Got any ${label}?” ${target}: “Go F' Yourself.” ${adultMissRoast(theme, action.rank)} ${draw}`;
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
  const rawHand = state.hands?.[user?.uid] || [];
  const handGroups = useMemo(() => groupGoFishHand(rawHand), [rawHand]);
  const handSize = handGroups.reduce((sum, group) => sum + group.cards.length, 0);
  const ranksInHand = useMemo(() => handGroups.map((group) => group.rank), [handGroups]);
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
          <div><p className="game-kicker">{theme.tableKicker}</p><h1>{theme.title}</h1>{theme.deckTagline ? <small className="fish-deck-tagline">{theme.deckTagline}</small> : null}</div>
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
              <span className="fish-control-label">1 · Pick the set you’re asking for</span>
              <div className="fish-rank-picker">
                {ranksInHand.map((value) => (
                  <button key={value} type="button" className={rank === value ? "selected" : ""} onClick={() => setRank(value)} disabled={!myTurn || busy}>
                    <b>{value}</b><small>{formatRank(theme, value)}</small>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="fish-control-label">2 · Pick your victim{theme.adult ? "... consensually, you animal" : ""}</span>
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
              {myTurn ? (theme.adult ? `GOT ANY ${formatRank(theme, rank).toUpperCase()}?` : (theme.askButton || `Ask for ${formatRank(theme, rank)}`)) : `Waiting for ${current?.nickname || "another player"}`}
            </button>
          </section>
        ) : null}

        <section className="fish-hand-area">
          <div className="fish-hand-heading">
            <span>Your hand <small>· matching cards stay together automatically</small></span>
            <strong>{handSize} cards · {handGroups.length} sets</strong>
          </div>
          <div className="fish-hand">
            {handGroups.length ? handGroups.map((group) => (
              <section key={group.rank} className={`fish-hand-group ${rank === group.rank ? "selected" : ""}`}>
                <button type="button" className="fish-hand-group-heading" disabled={busy} onClick={() => setRank(group.rank)}>
                  <span><strong>{formatRank(theme, group.rank)}</strong><small>{theme.adult ? "Matching set" : `Rank ${group.rank}`}</small></span>
                  <b>{group.cards.length}/4</b>
                </button>
                <div className="fish-hand-group-cards">
                  {group.cards.map((card) => (
                    <div key={card.id} className={`fish-card-wrap ${theme.adult ? "fish-adult-card-wrap" : ""}`}>
                      <StandardCard card={card} compact disabled={!myTurn} selected={rank === card.rank} onClick={() => myTurn && setRank(card.rank)} />
                      {theme.adult ? <div className="fish-card-copy"><strong>{formatRank(theme, card.rank)}</strong><small>{formatCard(theme, card)}</small></div> : null}
                    </div>
                  ))}
                </div>
              </section>
            )) : <p className="fish-empty-hand">No cards in hand. {state.stock?.length ? "You’ll draw when your turn reaches you." : "Watch the last books land."}</p>}
          </div>
        </section>

        {state.phase === "game-over" ? (
          <div className="fish-game-over">
            <h2>{winners.length > 1 ? `${winners.join(" & ")} tied` : `${winners[0] || "Winner"} wins`}</h2>
            <p>{theme.adult ? "The table is out of cards, shame, and plausible deniability." : "Most completed books wins the pond."}</p>
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
