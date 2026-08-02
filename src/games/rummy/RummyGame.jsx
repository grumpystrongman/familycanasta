import React, { useEffect, useMemo, useRef, useState } from "react";
import { ensureAnonymousAuth, firebaseMissing, firebaseReady } from "../../firebase";
import {
  addModularRobot,
  applyModularAction,
  createModularRoom,
  joinModularRoom,
  MODULAR_AVATARS,
  orderedMembers,
  startModularGame,
  watchModularRoom,
} from "../../platform/modularRoomService";
import StandardCard, { sortStandardHand, SUIT_SYMBOLS } from "../../platform/StandardCard";
import { navigateToHub } from "../../HubApp";
import {
  canLayOff,
  chooseRummyRobotAction,
  createRummyGame,
  reduceRummy,
  RUMMY_RULES,
  rummyCardPoints,
} from "./engine";

function Home({ user, nickname, setNickname, avatar, setAvatar, joinCode, setJoinCode, createRoom, joinRoom, error, busy }) {
  return (
    <main className="modular-game-shell rummy-shell">
      <section className="modular-game-panel">
        <div className="modular-game-toolbar">
          <div><p className="game-kicker">Sets and runs</p><h1>Rummy</h1></div>
          <button type="button" className="secondary" onClick={navigateToHub}>All games</button>
        </div>
        <p className="game-summary">Basic family Rummy for two through six players. Draw one, play sets or suit runs, lay off cards after opening, and discard to end your turn.</p>
        {firebaseMissing ? <p className="modular-error">Firebase is not configured for online rooms.</p> : null}
        {error ? <p className="modular-error">{error}</p> : null}
        <div className="modular-form-grid">
          <label>Display name<input value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} /></label>
          <label>Join code<input value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" /></label>
        </div>
        <div className="avatar-picker" aria-label="Choose an avatar">
          {MODULAR_AVATARS.map((value) => <button key={value} type="button" className={avatar === value ? "chosen" : ""} onClick={() => setAvatar(value)}>{value}</button>)}
        </div>
        <div className="modular-lobby-actions">
          <button type="button" className="action-button" disabled={!user || busy || !firebaseReady} onClick={createRoom}>Create Rummy room</button>
          <button type="button" className="action-button secondary" disabled={!user || busy || joinCode.length !== 6} onClick={joinRoom}>Join room</button>
        </div>
      </section>
    </main>
  );
}

function Lobby({ room, user, addRobot, start, error, busy }) {
  const members = orderedMembers(room);
  const isHost = room.hostUid === user.uid;
  return (
    <main className="modular-game-shell rummy-shell">
      <section className="modular-game-panel">
        <div className="modular-game-toolbar">
          <div><p className="game-kicker">Rummy room</p><h1>Gather 2–6 players</h1></div>
          <button type="button" className="secondary" onClick={navigateToHub}>All games</button>
        </div>
        <p>Share this code:</p><div className="modular-room-code">{room.roomCode}</div>
        {error ? <p className="modular-error">{error}</p> : null}
        <div className="modular-members">
          {members.map((member) => <div className="modular-member-row" key={member.uid}><span>{member.avatar} <strong>{member.nickname}</strong></span><span>{member.isRobot ? "Robot" : member.isHost ? "Host" : `Seat ${Number(member.seat) + 1}`}</span></div>)}
        </div>
        <div className="modular-lobby-actions">
          {isHost ? <button type="button" className="action-button secondary" disabled={busy || members.length >= 6} onClick={addRobot}>Add robot</button> : null}
          {isHost ? <button type="button" className="action-button" disabled={busy || members.length < 2} onClick={start}>Deal Rummy</button> : <p>Waiting for the host to deal.</p>}
        </div>
      </section>
    </main>
  );
}

function meldLabel(meld) {
  if (meld.type === "set") return `${meld.cards[0]?.rank || "?"} set`;
  const ordered = [...(meld.cards || [])].sort((a, b) => a.value - b.value);
  return `${ordered[0]?.rank || "?"}–${ordered[ordered.length - 1]?.rank || "?"}${SUIT_SYMBOLS[ordered[0]?.suit] || ""}`;
}

