import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigateToHub } from "../../HubApp";
import {
  CHOMP_RULES,
  CHOMPERS,
  chomperPose,
  createRound,
  extensionFor,
  stepRound,
  triggerChomp,
  winnersForRound,
} from "./engine";
import "./styles.css";

const PLAYER_COLORS = ["#ec4de6", "#73e14d", "#43bdf6", "#ff843c"];

function drawBall(ctx, ball) {
  const r = CHOMP_RULES.ballRadius;
  const gradient = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 1, ball.x, ball.y, r + 3);
  gradient.addColorStop(0, "rgba(255,255,255,.95)");
  gradient.addColorStop(0.2, `hsl(${ball.hue} 94% 72%)`);
  gradient.addColorStop(0.68, `hsl(${ball.hue} 86% 54%)`);
  gradient.addColorStop(1, `hsl(${ball.hue} 84% 34%)`);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.shadowColor = `hsla(${ball.hue} 90% 60% / .55)`;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawTeeth(ctx, open) {
  ctx.fillStyle = "#fff0c9";
  const spread = open ? 18 : 9;
  for (const y of [-spread, spread]) {
    for (const x of [22, 36, 49]) {
      ctx.beginPath();
      if (y < 0) {
        ctx.moveTo(x - 5, y - 2); ctx.lineTo(x + 5, y - 2); ctx.lineTo(x, y + 9);
      } else {
        ctx.moveTo(x - 5, y + 2); ctx.lineTo(x + 5, y + 2); ctx.lineTo(x, y - 9);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawMonsterFace(ctx, chomper, index) {
  const open = chomper.phase === "launch" || chomper.phase === "bite";
  const bite = chomper.phase === "bite";
  const body = PLAYER_COLORS[index];

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.5)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, bite ? 55 : 49, open ? 43 : 39, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (index === 0) {
    ctx.fillStyle = "#7c239f";
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-8, side * 31); ctx.lineTo(-35, side * 56); ctx.lineTo(-43, side * 20); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#ffda62";
    ctx.beginPath(); ctx.arc(-19, -22, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-19, 22, 9, 0, Math.PI * 2); ctx.fill();
  } else if (index === 1) {
    ctx.fillStyle = "#419536";
    for (const [x, y, r] of [[-25,-30,8],[-29,30,7],[-8,-38,5],[-6,39,6]]) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "#73e14d"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-18,-22); ctx.lineTo(-34,-43); ctx.moveTo(-18,22); ctx.lineTo(-34,43); ctx.stroke();
  } else if (index === 2) {
    ctx.fillStyle = "#1c6c9b";
    for (let a = -1.15; a <= 1.15; a += 0.28) {
      ctx.beginPath(); ctx.moveTo(-30, Math.sin(a) * 38); ctx.lineTo(-53, Math.sin(a) * 48); ctx.lineTo(-39, Math.sin(a + .18) * 31); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#102d47";
    ctx.fillRect(-38, -34, 34, 10);
  } else {
    ctx.fillStyle = "#d94628";
    for (const y of [-34,-21,-7,9,24,35]) {
      ctx.beginPath(); ctx.moveTo(-27, y); ctx.lineTo(-51, y - 8); ctx.lineTo(-36, y + 8); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#ffce3b";
    ctx.beginPath(); ctx.arc(-22, -24, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-22, 24, 6, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = "#fffbe8";
  const eyeScale = bite ? 1.15 : 1;
  for (const y of [-21, 21]) {
    ctx.beginPath(); ctx.ellipse(7, y, 11 * eyeScale, 10 * eyeScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#16121a";
    ctx.beginPath(); ctx.arc(11, y, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fffbe8";
  }

  ctx.fillStyle = open ? "#35101e" : "#7c2136";
  ctx.beginPath();
  ctx.ellipse(39, 0, open ? 31 : 20, open ? 30 : 13, 0, 0, Math.PI * 2);
  ctx.fill();
  drawTeeth(ctx, open);

  if (open) {
    ctx.fillStyle = index === 1 ? "#b5f85e" : "#ff5b7e";
    ctx.beginPath();
    ctx.ellipse(51, 0, bite ? 35 : 25, bite ? 11 : 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (chomper.lastCapture > 1 && chomper.phase !== "idle") {
    ctx.fillStyle = "#fff";
    ctx.font = "900 20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${chomper.lastCapture}x!`, 0, -58);
  }
  ctx.restore();
}

function drawArena(ctx, round) {
  const size = CHOMP_RULES.arenaSize;
  const center = size / 2;
  ctx.clearRect(0, 0, size, size);

  const bg = ctx.createRadialGradient(center, center, 40, center, center, 410);
  bg.addColorStop(0, "#314f43");
  bg.addColorStop(0.5, "#15352f");
  bg.addColorStop(1, "#061917");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(center, center);
  ctx.beginPath();
  ctx.arc(0, 0, 313, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.035)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,215,94,.25)";
  ctx.lineWidth = 5;
  ctx.stroke();
  for (const radius of [85, 150, 215, 275]) {
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.025)"; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();

  for (const ball of round.balls) if (ball.capturedBy == null) drawBall(ctx, ball);

  round.chompers.forEach((chomper, index) => {
    const ext = extensionFor(chomper);
    const pose = chomperPose(index, ext);
    const base = chomperPose(index, 0);
    ctx.save();
    ctx.strokeStyle = PLAYER_COLORS[index];
    ctx.lineWidth = 45;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.72;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(pose.x, pose.y); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(pose.x, pose.y); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.angle);
    const squash = chomper.phase === "retract" ? 0.96 : 1;
    ctx.scale(squash, 1 / squash);
    drawMonsterFace(ctx, chomper, index);
    ctx.restore();
  });

  if (round.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${round.flash * 0.07})`;
    ctx.fillRect(0, 0, size, size);
  }
}

function MonsterCard({ monster, index, humanCount }) {
  const human = index < humanCount;
  return (
    <article className={`chomp-monster-card monster-${index} ${human ? "human" : "bot"}`}>
      <div className="chomp-monster-portrait" aria-hidden="true"><span>👹</span></div>
      <div><small>{human ? `PLAYER ${index + 1}` : "BOT"}</small><h3>{monster.name}</h3><p>{monster.epithet}</p><kbd>{human ? monster.control : "AI"}</kbd></div>
    </article>
  );
}

function Scoreboard({ snapshot }) {
  return (
    <div className="chomp-scoreboard">
      {snapshot.chompers.map((chomper, index) => (
        <article key={chomper.id} className={`monster-${index} ${chomper.isHuman ? "human" : "bot"}`}>
          <span className="score-monster">👹</span>
          <div><small>{chomper.isHuman ? `P${index + 1}` : "BOT"} · {chomper.name}</small><strong>{chomper.score}</strong></div>
        </article>
      ))}
    </div>
  );
}

export default function ChompageddonGame() {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const roundRef = useRef(createRound({ humanCount: 1 }));
  const lastRef = useRef(0);
  const uiClockRef = useRef(0);
  const [humanCount, setHumanCount] = useState(1);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [snapshot, setSnapshot] = useState(() => ({ ...roundRef.current, chompers: roundRef.current.chompers.map((entry) => ({ ...entry })) }));
  const [status, setStatus] = useState("Pick your crew. Empty seats become bots.");

  const syncSnapshot = useCallback(() => {
    const round = roundRef.current;
    setSnapshot({ ...round, balls: round.balls, chompers: round.chompers.map((entry) => ({ ...entry })) });
  }, []);

  const startRound = useCallback(() => {
    roundRef.current = createRound({ humanCount });
    lastRef.current = performance.now();
    uiClockRef.current = 0;
    setStarted(true);
    setRunning(true);
    setStatus(humanCount === 1 ? "SPACE or click/tap the arena to CHOMP." : "Everybody on your keys. No mercy. No friendships.");
    syncSnapshot();
  }, [humanCount, syncSnapshot]);

  const chomp = useCallback((index) => {
    const round = roundRef.current;
    if (!started || !round?.chompers?.[index]?.isHuman || round.finished) return false;
    const fired = triggerChomp(round, index);
    if (fired) {
      const name = round.chompers[index].name;
      setStatus(`${name} lunges!`);
    }
    return fired;
  }, [started]);

  useEffect(() => {
    const keyHandler = (event) => {
      const index = CHOMPERS.findIndex((monster) => monster.controlCode === event.code);
      if (index < 0) return;
      const round = roundRef.current;
      if (!round?.chompers?.[index]?.isHuman) return;
      event.preventDefault();
      if (!started) startRound(); else chomp(index);
    };
    window.addEventListener("keydown", keyHandler, { passive: false });
    return () => window.removeEventListener("keydown", keyHandler);
  }, [chomp, startRound, started]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return undefined;
    let cancelled = false;

    const render = (now) => {
      if (cancelled) return;
      const round = roundRef.current;
      const dt = lastRef.current ? Math.min(0.033, (now - lastRef.current) / 1000) : 0;
      lastRef.current = now;

      if (running && !round.finished) {
        stepRound(round, dt);
        uiClockRef.current += dt;
        if (round.lastCapture) {
          const captured = round.lastCapture;
          const monster = round.chompers[captured.index];
          setStatus(captured.count > 1 ? `${monster.name} MEGA CHOMPED ${captured.count}!` : `${monster.name} swallowed one!`);
          round.lastCapture = null;
        }
        if (uiClockRef.current >= 0.12) {
          uiClockRef.current = 0;
          syncSnapshot();
        }
        if (round.finished) {
          const winners = winnersForRound(round);
          const names = winners.map((entry) => entry.name).join(" & ");
          setStatus(winners.length > 1 ? `${names} tie for the Ball Throne!` : `${names} is the undisputed Ball Goblin!`);
          setRunning(false);
          syncSnapshot();
        }
      }

      drawArena(ctx, round);
      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);
    return () => { cancelled = true; cancelAnimationFrame(frameRef.current); };
  }, [running, syncSnapshot]);

  const remaining = useMemo(() => snapshot.balls.filter((ball) => ball.capturedBy == null).length, [snapshot]);
  const timeLeft = Math.max(0, Math.ceil(CHOMP_RULES.roundSeconds - snapshot.elapsed));
  const winners = snapshot.finished ? winnersForRound(snapshot) : [];

  return (
    <main className="chompageddon-shell">
      <section className="chompageddon-page">
        <header className="chomp-header">
          <div><p className="chomp-kicker">Physics party arcade · 1–4 humans · bots fill the gaps</p><h1>CHOMPAGEDDON!</h1><p className="chomp-tagline">BALLZ WILL FLY. Monsters lunge. Balls collide. Friendships become temporary.</p></div>
          <button type="button" className="chomp-back" onClick={navigateToHub}>← All games</button>
        </header>

        {!started ? (
          <section className="chomp-launchpad">
            <div className="chomp-setup-copy"><span className="warning-tape">COUCH CHAOS ENABLED</span><h2>How many actual humans are causing problems?</h2><p>Choose 1–4 local players. Every empty monster seat becomes a bot automatically.</p>
              <div className="human-count-picker" aria-label="Number of human players">{[1,2,3,4].map((count) => <button type="button" key={count} className={humanCount === count ? "selected" : ""} onClick={() => setHumanCount(count)}><strong>{count}</strong><span>{count === 1 ? "human" : "humans"}</span></button>)}</div>
            </div>
            <div className="monster-roster">{CHOMPERS.map((monster, index) => <MonsterCard key={monster.id} monster={monster} index={index} humanCount={humanCount} />)}</div>
            <button type="button" className="release-balls" onClick={startRound}>RELEASE THE BALLZ →</button>
          </section>
        ) : (
          <>
            <Scoreboard snapshot={snapshot} />
            <section className="chomp-hud" aria-live="polite"><div><small>TIME</small><strong>{timeLeft}s</strong></div><p>{status}</p><div><small>BALLZ LEFT</small><strong>{remaining}</strong></div></section>

            <section className="chomp-arena-frame">
              <canvas
                ref={canvasRef}
                width={CHOMP_RULES.arenaSize}
                height={CHOMP_RULES.arenaSize}
                onPointerDown={() => chomp(0)}
                aria-label="Chompageddon physics arena. Player one can click or tap the arena to chomp."
              />
              {!running && snapshot.finished ? <div className="chomp-victory"><span>👑</span><h2>{winners.length > 1 ? "ABSURD TIE!" : `${winners[0]?.name || "Some monster"} WINS!`}</h2><p>{winners.length > 1 ? "Several monsters achieved identical levels of gluttony." : `${winners[0]?.score || 0} ballz consumed. Absolutely disgusting work.`}</p><button type="button" onClick={startRound}>REMATCH</button><button type="button" className="secondary" onClick={() => { setStarted(false); setRunning(false); setStatus("Pick your crew. Empty seats become bots."); }}>Change players</button></div> : null}
            </section>

            <section className="chomp-controls" aria-label="Human player chomp controls">
              {snapshot.chompers.filter((monster) => monster.isHuman).map((monster) => (
                <button type="button" key={monster.id} className={`monster-${monster.index}`} onPointerDown={(event) => { event.stopPropagation(); chomp(monster.index); }}>
                  <span>👹</span><div><small>P{monster.index + 1} · {monster.name}</small><strong>CHOMP!</strong><kbd>{monster.control}</kbd></div>
                </button>
              ))}
            </section>
          </>
        )}

        <section className="chomp-howto">
          <article><span>01</span><div><strong>Watch the bounce</strong><p>Every ball carries velocity, ricochets off the bowl, and knocks into other balls.</p></div></article>
          <article><span>02</span><div><strong>Time the lunge</strong><p>Your head extends fast, bites at full reach, then retracts. Spam badly and you miss the good clusters.</p></div></article>
          <article><span>03</span><div><strong>Get disgustingly greedy</strong><p>A single bite can capture several balls. Most swallowed when the timer or ball pile runs out wins.</p></div></article>
        </section>
      </section>
    </main>
  );
}

export const gameInfo = Object.freeze({ id: "chompageddon", name: "Chompageddon!", players: "1–4 local players" });
