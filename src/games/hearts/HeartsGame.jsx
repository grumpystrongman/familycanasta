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
import StandardCard, { sortStandardHand } from "../../platform/StandardCard";
import { navigateToHub } from "../../HubApp";
import {
  chooseHeartsRobotAction,
  createHeartsGame,
  HEARTS_RULES,
  legalHeartsCards,
  reduceHearts,
} from "./engine";

function scoreRows(room, members) {
  return [...members]
    .map((member) => ({ member, score: Number(room.gameState?.scores?.[member.uid] || 0) }))
    .sort((a, b) => a.score - b.score);
}

function Home({ user, nickname, setNickname, avatar, setAvatar, joinCode, setJoinCode, onCreate, onJoin, error, busy }) {
  return (
    <main className="modular-game-shell hearts-shell">
      <section className="modular-game-panel">
        <div className="modular-game-toolbar">
          <div><p className="game-kicker">Avoid the points</p><h1>Hearts</h1></div>
          <button type="button" className="secondary" onClick={navigateToHub}>All games</button>
        </div>
        <p className="game-summary">Four players. Pass three cards, follow suit, avoid hearts and the queen of spades, or take all 26 points and shoot the moon.</p>
        {firebaseMissing ? <p className="modular-error">Firebase is not configured for online rooms.</p> : null}
        {error ? <p className="modular-error">{error}</p> : null}
        <div className="modular-form-grid">
          <label>Display name<input value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} /></label>
          <label>Join code<input value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" /></label>
        </div>
        <div className="avatar-picker" aria-label="Choose an avatar">
          {MODULAR_AVATARS.map((value) => (
            <button key={value} type="button" className={avatar === value ? "chosen" : ""} onClick={() => setAvatar(value)}>{value}</button>
          ))}
        </div>
        <div className="modular-lobby-actions">
          <button type="button" className="action-button" disabled={!user || busy || !firebaseReady} onClick={onCreate}>Create Hearts room</button>
          <button type="button" className="action-button secondary" disabled={!user || busy || joinCode.length !== 6} onClick={onJoin}>Join room</button>
        </div>
      </section>
    </main>
  );
}

function Lobby({ room, user, onAddRobot, onStart, error, busy }) {
  const members = orderedMembers(room);
  const isHost = room.hostUid === user.uid;
  return (
    <main className="modular-game-shell hearts-shell">
      <section className="modular-game-panel">
        <div className="modular-game-toolbar">
          <div><p className="game-kicker">Hearts room</p><h1>Gather four players</h1></div>
          <button type="button" className="secondary" onClick={navigateToHub}>All games</button>
        </div>
        <p>Share this code:</p><div className="modular-room-code">{room.roomCode}</div>
        {error ? <p className="modular-error">{error}</p> : null}
        <div className="modular-members">
          {members.map((member) => (
            <div className="modular-member-row" key={member.uid}>
              <span>{member.avatar} <strong>{member.nickname}</strong></span>
              <span>{member.isRobot ? "Robot" : member.isHost ? "Host" : `Seat ${Number(member.seat) + 1}`}</span>
            </div>
          ))}
        </div>
        <div className="modular-lobby-actions">
          {isHost ? <button type="button" className="action-button secondary" disabled={busy || members.length >= 4} onClick={onAddRobot}>Add robot</button> : null}
          {isHost ? <button type="button" className="action-button" disabled={busy || members.length !== 4} onClick={onStart}>Deal Hearts</button> : <p>Waiting for the host to deal.</p>}
        </div>
      </section>
    </main>
  );
}

