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
import useChompOnlineRoom from "./useChompOnlineRoom";
import "./styles.css";
import "./online.css";

const PLAYER_COLORS = ["#ec4de6", "#73e14d", "#43bdf6", "#ff843c"];
const ONLINE_SNAPSHOT_INTERVAL = 0.08;

function cloneRound(round) {
  return round ? JSON.parse(JSON.stringify(round)) : round;
}

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

function OnlineScoreboard({ snapshot, players }) {
  const bySeat = new Map(players.map((player) => [Number(player.seat), player]));
  return (
    <div className="chomp-scoreboard chomp-online-scoreboard">
      {snapshot.chompers.map((chomper, index) => {
        const player = bySeat.get(index);
        return (
          <article key={chomper.id} className={`monster-${index} ${player ? "human" : "bot"} ${player?.connected === false ? "disconnected" : ""}`}>
            <span className="score-monster">👹</span>
            <div>
              <small>{player ? player.nickname : "BOT"} · {chomper.name}</small>
              <strong>{chomper.score}</strong>
              {player?.connected === false ? <em>BOT takeover</em> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function HowTo() {
  return (
    <section className="chomp-howto">
      <article><span>01</span><div><strong>Watch the bounce</strong><p>Every ball carries velocity, ricochets off the bowl, and knocks into other balls.</p></div></article>
      <article><span>02</span><div><strong>Time the lunge</strong><p>Your head extends fast, bites at full reach, then retracts. Spam badly and you miss the good clusters.</p></div></article>
      <article><span>03</span><div><strong>Get disgustingly greedy</strong><p>A single bite can capture several balls. Most swallowed when the timer or ball pile runs out wins.</p></div></article>
    </section>
  );
}

function ModeChooser({ onLocal, onOnline }) {
  return (
    <main className="chompageddon-shell">
      <section className="chompageddon-page">
        <header className="chomp-header">
          <div><p className="chomp-kicker">Physics party arcade · local or online</p><h1>CHOMPAGEDDON!</h1><p className="chomp-tagline">BALLZ WILL FLY. Monsters lunge. Balls collide. Friendships become temporary.</p></div>
          <button type="button" className="chomp-back" onClick={navigateToHub}>← All games</button>
        </header>
        <section className="chomp-mode-launchpad">
          <div className="chomp-mode-heading"><span className="warning-tape">CHOOSE YOUR CHAOS</span><h2>How are we destroying friendships today?</h2><p>Play on one device, or give every monster its own browser and settle this over the internet.</p></div>
          <div className="chomp-mode-grid">
            <button type="button" className="chomp-mode-card" onClick={onLocal}>
              <span className="chomp-mode-icon">🛋️</span><small>ONE SCREEN</small><strong>SOLO / COUCH</strong><p>1 human vs bots, or 2–4 humans sharing the same device and keyboard.</p><b>PLAY LOCAL →</b>
            </button>
            <button type="button" className="chomp-mode-card online" onClick={onOnline}>
              <span className="chomp-mode-icon">🌐</span><small>ROOM CODE</small><strong>ONLINE CHOMPAGEDDON</strong><p>2–4 humans on separate devices. Empty seats become bots. One shared arena.</p><b>GO ONLINE →</b>
            </button>
          </div>
        </section>
        <HowTo />
      </section>
    </main>
  );
}

function LocalChompageddonGame({ onBackToModes }) {
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
          <div><p className="chomp-kicker">Physics party arcade · solo / couch mode</p><h1>CHOMPAGEDDON!</h1><p className="chomp-tagline">BALLZ WILL FLY. Monsters lunge. Balls collide. Friendships become temporary.</p></div>
          <div className="chomp-header-actions"><button type="button" className="chomp-back" onClick={onBackToModes}>← Modes</button><button type="button" className="chomp-back" onClick={navigateToHub}>All games</button></div>
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

        <HowTo />
      </section>
    </main>
  );
}

function OnlineRoomRoster({ table }) {
  const bySeat = new Map(table.players.map((player) => [Number(player.seat), player]));
  return (
    <div className="chomp-online-roster">
      {CHOMPERS.map((monster, seat) => {
        const player = bySeat.get(seat);
        return (
          <article key={monster.id} className={`monster-${seat} ${player ? "occupied" : "bot"} ${player?.ready ? "ready" : ""}`}>
            <span className="chomp-online-monster">👹</span>
            <div><small>{player ? `PLAYER ${seat + 1}` : "BOT IF EMPTY"}</small><h3>{monster.name}</h3><p>{player ? player.nickname : monster.epithet}</p></div>
            <strong className="chomp-ready-state">{player ? (player.connected === false ? "OFFLINE" : player.ready ? "READY" : "NOT READY") : "AI"}</strong>
          </article>
        );
      })}
    </div>
  );
}

function OnlineChompageddonGame({ onBackToModes }) {
  const table = useChompOnlineRoom();
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const roundRef = useRef(createRound({ humanCount: 4 }));
  const lastRef = useRef(0);
  const publishClockRef = useRef(0);
  const publishBusyRef = useRef(false);
  const activeRoundIdRef = useRef("");
  const lastInputSeqRef = useRef({});
  const tableRef = useRef(table);
  const playersRef = useRef(table.players);
  const statusRef = useRef("Create or join a room. Then get greedy.");
  const [snapshot, setSnapshot] = useState(() => cloneRound(roundRef.current));
  const [status, setStatus] = useState(statusRef.current);
  const [copied, setCopied] = useState(false);

  tableRef.current = table;
  playersRef.current = table.players;

  const setArenaStatus = useCallback((message) => {
    statusRef.current = message;
    setStatus(message);
  }, []);

  const syncOnlineSnapshot = useCallback(() => {
    setSnapshot(cloneRound(roundRef.current));
  }, []);

  const gameVisible = table.room?.status === "playing" || table.room?.status === "finished";
  const roomSnapshot = table.room?.gameState?.snapshot;
  const roundId = table.room?.gameState?.roundId || "";

  useEffect(() => {
    if (!roomSnapshot || !roundId) return;
    const isNewRound = activeRoundIdRef.current !== roundId;
    if (isNewRound || !table.isHost) {
      roundRef.current = cloneRound(roomSnapshot);
      setSnapshot(cloneRound(roomSnapshot));
    }
    if (isNewRound) {
      activeRoundIdRef.current = roundId;
      lastRef.current = performance.now();
      publishClockRef.current = 0;
      lastInputSeqRef.current = Object.fromEntries(table.players.map((player) => [player.uid, Number(table.room?.inputs?.[player.uid]?.seq || 0)]));
    }
    if (table.room?.gameState?.message) setArenaStatus(table.room.gameState.message);
  }, [roundId, table.room?.gameState?.updatedAt, table.isHost, roomSnapshot, table.players, table.room?.inputs, setArenaStatus]);

  useEffect(() => {
    if (!table.isHost || table.room?.status !== "playing") return;
    for (const player of table.players) {
      if (player.uid === table.user?.uid) continue;
      const seq = Number(table.room?.inputs?.[player.uid]?.seq || 0);
      const previous = Number(lastInputSeqRef.current[player.uid] || 0);
      if (seq <= previous) continue;
      lastInputSeqRef.current[player.uid] = seq;
      if (player.connected === false) continue;
      const seat = Number(player.seat);
      if (triggerChomp(roundRef.current, seat)) setArenaStatus(`${player.nickname}'s ${CHOMPERS[seat]?.name || "monster"} lunges!`);
    }
  }, [table.room?.inputs, table.room?.status, table.players, table.isHost, table.user?.uid, setArenaStatus]);

  useEffect(() => {
    if (!gameVisible) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return undefined;
    let cancelled = false;

    const render = (now) => {
      if (cancelled) return;
      const currentTable = tableRef.current;
      const round = roundRef.current;
      const dt = lastRef.current ? Math.min(0.033, (now - lastRef.current) / 1000) : 0;
      lastRef.current = now;

      if (currentTable.isHost && currentTable.room?.status === "playing" && !round.finished) {
        const connectedSeats = new Set(playersRef.current.filter((player) => player.connected !== false).map((player) => Number(player.seat)));
        round.chompers.forEach((chomper) => { chomper.isHuman = connectedSeats.has(chomper.index); });
        stepRound(round, dt);
        publishClockRef.current += dt;

        if (round.lastCapture) {
          const captured = round.lastCapture;
          const monster = round.chompers[captured.index];
          const player = playersRef.current.find((candidate) => Number(candidate.seat) === captured.index);
          const owner = player?.nickname || monster.name;
          setArenaStatus(captured.count > 1 ? `${owner} MEGA CHOMPED ${captured.count}!` : `${owner} swallowed one!`);
          round.lastCapture = null;
        }

        if (publishClockRef.current >= ONLINE_SNAPSHOT_INTERVAL) {
          publishClockRef.current = 0;
          syncOnlineSnapshot();
          if (!publishBusyRef.current) {
            publishBusyRef.current = true;
            currentTable.publish(cloneRound(round), statusRef.current, false).finally(() => { publishBusyRef.current = false; });
          }
        }

        if (round.finished) {
          const winners = winnersForRound(round);
          const playerNames = winners.map((winner) => playersRef.current.find((player) => Number(player.seat) === winner.index)?.nickname || winner.name);
          const finalStatus = winners.length > 1 ? `${playerNames.join(" & ")} tie for the Ball Throne!` : `${playerNames[0]} is the undisputed Ball Goblin!`;
          setArenaStatus(finalStatus);
          syncOnlineSnapshot();
          currentTable.publish(cloneRound(round), finalStatus, true);
        }
      }

      drawArena(ctx, round);
      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);
    return () => { cancelled = true; cancelAnimationFrame(frameRef.current); };
  }, [gameVisible, setArenaStatus, syncOnlineSnapshot]);

  const mySeat = Number(table.me?.seat);
  const myMonster = Number.isInteger(mySeat) ? CHOMPERS[mySeat] : null;

  const chompOnline = useCallback(() => {
    const current = tableRef.current;
    if (current.room?.status !== "playing" || !current.me || current.me.connected === false) return false;
    const seat = Number(current.me.seat);
    if (current.isHost) {
      const fired = triggerChomp(roundRef.current, seat);
      if (fired) setArenaStatus(`${current.me.nickname}'s ${CHOMPERS[seat]?.name || "monster"} lunges!`);
      return fired;
    }
    current.chomp();
    return true;
  }, [setArenaStatus]);

  useEffect(() => {
    if (table.room?.status !== "playing") return undefined;
    const handler = (event) => {
      if (event.code !== "Space" && event.code !== "Enter" && event.code !== myMonster?.controlCode) return;
      event.preventDefault();
      chompOnline();
    };
    window.addEventListener("keydown", handler, { passive: false });
    return () => window.removeEventListener("keydown", handler);
  }, [table.room?.status, myMonster?.controlCode, chompOnline]);

  const buildRound = useCallback(() => {
    const next = createRound({ humanCount: 4 });
    const humanSeats = new Set(table.players.filter((player) => player.connected !== false).map((player) => Number(player.seat)));
    next.chompers.forEach((chomper) => { chomper.isHuman = humanSeats.has(chomper.index); });
    return next;
  }, [table.players]);

  const startOnlineRound = useCallback(async (rematch = false) => {
    const next = buildRound();
    const gameState = await table.start(cloneRound(next), { rematch });
    if (!gameState) return;
    roundRef.current = cloneRound(gameState.snapshot);
    activeRoundIdRef.current = gameState.roundId;
    lastRef.current = performance.now();
    publishClockRef.current = 0;
    lastInputSeqRef.current = Object.fromEntries(table.players.map((player) => [player.uid, Number(table.room?.inputs?.[player.uid]?.seq || 0)]));
    setArenaStatus(gameState.message || "BALLZ RELEASED. CHOMP!");
    syncOnlineSnapshot();
  }, [buildRound, table, setArenaStatus, syncOnlineSnapshot]);

  const remaining = useMemo(() => snapshot.balls.filter((ball) => ball.capturedBy == null).length, [snapshot]);
  const timeLeft = Math.max(0, Math.ceil(CHOMP_RULES.roundSeconds - snapshot.elapsed));
  const winners = snapshot.finished ? winnersForRound(snapshot) : [];
  const winnerNames = winners.map((winner) => table.players.find((player) => Number(player.seat) === winner.index)?.nickname || winner.name);
  const readyCount = table.players.filter((player) => player.ready && player.connected !== false).length;
  const allReady = table.players.length >= 2 && readyCount === table.players.length;
  const joinUrl = table.roomCode ? `${window.location.origin}${window.location.pathname}?game=chompageddon&room=${table.roomCode}` : "";

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function exitOnline(destination = "modes") {
    await table.leave();
    if (destination === "hub") navigateToHub();
    else onBackToModes();
  }

  return (
    <main className="chompageddon-shell">
      <section className="chompageddon-page">
        <header className="chomp-header">
          <div><p className="chomp-kicker">Physics party arcade · online mode</p><h1>CHOMPAGEDDON!</h1><p className="chomp-tagline">One shared ball pit. Up to four browsers. Absolutely no mercy.</p></div>
          <div className="chomp-header-actions"><button type="button" className="chomp-back" onClick={() => exitOnline("modes")}>← Modes</button><button type="button" className="chomp-back" onClick={() => exitOnline("hub")}>All games</button></div>
        </header>

        {!table.firebaseReady ? <section className="chomp-online-error"><h2>Online play needs Firebase</h2><p>The local game still works, but this deployment is missing its Firebase configuration.</p></section> : null}
        {table.error ? <div className="chomp-online-error" role="alert">{table.error}</div> : null}

        {table.firebaseReady && table.mode === "choose" ? (
          <section className="chomp-online-entry">
            <span className="warning-tape">INTERNET CHAOS ENABLED</span><h2>Host a fresh disaster or join one already in progress.</h2><p>Each human gets one monster on their own device. Two players minimum; bots take any empty seats.</p>
            <div className="chomp-online-entry-actions"><button type="button" onClick={() => table.setMode("host")}>HOST A GAME</button><button type="button" className="secondary" onClick={() => table.setMode("join")}>JOIN WITH CODE</button></div>
          </section>
        ) : null}

        {table.firebaseReady && (table.mode === "host" || table.mode === "join") ? (
          <section className="chomp-online-form-wrap">
            <form className="chomp-online-form" onSubmit={(event) => { event.preventDefault(); if (table.mode === "host") table.host(); else table.join(); }}>
              <span className="warning-tape">{table.mode === "host" ? "CREATE ROOM" : "JOIN ROOM"}</span>
              <h2>{table.mode === "host" ? "Name the host monster." : "Enter the arena."}</h2>
              <label>Nickname<input autoFocus maxLength={18} value={table.nickname} onChange={(event) => table.setNickname(event.target.value)} placeholder="Your name" /></label>
              {table.mode === "join" ? <label>Room code<input maxLength={4} value={table.joinCode} onChange={(event) => table.setJoinCode(event.target.value.toUpperCase())} placeholder="ABCD" /></label> : null}
              <div className="chomp-online-entry-actions"><button type="submit" disabled={table.busy || !table.user || !table.nickname.trim()}>{table.busy ? "CONNECTING…" : table.mode === "host" ? "CREATE CHOMP ROOM" : "JOIN CHOMP ROOM"}</button><button type="button" className="secondary" onClick={() => table.setMode("choose")}>BACK</button></div>
            </form>
          </section>
        ) : null}

        {table.firebaseReady && table.mode === "room" && table.room?.status === "lobby" ? (
          <section className="chomp-online-lobby">
            <div className="chomp-online-lobby-top">
              <div><span className="warning-tape">ONLINE LOBBY</span><h2>Room <strong>{table.roomCode}</strong></h2><p>{table.isHost ? "Share the code or link. Start when every connected human is ready." : `You are ${myMonster?.name || "a monster"}. Ready up when your thumbs are prepared.`}</p></div>
              <div className="chomp-online-code-actions"><button type="button" onClick={copyJoinLink}>{copied ? "COPIED!" : "COPY JOIN LINK"}</button><small>{joinUrl}</small></div>
            </div>
            <OnlineRoomRoster table={table} />
            <div className="chomp-online-lobby-actions">
              {table.isHost ? <button type="button" className="release-balls" disabled={table.busy || !allReady} onClick={() => startOnlineRound(false)}>RELEASE THE BALLZ ONLINE →</button> : <button type="button" className={`release-balls ${table.me?.ready ? "ready" : ""}`} disabled={table.busy} onClick={() => table.ready(!table.me?.ready)}>{table.me?.ready ? "✓ READY — TAP TO UNREADY" : "I'M READY TO CHOMP"}</button>}
              <p>{table.players.length}/4 humans · {readyCount}/{table.players.length} ready · empty seats become bots</p>
            </div>
          </section>
        ) : null}

        {table.firebaseReady && table.mode === "room" && gameVisible ? (
          <>
            <div className="chomp-online-roombar"><span>🌐 ROOM <b>{table.roomCode}</b></span><span>{table.me?.nickname} = <b>{myMonster?.name}</b></span><span>{table.isHost ? "HOST / PHYSICS AUTHORITY" : "CONNECTED PLAYER"}</span></div>
            <OnlineScoreboard snapshot={snapshot} players={table.players} />
            <section className="chomp-hud" aria-live="polite"><div><small>TIME</small><strong>{timeLeft}s</strong></div><p>{status}</p><div><small>BALLZ LEFT</small><strong>{remaining}</strong></div></section>

            <section className="chomp-arena-frame chomp-online-arena">
              <canvas ref={canvasRef} width={CHOMP_RULES.arenaSize} height={CHOMP_RULES.arenaSize} onPointerDown={chompOnline} aria-label={`Online Chompageddon arena. You control ${myMonster?.name || "your monster"}. Tap or press Space to chomp.`} />
              {table.room?.status === "finished" ? <div className="chomp-victory"><span>👑</span><h2>{winners.length > 1 ? "ABSURD ONLINE TIE!" : `${winnerNames[0] || "Some monster"} WINS!`}</h2><p>{winners.length > 1 ? `${winnerNames.join(" & ")} achieved identical levels of internet gluttony.` : `${winners[0]?.score || 0} ballz consumed. Across the internet. Disgusting.`}</p>{table.isHost ? <><button type="button" onClick={() => startOnlineRound(true)}>INSTANT REMATCH</button><button type="button" className="secondary" onClick={() => table.lobby()}>RETURN TO LOBBY</button></> : <p className="chomp-online-waiting">Waiting for the host to choose rematch or lobby…</p>}</div> : null}
            </section>

            {table.room?.status === "playing" ? <section className="chomp-online-control" aria-label="Your online Chompageddon control"><button type="button" className={`monster-${mySeat}`} onPointerDown={(event) => { event.stopPropagation(); chompOnline(); }}><span>👹</span><div><small>{table.me?.nickname} · {myMonster?.name}</small><strong>CHOMP!</strong><kbd>SPACE / TAP</kbd></div></button><p>Only your monster responds on this device. Every other human controls their own browser.</p></section> : null}
          </>
        ) : null}

        <HowTo />
      </section>
    </main>
  );
}

function initialMode() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("room") ? "online" : "";
}

export default function ChompageddonGame() {
  const [playMode, setPlayMode] = useState(initialMode);
  if (!playMode) return <ModeChooser onLocal={() => setPlayMode("local")} onOnline={() => setPlayMode("online")} />;
  if (playMode === "online") return <OnlineChompageddonGame onBackToModes={() => setPlayMode("")} />;
  return <LocalChompageddonGame onBackToModes={() => setPlayMode("")} />;
}

export const gameInfo = Object.freeze({ id: "chompageddon", name: "Chompageddon!", players: "1–4 local or 2–4 online players" });
