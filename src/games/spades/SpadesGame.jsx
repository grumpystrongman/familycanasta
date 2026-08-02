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
import { chooseSpadesRobotAction, createSpadesGame, legalSpadesCards, reduceSpades, SPADES_RULES } from "./engine";

function Home({ user, nickname, setNickname, avatar, setAvatar, joinCode, setJoinCode, createRoom, joinRoom, error, busy }) {
  return (
    <main className="modular-game-shell spades-shell"><section className="modular-game-panel">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Bid with a partner</p><h1>Spades</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      <p className="game-summary">Fixed partnerships, thirteen tricks, nil bids, bags, and spades as permanent trump. First team to 500 wins.</p>
      {firebaseMissing.length > 0 ? <p className="modular-error">Firebase is not configured for online rooms.</p> : null}{error ? <p className="modular-error">{error}</p> : null}
      <div className="modular-form-grid"><label>Display name<input value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} /></label><label>Join code<input value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" /></label></div>
      <div className="avatar-picker">{MODULAR_AVATARS.map((value) => <button key={value} type="button" className={avatar === value ? "chosen" : ""} onClick={() => setAvatar(value)}>{value}</button>)}</div>
      <div className="modular-lobby-actions"><button type="button" className="action-button" disabled={!user || busy || !firebaseReady} onClick={createRoom}>Create Spades room</button><button type="button" className="action-button secondary" disabled={!user || busy || joinCode.length !== 6} onClick={joinRoom}>Join room</button></div>
    </section></main>
  );
}

function Lobby({ room, user, addRobot, start, error, busy }) {
  const members = orderedMembers(room); const isHost = room.hostUid === user.uid;
  return (
    <main className="modular-game-shell spades-shell"><section className="modular-game-panel">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Spades room</p><h1>Build two partnerships</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      <p>Share this code:</p><div className="modular-room-code">{room.roomCode}</div>{error ? <p className="modular-error">{error}</p> : null}
      <div className="spades-teams">{[0, 1].map((team) => <section key={team}><h2>Team {team + 1}</h2>{members.filter((_, index) => index % 2 === team).map((member) => <div className="modular-member-row" key={member.uid}><span>{member.avatar} <strong>{member.nickname}</strong></span><span>{member.isRobot ? "Robot" : `Seat ${Number(member.seat) + 1}`}</span></div>)}</section>)}</div>
      <div className="modular-lobby-actions">{isHost ? <button type="button" className="action-button secondary" disabled={busy || members.length >= 4} onClick={addRobot}>Add robot</button> : null}{isHost ? <button type="button" className="action-button" disabled={busy || members.length !== 4} onClick={start}>Deal Spades</button> : <p>Waiting for the host.</p>}</div>
    </section></main>
  );
}

function SpadesTable({ room, user, action, error, busy }) {
  const members = orderedMembers(room); const state = room.gameState; const me = room.members?.[user.uid];
  const hand = sortStandardHand(state.hands?.[user.uid] || []); const active = members[Number(state.currentPlayerIndex || 0)];
  const legalIds = useMemo(() => new Set(legalSpadesCards(state, user.uid, members).map((card) => card.id)), [state, user.uid, members]);
  const [bid, setBid] = useState(3); const myBid = state.bids?.[user.uid];
  const teamMembers = (team) => members.filter((_, index) => index % 2 === team);
  return (
    <main className="modular-game-shell spades-shell"><section className="modular-game-panel spades-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Hand {state.roundNumber}</p><h1>Spades</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      <div className="spades-scoreboard">{[0, 1].map((team) => <article key={team}><span>Team {team + 1}: {teamMembers(team).map((member) => member.nickname).join(" + ")}</span><strong>{Number(state.teamScores?.[team] || 0)}</strong><small>{Number(state.teamBags?.[team] || 0)} bags · {Number(state.roundScore?.[team] || 0)} this hand</small></article>)}</div>
      {error ? <p className="modular-error">{error}</p> : null}
      <div className="modular-table-status"><strong>{state.message}</strong><span>{state.spadesBroken ? "Spades are broken" : "Spades are not broken"}</span></div>
      <div className="spades-bids">{members.map((member) => <span key={member.uid}>{member.avatar} {member.nickname}: <b>{state.bids?.[member.uid] == null ? "—" : Number(state.bids[member.uid]) === 0 ? "NIL" : state.bids[member.uid]}</b> · {Number(state.playerTricks?.[member.uid] || 0)} tricks</span>)}</div>
      <div className="modular-table-center spades-trick">{(state.currentTrick || []).length ? state.currentTrick.map((play) => <div key={play.uid}><small>{members.find((member) => member.uid === play.uid)?.nickname}</small><StandardCard card={play.card} compact disabled /></div>) : <p>{state.phase === "bidding" ? `${active?.nickname} is bidding` : `${active?.nickname || "Next player"} leads`}</p>}</div>
      {state.phase === "bidding" && active?.uid === user.uid && myBid == null ? <div className="spades-action-box"><label>Your bid<select value={bid} onChange={(event) => setBid(Number(event.target.value))}>{Array.from({ length: 14 }, (_, value) => <option key={value} value={value}>{value === 0 ? "Nil" : value}</option>)}</select></label><button type="button" className="action-button" disabled={busy} onClick={() => action(user.uid, { type: "bid", bid })}>Submit bid</button></div> : null}
      {state.phase === "round-end" ? <div className="spades-action-box"><h2>Hand complete</h2><button type="button" className="action-button" disabled={busy} onClick={() => action(user.uid, { type: "next-round" })}>Deal next hand</button></div> : null}
      {state.phase === "game-over" ? <div className="spades-action-box"><h2>Team {Number(state.winnerTeam) + 1} wins.</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to hub</button></div> : null}
      <div className="player-hand-heading"><span>{me?.avatar} <strong>{me?.nickname}</strong></span><span>{hand.length} cards</span></div>
      <div className="modular-hand">{hand.map((card) => <StandardCard key={card.id} card={card} disabled={busy || !legalIds.has(card.id)} onClick={() => action(user.uid, { type: "play", cardId: card.id })} />)}</div>
    </section></main>
  );
}

