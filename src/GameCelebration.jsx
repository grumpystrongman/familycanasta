import React, { useEffect, useMemo, useState } from "react";
import { Crown, Home, PartyPopper, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { onValue, ref, remove } from "firebase/database";
import { db, ensureAnonymousAuth, firebaseReady } from "./firebase";
import { TEAM_NAMES } from "./game/engine";

const CONFETTI = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 12) * 0.12}s`,
  duration: `${2.6 + (index % 7) * 0.22}s`,
  rotate: `${(index * 53) % 360}deg`,
}));

function findVisibleRoomCode() {
  const value = document.querySelector(".code b")?.textContent?.trim();
  return value && /^[A-Z0-9]{6}$/.test(value) ? value : "";
}

export default function GameCelebration() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [user, setUser] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!firebaseReady) return undefined;
    ensureAnonymousAuth().then(setUser).catch(() => undefined);
    const timer = window.setInterval(() => {
      const visible = findVisibleRoomCode();
      if (visible) setRoomCode(visible);
    }, 350);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  const gameOver = room?.status === "gameOver" || room?.publicState?.phase === "gameOver";
  const winnerTeam = Number(room?.publicState?.winnerTeam ?? -1);
  const winnerName = TEAM_NAMES[winnerTeam] || `Team ${winnerTeam + 1}`;
  const winningScore = Number(room?.publicState?.winningScore || room?.publicState?.teamScores?.[winnerTeam] || 0);
  const winners = useMemo(
    () => Object.values(room?.members || {}).filter((member) => Number(member.team) === winnerTeam),
    [room, winnerTeam],
  );
  const scores = room?.publicState?.teamScores || [];

  if (!gameOver) return null;

  async function returnEveryoneHome() {
    if (!roomCode || !user || closing) return;
    setClosing(true);
    try {
      await remove(ref(db, `rooms/${roomCode}`));
      await remove(ref(db, `roomDirectory/${roomCode}`));
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <div className="game-celebration" role="dialog" aria-modal="true" aria-label="Game over">
      <div className="celebration-glow glow-one"/>
      <div className="celebration-glow glow-two"/>
      <div className="confetti-field" aria-hidden="true">
        {CONFETTI.map((piece) => (
          <i key={piece.id} style={{ left:piece.left, animationDelay:piece.delay, animationDuration:piece.duration, transform:`rotate(${piece.rotate})` }}/>
        ))}
      </div>

      <section className="winner-stage">
        <motionless-title>
          <span><PartyPopper/> GAME OVER <Sparkles/></span>
          <h1>Team {winnerName} wins!</h1>
          <p>{winningScore.toLocaleString()} points</p>
        </motionless-title>

        <div className="dancing-team" aria-label="Winning players">
          {winners.map((member, index) => (
            <div className={`dancing-avatar dance-${index % 4}`} key={member.uid}>
              <Crown className="avatar-crown"/>
              <span>{member.avatar || "🎉"}</span>
              <b>{member.nickname}</b>
              {member.isRobot && <small>Robot champion</small>}
            </div>
          ))}
        </div>

        <div className="winner-scoreboard">
          {Array.from({ length:Number(room?.rules?.teamCount || scores.length || 2) }, (_, team) => (
            <article className={team === winnerTeam ? "winner-row" : ""} key={team}>
              <span>{team === winnerTeam ? <Trophy/> : null} Team {TEAM_NAMES[team] || team + 1}</span>
              <b>{Number(scores[team] || 0).toLocaleString()}</b>
            </article>
          ))}
        </div>

        <button className="play-again-button" onClick={returnEveryoneHome} disabled={closing}>
          {closing ? <RotateCcw className="button-spin"/> : <Home/>}
          {closing ? "Returning everyone home…" : "Play again"}
        </button>
        <small className="play-again-note">This closes the finished room and returns every player to the beginning screen.</small>
      </section>
    </div>
  );
}