function RummyTable({ room, user, action, error, busy }) {
  const members = orderedMembers(room);
  const state = room.gameState;
  const me = room.members?.[user.uid];
  const active = members[Number(state.currentPlayerIndex || 0)];
  const isMyTurn = active?.uid === user.uid && state.phase === "playing";
  const hand = sortStandardHand(state.hands?.[user.uid] || []);
  const [selected, setSelected] = useState([]);
  const selectedCards = hand.filter((card) => selected.includes(card.id));
  const topDiscard = state.discardPile?.[state.discardPile.length - 1];

  useEffect(() => {
    setSelected((current) => current.filter((id) => hand.some((card) => card.id === id)));
  }, [hand.map((card) => card.id).join("|")]);

  function toggleCard(cardId) {
    if (!isMyTurn || state.turnPhase !== "action" || busy) return;
    setSelected((current) => current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]);
  }

  async function actAndClear(payload) {
    await action(user.uid, payload);
    setSelected([]);
  }

  const deadwood = hand.reduce((sum, card) => sum + rummyCardPoints(card), 0);
  return (
    <main className="modular-game-shell rummy-shell">
      <section className="modular-game-panel rummy-table">
        <div className="modular-game-toolbar">
          <div><p className="game-kicker">Round {state.roundNumber}</p><h1>Rummy</h1></div>
          <button type="button" className="secondary" onClick={navigateToHub}>All games</button>
        </div>

        <div className="rummy-scoreboard">
          {members.map((member) => <article key={member.uid} className={active?.uid === member.uid ? "active" : ""}><span>{member.avatar} {member.nickname}</span><strong>{Number(state.scores?.[member.uid] || 0)}</strong><small>+{Number(state.roundPoints?.[member.uid] || 0)} this round · {state.hands?.[member.uid]?.length || 0} cards</small></article>)}
        </div>
        {error ? <p className="modular-error">{error}</p> : null}
        <div className="modular-table-status"><strong>{state.message}</strong><span>{state.phase === "playing" ? `${active?.nickname}: ${state.turnPhase === "draw" ? "draw" : "meld, lay off, or discard"}` : "Round complete"}</span></div>

        <div className="rummy-draw-row">
          <button type="button" className="rummy-pile" disabled={!isMyTurn || state.turnPhase !== "draw" || busy} onClick={() => action(user.uid, { type: "draw", source: "stock" })}>
            <StandardCard hidden compact /><span>Stock · {state.stock?.length || 0}</span>
          </button>
          <button type="button" className="rummy-pile" disabled={!isMyTurn || state.turnPhase !== "draw" || !topDiscard || busy} onClick={() => action(user.uid, { type: "draw", source: "discard" })}>
            {topDiscard ? <StandardCard card={topDiscard} compact disabled /> : <div className="empty-pile">Empty</div>}<span>Discard · {state.discardPile?.length || 0}</span>
          </button>
        </div>

        <section className="rummy-meld-area">
          <div className="rummy-section-heading"><h2>Table melds</h2><span>{state.melds?.length || 0}</span></div>
          {(state.melds || []).length ? <div className="rummy-meld-grid">{state.melds.map((meld) => {
            const owner = members.find((member) => member.uid === meld.ownerUid);
            const canAdd = isMyTurn && state.turnPhase === "action" && state.hasMelded?.[user.uid] && selectedCards.length > 0 && canLayOff(meld, selectedCards);
            return <article key={meld.id}><header><strong>{meldLabel(meld)}</strong><small>{owner?.nickname}</small></header><div className="rummy-meld-cards">{meld.cards.map((card) => <StandardCard key={card.id} card={card} compact disabled />)}</div><button type="button" className="action-button secondary" disabled={!canAdd || busy} onClick={() => actAndClear({ type: "layoff", meldId: meld.id, cardIds: selected })}>Lay off selected</button></article>;
          })}</div> : <p className="rummy-empty-state">No melds yet. Play three or more cards as a same-rank set or same-suit run.</p>}
        </section>

        {state.phase === "playing" ? <div className="rummy-actions">
          <button type="button" className="action-button" disabled={!isMyTurn || state.turnPhase !== "action" || selected.length < 3 || busy} onClick={() => actAndClear({ type: "meld", cardIds: selected })}>Meld selected</button>
          <button type="button" className="action-button secondary" disabled={!isMyTurn || state.turnPhase !== "action" || selected.length !== 1 || busy} onClick={() => actAndClear({ type: "discard", cardId: selected[0] })}>Discard selected</button>
        </div> : null}
        {state.phase === "round-end" ? <div className="rummy-actions"><strong>{members.find((member) => member.uid === state.winnerUid)?.nickname} won the round.</strong><button type="button" className="action-button" disabled={busy} onClick={() => action(user.uid, { type: "next-round" })}>Deal next round</button></div> : null}
        {state.phase === "game-over" ? <div className="rummy-actions"><strong>{members.find((member) => member.uid === state.winnerUid)?.nickname} wins the game.</strong><button type="button" className="action-button" onClick={navigateToHub}>Return to hub</button></div> : null}

        <div className="player-hand-heading"><span>{me?.avatar} <strong>{me?.nickname}</strong></span><span>{hand.length} cards · {deadwood} deadwood points</span></div>
        <div className="modular-hand">{hand.map((card) => <StandardCard key={card.id} card={card} selected={selected.includes(card.id)} disabled={!isMyTurn || state.turnPhase !== "action" || busy} onClick={() => toggleCard(card.id)} />)}</div>
      </section>
    </main>
  );
}

