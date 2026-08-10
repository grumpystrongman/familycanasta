import React from "react";
import { firebaseMissing, firebaseReady } from "../firebase";
import { MODULAR_AVATARS } from "./modularRoomService";
import { navigateToHub } from "../HubApp";
import "./standardCards.css";
import "./newGameChrome.css";

export function GameHome({
  controller,
  title,
  kicker,
  summary,
  maxPlayers,
  quickPlayChoices,
}) {
  const {
    user,
    nickname,
    setNickname,
    avatar,
    setAvatar,
    joinCode,
    setJoinCode,
    createRoom,
    quickStartRobot,
    joinRoom,
    error,
    busy,
    minimumPlayers = 2,
  } = controller;

  const robotCount = Math.max(1, Number(minimumPlayers) - 1);
  const quickChoices = quickPlayChoices?.length ? quickPlayChoices : [{
    icon: "🤖",
    label: robotCount === 1 ? "Play vs robot" : `Play with ${robotCount} robots`,
    description: robotCount === 1 ? "Skip the lobby and start immediately." : "Fill the table with robot players and start immediately.",
    rules: {},
  }];
  const unavailable = !user || busy || !firebaseReady;

  return (
    <main className="modular-game-shell">
      <section className="modular-game-panel game-start-panel">
        <div className="modular-game-toolbar game-start-toolbar">
          <div>
            <p className="game-kicker">{kicker}</p>
            <h1>{title}</h1>
          </div>
          <button type="button" className="secondary" onClick={navigateToHub}>← All games</button>
        </div>

        <div className="game-start-intro">
          <p className="game-summary">{summary}</p>
          <div className="game-start-badges"><span>{maxPlayers === 2 ? "2 players" : `${minimumPlayers}–${maxPlayers} players`}</span><span>Robot play</span><span>Online rooms</span></div>
        </div>

        {firebaseMissing.length > 0 ? <p className="modular-error">Firebase is not configured for online rooms.</p> : null}
        {error ? <p className="modular-error">{error}</p> : null}

        <div className="game-start-grid">
          <section className="quick-play-panel" aria-label="Quick play">
            <div className="quick-play-heading"><span>FASTEST WAY IN</span><h2>Start playing</h2><p>No room codes. No seat management. Pick a mode and go.</p></div>
            <div className="quick-play-options">
              {quickChoices.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  className="quick-play-choice"
                  disabled={unavailable}
                  onClick={() => quickStartRobot(choice.rules || {})}
                >
                  <span className="quick-play-icon" aria-hidden="true">{choice.icon || "🤖"}</span>
                  <span><strong>{choice.label}</strong><small>{choice.description || "Start immediately against a robot."}</small></span>
                  <b aria-hidden="true">→</b>
                </button>
              ))}
            </div>
            <p className="game-family-note">🎓 Never played? <strong>Learn & Rules</strong> stays available while you play, so you can learn by doing.</p>
          </section>

          <aside className="game-start-side">
            <section className="player-profile-card">
              <div className="player-profile-heading"><span className="player-profile-avatar">{avatar}</span><div><small>YOU ARE PLAYING AS</small><strong>{nickname.trim() || "Player"}</strong></div></div>
              <label className="profile-name-field">Display name<input value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} /></label>
              <div className="avatar-picker compact" aria-label="Choose avatar">{MODULAR_AVATARS.map((value) => <button key={value} type="button" aria-label={`Use ${value} avatar`} className={avatar === value ? "chosen" : ""} onClick={() => setAvatar(value)}>{value}</button>)}</div>
            </section>

            <details className="friend-play-panel">
              <summary><span>👥 Play with people</span><small>Create or join a private room</small></summary>
              <div className="friend-play-body">
                <button type="button" className="action-button friend-create-button" disabled={unavailable} onClick={createRoom}>Create private room</button>
                <div className="friend-divider"><span>or join one</span></div>
                <label>Room code<input value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" /></label>
                <button type="button" className="action-button secondary" disabled={!user || busy || joinCode.length !== 6} onClick={joinRoom}>Join room</button>
              </div>
            </details>
          </aside>
        </div>
      </section>
    </main>
  );
}

export function GameLobby({
  controller,
  title,
  minimumPlayers,
  maxPlayers,
  startLabel = "Start game",
  seatLabels = [],
  lobbyHint = "Add a robot or share the room code with a friend.",
}) {
  const { room, user, members, addRobot, start, error, busy } = controller;
  const isHost = room.hostUid === user?.uid;
  const seats = Array.from({ length: maxPlayers }, (_, seat) => members.find((member) => Number(member.seat) === seat) || null);

  function copyCode() {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(room.roomCode).catch(() => {});
  }

  return (
    <main className="modular-game-shell">
      <section className="modular-game-panel game-lobby-panel">
        <div className="modular-game-toolbar">
          <div><p className="game-kicker">{title} · private room</p><h1>Set the table</h1></div>
          <button type="button" className="secondary" onClick={navigateToHub}>← All games</button>
        </div>
        {error ? <p className="modular-error">{error}</p> : null}

        <section className="lobby-code-card">
          <div><small>ROOM CODE</small><strong className="modular-room-code">{room.roomCode}</strong><p>{lobbyHint}</p></div>
          <button type="button" className="secondary" onClick={copyCode}>Copy code</button>
        </section>

        <section className="lobby-seats" aria-label="Player seats">
          {seats.map((member, seat) => (
            <article key={seat} className={`lobby-seat ${member ? "filled" : "empty"}`}>
              <span className="lobby-seat-number">{seat + 1}</span>
              {member ? <>
                <span className="lobby-seat-avatar">{member.avatar}</span>
                <div><strong>{member.nickname}</strong><small>{seatLabels[seat] || (member.isRobot ? "Robot opponent" : member.uid === room.hostUid ? "Host" : "Player")}</small></div>
                <span className="lobby-seat-state">{member.isRobot ? "BOT" : "READY"}</span>
              </> : <>
                <span className="lobby-seat-avatar ghost">＋</span>
                <div><strong>Open seat</strong><small>{seatLabels[seat] || "Waiting for a player"}</small></div>
              </>}
            </article>
          ))}
        </section>

        <div className="lobby-footer-actions">
          {isHost ? <>
            <button type="button" className="action-button secondary" disabled={busy || members.length >= maxPlayers} onClick={addRobot}>＋ Add robot</button>
            <button type="button" className="action-button lobby-start-button" disabled={busy || members.length < minimumPlayers} onClick={start}>{startLabel} →</button>
          </> : <div className="lobby-waiting"><span className="lobby-pulse" /> Waiting for the host to start…</div>}
        </div>
      </section>
    </main>
  );
}

export function PlayerChips({ members, renderDetail, activeUid = null }) {
  return <div className="new-game-player-strip">{members.map((member) => <article key={member.uid} className={activeUid === member.uid ? "active" : ""}><span>{member.avatar}</span><div><strong>{member.nickname}</strong><small>{renderDetail(member)}</small></div></article>)}</div>;
}