function HeartsTable({ room, user, onAction, error, busy }) {
  const members = orderedMembers(room);
  const state = room.gameState;
  const me = room.members?.[user.uid];
  const hand = sortStandardHand(state.hands?.[user.uid] || []);
  const [selected, setSelected] = useState([]);
  const legalIds = useMemo(() => new Set(legalHeartsCards(state, user.uid, members).map((card) => card.id)), [state, user.uid, members]);
  const active = members[Number(state.currentPlayerIndex || 0)];
  const passingDone = Boolean(state.pendingPasses?.[user.uid]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => hand.some((card) => card.id === id)));
  }, [hand.map((card) => card.id).join("|")]);

  function toggle(id) {
    if (passingDone || state.phase !== "passing") return;
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 3 ? [...current, id] : current);
  }

  return (
    <main className="modular-game-shell hearts-shell">
      <section className="modular-game-panel hearts-table">
        <div className="modular-game-toolbar">
          <div><p className="game-kicker">Round {state.roundNumber}</p><h1>Hearts</h1></div>
          <button type="button" className="secondary" onClick={navigateToHub}>All games</button>
        </div>
        <div className="hearts-scoreboard">
          {scoreRows(room, members).map(({ member, score }) => (
            <article key={member.uid} className={active?.uid === member.uid ? "active" : ""}>
              <span>{member.avatar} {member.nickname}</span><strong>{score}</strong>
              <small>{Number(state.roundPoints?.[member.uid] || 0)} this hand</small>
            </article>
          ))}
        </div>
        {error ? <p className="modular-error">{error}</p> : null}
        <div className="modular-table-status">
          <strong>{state.message}</strong>
          <span>{state.heartsBroken ? "Hearts are broken" : "Hearts are not broken"}</span>
        </div>
        <div className="modular-table-center hearts-trick">
          {(state.currentTrick || []).length ? state.currentTrick.map((play) => {
            const member = members.find((candidate) => candidate.uid === play.uid);
            return <div key={play.uid}><small>{member?.nickname}</small><StandardCard card={play.card} compact disabled /></div>;
          }) : <p>{state.phase === "passing" ? `Passing ${state.passDirection}` : active ? `${active.nickname} leads` : "Preparing the next trick"}</p>}
        </div>

        {state.phase === "passing" ? (
          <div className="hearts-action-box">
            <h2>{passingDone ? "Pass submitted" : `Choose three cards to pass ${state.passDirection}`}</h2>
            <button type="button" className="action-button" disabled={busy || passingDone || selected.length !== 3} onClick={() => onAction(user.uid, { type: "pass", cardIds: selected }).then(() => setSelected([]))}>Pass selected cards</button>
          </div>
        ) : null}
        {state.phase === "round-end" ? <div className="hearts-action-box"><h2>Round complete</h2><button type="button" className="action-button" disabled={busy} onClick={() => onAction(user.uid, { type: "next-round" })}>Deal next round</button></div> : null}
        {state.phase === "game-over" ? <div className="hearts-action-box"><h2>{members.find((member) => member.uid === state.winnerUid)?.nickname} wins with the lowest score.</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to the hub</button></div> : null}

        <div className="player-hand-heading"><span>{me?.avatar} <strong>{me?.nickname}</strong></span><span>{hand.length} cards</span></div>
        <div className="modular-hand">
          {hand.map((card) => (
            <StandardCard
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              disabled={busy || (state.phase === "passing" ? passingDone : !legalIds.has(card.id))}
              onClick={() => state.phase === "passing" ? toggle(card.id) : onAction(user.uid, { type: "play", cardId: card.id })}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

export default function HeartsGame() {
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
    if (!room || room.status !== "playing") return;
    const state = room.gameState;
    let robot = null;
    if (state.phase === "passing") robot = members.find((member) => member.isRobot && !state.pendingPasses?.[member.uid]);
    if (state.phase === "playing") {
      const active = members[Number(state.currentPlayerIndex || 0)];
      if (active?.isRobot) robot = active;
    }
    if (!robot) { robotKey.current = ""; return; }
    const key = `${state.roundNumber}-${state.phase}-${state.completedTricks}-${state.currentTrick?.length || 0}-${robot.uid}-${Object.keys(state.pendingPasses || {}).length}`;
    if (robotKey.current === key) return;
    robotKey.current = key;
    const timer = setTimeout(() => {
      const action = chooseHeartsRobotAction(state, robot.uid, members);
      if (action) applyModularAction(roomCode, robot.uid, action, reduceHearts).catch((event) => { setError(event.message); robotKey.current = ""; });
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
      const code = await createModularRoom({ user, nickname, avatar, gameId: "hearts", maxPlayers: 4, rules: { targetScore: HEARTS_RULES.targetScore } });
      setRoomCode(code);
    }).catch(() => {});
  }

  async function joinRoom() {
    await run(async () => {
      const code = await joinModularRoom({ code: joinCode, user, nickname, avatar, gameId: "hearts" });
      setRoomCode(code);
    }).catch(() => {});
  }

  const action = (actorUid, payload) => run(() => applyModularAction(roomCode, actorUid, payload, reduceHearts)).catch(() => {});

  if (!roomCode) return <Home {...{ user, nickname, setNickname, avatar, setAvatar, joinCode, setJoinCode, error, busy }} onCreate={createRoom} onJoin={joinRoom} />;
  if (!room) return <main className="modular-game-shell hearts-shell"><section className="modular-game-panel"><h1>Opening Hearts room…</h1></section></main>;
  if (room.status === "lobby") return <Lobby room={room} user={user} error={error} busy={busy} onAddRobot={() => run(() => addModularRobot(roomCode, user.uid)).catch(() => {})} onStart={() => run(() => startModularGame(roomCode, user.uid, createHeartsGame, 4)).catch(() => {})} />;
  return <HeartsTable room={room} user={user} error={error} busy={busy} onAction={action} />;
}
