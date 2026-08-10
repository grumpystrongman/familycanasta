import React from "react";
import { firebaseMissing, firebaseReady } from "../firebase";
import { MODULAR_AVATARS } from "./modularRoomService";
import { navigateToHub } from "../HubApp";
import "./newGameChrome.css";

export function GameHome({ controller, title, kicker, summary, maxPlayers }) {
  const { user, nickname, setNickname, avatar, setAvatar, joinCode, setJoinCode, createRoom, joinRoom, error, busy } = controller;
  return (
    <main className="modular-game-shell"><section className="modular-game-panel">
      <div className="modular-game-toolbar"><div><p className="game-kicker">{kicker}</p><h1>{title}</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      <p className="game-summary">{summary}</p>
      <p className="game-family-note">🎓 New or rusty? Open <strong>Learn & Rules</strong> for a step-by-step tutorial before you deal.</p>
      {firebaseMissing.length > 0 ? <p className="modular-error">Firebase is not configured for online rooms.</p> : null}{error ? <p className="modular-error">{error}</p> : null}
      <div className="modular-form-grid"><label>Display name<input value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} /></label><label>Join code<input value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" /></label></div>
      <div className="avatar-picker">{MODULAR_AVATARS.map((value) => <button key={value} type="button" className={avatar === value ? "chosen" : ""} onClick={() => setAvatar(value)}>{value}</button>)}</div>
      <div className="modular-lobby-actions"><button type="button" className="action-button" disabled={!user || busy || !firebaseReady} onClick={createRoom}>Create {title} room</button><button type="button" className="action-button secondary" disabled={!user || busy || joinCode.length !== 6} onClick={joinRoom}>Join room</button><span>Up to {maxPlayers} players</span></div>
    </section></main>
  );
}

export function GameLobby({ controller, title, minimumPlayers, maxPlayers, startLabel = "Deal cards" }) {
  const { room, user, members, addRobot, start, error, busy } = controller;
  const isHost = room.hostUid === user?.uid;
  return (
    <main className="modular-game-shell"><section className="modular-game-panel">
      <div className="modular-game-toolbar"><div><p className="game-kicker">{title} room</p><h1>Gather the table</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      <p>Share this code:</p><div className="modular-room-code">{room.roomCode}</div>{error ? <p className="modular-error">{error}</p> : null}
      <div className="modular-members">{members.map((member) => <div className="modular-member-row" key={member.uid}><span>{member.avatar} <strong>{member.nickname}</strong></span><span>{member.isRobot ? "Robot" : `Seat ${Number(member.seat) + 1}`}</span></div>)}</div>
      <div className="modular-lobby-actions">{isHost ? <button type="button" className="action-button secondary" disabled={busy || members.length >= maxPlayers} onClick={addRobot}>Add robot</button> : null}{isHost ? <button type="button" className="action-button" disabled={busy || members.length < minimumPlayers} onClick={start}>{startLabel}</button> : <p>Waiting for the host.</p>}</div>
    </section></main>
  );
}

export function PlayerChips({ members, renderDetail }) {
  return <div className="new-game-player-strip">{members.map((member) => <article key={member.uid}><span>{member.avatar}</span><div><strong>{member.nickname}</strong><small>{renderDetail(member)}</small></div></article>)}</div>;
}