export default function SpadesGame() {
  const [user, setUser] = useState(null); const [nickname, setNickname] = useState(localStorage.getItem("familyCardNickname") || "Jeff"); const [avatar, setAvatar] = useState(localStorage.getItem("familyCardAvatar") || "🦊");
  const [joinCode, setJoinCode] = useState(""); const [roomCode, setRoomCode] = useState(""); const [room, setRoom] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const robotKey = useRef("");
  useEffect(() => { if (firebaseReady) ensureAnonymousAuth().then(setUser).catch((event) => setError(event.message)); }, []);
  useEffect(() => roomCode ? watchModularRoom(roomCode, setRoom) : undefined, [roomCode]);
  const members = useMemo(() => orderedMembers(room), [room]);
  useEffect(() => {
    if (!room || room.status !== "playing") return; const state = room.gameState; const active = members[Number(state.currentPlayerIndex || 0)]; if (!active?.isRobot || !["bidding", "playing"].includes(state.phase)) { robotKey.current = ""; return; }
    const key = `${state.roundNumber}-${state.phase}-${state.completedTricks}-${state.currentTrick?.length || 0}-${Object.keys(state.bids || {}).length}-${active.uid}`; if (robotKey.current === key) return; robotKey.current = key;
    const timer = setTimeout(() => { const move = chooseSpadesRobotAction(state, active.uid, members); if (move) applyModularAction(roomCode, active.uid, move, reduceSpades).catch((event) => { setError(event.message); robotKey.current = ""; }); }, 700); return () => clearTimeout(timer);
  }, [room, members, roomCode]);
  async function run(operation) { setBusy(true); setError(""); try { return await operation(); } catch (event) { setError(event.message); throw event; } finally { setBusy(false); } }
  async function createRoom() { await run(async () => { localStorage.setItem("familyCardNickname", nickname); localStorage.setItem("familyCardAvatar", avatar); setRoomCode(await createModularRoom({ user, nickname, avatar, gameId: "spades", maxPlayers: 4, rules: { targetScore: SPADES_RULES.targetScore } })); }).catch(() => {}); }
  async function joinRoom() { await run(async () => setRoomCode(await joinModularRoom({ code: joinCode, user, nickname, avatar, gameId: "spades" }))).catch(() => {}); }
  const action = (uid, payload) => run(() => applyModularAction(roomCode, uid, payload, reduceSpades)).catch(() => {});
  if (!roomCode) return <Home {...{ user, nickname, setNickname, avatar, setAvatar, joinCode, setJoinCode, createRoom, joinRoom, error, busy }} />;
  if (!room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Spades room…</h1></section></main>;
  if (room.status === "lobby") return <Lobby room={room} user={user} error={error} busy={busy} addRobot={() => run(() => addModularRobot(roomCode, user.uid)).catch(() => {})} start={() => run(() => startModularGame(roomCode, user.uid, createSpadesGame, 4)).catch(() => {})} />;
  return <SpadesTable room={room} user={user} action={action} error={error} busy={busy} />;
}