export default function RummyGame() {
  const [user, setUser] = useState(null);
  const [nickname, setNickname] = useState(localStorage.getItem("familyCardNickname") || "Jeff");
  const [avatar, setAvatar] = useState(localStorage.getItem("familyCardAvatar") || "🦊");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const robotKey = useRef("");

  useEffect(() => { if (firebaseReady) ensureAnonymousAuth().then(setUser).catch((event) => setError(event.message)); }, []);
  useEffect(() => roomCode ? watchModularRoom(roomCode, setRoom) : undefined, [roomCode]);
  const members = useMemo(() => orderedMembers(room), [room]);

  useEffect(() => {
    if (!room || room.status !== "playing" || room.gameState?.phase !== "playing") return;
    const state = room.gameState;
    const active = members[Number(state.currentPlayerIndex || 0)];
    if (!active?.isRobot) { robotKey.current = ""; return; }
    const handLength = state.hands?.[active.uid]?.length || 0;
    const key = `${state.roundNumber}-${state.turnPhase}-${state.currentPlayerIndex}-${handLength}-${state.melds?.length || 0}-${state.discardPile?.length || 0}`;
    if (robotKey.current === key) return;
    robotKey.current = key;
    const timer = setTimeout(() => {
      const move = chooseRummyRobotAction(state, active.uid, members);
      if (move) applyModularAction(roomCode, active.uid, move, reduceRummy).catch((event) => { setError(event.message); robotKey.current = ""; });
    }, 700);
    return () => clearTimeout(timer);
  }, [room, members, roomCode]);

  async function run(operation) {
    setBusy(true); setError("");
    try { return await operation(); } catch (event) { setError(event.message); throw event; } finally { setBusy(false); }
  }

  async function createRoom() {
    await run(async () => {
      localStorage.setItem("familyCardNickname", nickname); localStorage.setItem("familyCardAvatar", avatar);
      setRoomCode(await createModularRoom({ user, nickname, avatar, gameId: "rummy", maxPlayers: 6, rules: { targetScore: RUMMY_RULES.targetScore } }));
    }).catch(() => {});
  }

  async function joinRoom() {
    await run(async () => setRoomCode(await joinModularRoom({ code: joinCode, user, nickname, avatar, gameId: "rummy" }))).catch(() => {});
  }

  const action = (uid, payload) => run(() => applyModularAction(roomCode, uid, payload, reduceRummy)).catch(() => {});

  if (!roomCode) return <Home {...{ user, nickname, setNickname, avatar, setAvatar, joinCode, setJoinCode, createRoom, joinRoom, error, busy }} />;
  if (!room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Rummy room…</h1></section></main>;
  if (room.status === "lobby") return <Lobby room={room} user={user} error={error} busy={busy} addRobot={() => run(() => addModularRobot(roomCode, user.uid)).catch(() => {})} start={() => run(() => startModularGame(roomCode, user.uid, createRummyGame, 2)).catch(() => {})} />;
  return <RummyTable room={room} user={user} action={action} error={error} busy={busy} />;
}
