import React, { useEffect, useMemo, useRef, useState } from "react";
import { PARTY_AVATARS } from "./partyRoomService";
import usePartyRoom from "./usePartyRoom";
import { partyAudio } from "./audioDirector";

function playerById(players, uid) { return players.find((p) => p.uid === uid); }
function submittedCount(object) { return Object.keys(object || {}).length; }
function scoreValue(definition, state, uid) {
  if (definition.id === "lastonealive") return Number(state?.stats?.[uid]?.score || 0);
  return Number(state?.scores?.[uid]?.score || 0);
}
function orderedByScore(definition, state, players) { return [...players].sort((a, b) => scoreValue(definition, state, b.uid) - scoreValue(definition, state, a.uid)); }

function useClock(deadline) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
}

function Timer({ deadline }) {
  const seconds = useClock(deadline);
  if (seconds == null) return null;
  return <div className={`party-timer ${seconds <= 5 ? "urgent" : ""}`} aria-label={`${seconds} seconds remaining`}><span>{seconds}</span></div>;
}

function SoundControls() {
  const [enabled, setEnabled] = useState(Boolean(partyAudio.context));
  const [music, setMusic] = useState(partyAudio.musicVolume);
  const [sfx, setSfx] = useState(partyAudio.sfxVolume);
  async function enable() {
    const ok = await partyAudio.enable();
    setEnabled(ok);
    if (ok) { partyAudio.sfx("join"); partyAudio.startMusic("lobby"); }
  }
  if (!enabled) return <button type="button" className="party-sound-enable" onClick={enable}>🔊 Enable sound</button>;
  return <div className="party-sound-controls">
    <label>Music <input type="range" min="0" max="1" step="0.05" value={music} onChange={(e) => { const v = Number(e.target.value); setMusic(v); partyAudio.setMusicVolume(v); }} /></label>
    <label>SFX <input type="range" min="0" max="1" step="0.05" value={sfx} onChange={(e) => { const v = Number(e.target.value); setSfx(v); partyAudio.setSfxVolume(v); }} /></label>
  </div>;
}

function IntroVideo({ definition, onDone }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { const timer = window.setTimeout(onDone, 4300); return () => window.clearTimeout(timer); }, [onDone]);
  return <div className={`party-intro party-intro-${definition.id}`}>
    {!failed ? <video src={definition.introVideo} autoPlay muted playsInline onEnded={onDone} onError={() => setFailed(true)} /> : null}
    {failed ? <div className="party-intro-fallback"><div className="party-intro-orbit" /><p>{definition.eyebrow}</p><h1>{definition.name}</h1></div> : null}
  </div>;
}

function ScoreStrip({ definition, state, players }) {
  const ordered = orderedByScore(definition, state, players);
  return <div className="party-score-strip">{ordered.map((p, index) => {
    const stat = state?.stats?.[p.uid];
    return <div className="party-score-chip" key={p.uid}><span>{index + 1}</span><b>{p.avatar} {p.nickname}</b><strong>{scoreValue(definition, state, p.uid)}</strong>{stat ? <small>{stat.ghost ? "👻" : "♥".repeat(stat.hearts)}</small> : null}</div>;
  })}</div>;
}

function twoPlayerLobbyCopy(definition) {
  if (definition.id === "punchline") return "DUEL MODE · The TV host judges each head-to-head and the final Crowd Pleaser.";
  if (definition.id === "doodlealibi") return "DETECTIVE MODE · The TV becomes the neutral detective and accuses the altered drawing.";
  if (definition.id === "lastonealive") return "DUEL SURVIVAL · Trivia, traps, ghosts, resurrection, and the escape finale all support two players.";
  return "";
}

function HostLobby({ table, definition }) {
  const joinUrl = `${window.location.origin}${window.location.pathname}?game=${definition.id}&room=${table.roomCode}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(joinUrl)}`;
  const readyCount = table.players.filter((p) => p.ready).length;
  const twoPlayerCopy = table.players.length === 2 ? twoPlayerLobbyCopy(definition) : "";
  useEffect(() => { if (table.players.length) partyAudio.sfx("join"); }, [table.players.length]);
  return <main className={`party-stage party-theme-${definition.id}`}>
    <div className="party-stage-lights" aria-hidden="true" />
    <header className="party-tv-bar"><div><span className="party-kicker">Family Game Room · Party Stage</span><h1>{definition.name}</h1></div><SoundControls /></header>
    <section className="party-lobby-grid">
      <div className="party-room-code-panel"><p>JOIN ON YOUR PHONE</p><div className="party-room-code">{table.roomCode}</div><p className="party-join-hint">Open this game on your phone or scan the code.</p><img className="party-qr" src={qr} alt={`QR code to join room ${table.roomCode}`} /><small>{joinUrl}</small></div>
      <div className="party-player-wall"><div className="party-wall-heading"><h2>Players</h2><strong>{readyCount}/{table.players.length} ready</strong></div><div className="party-player-grid">{table.players.map((p) => <article key={p.uid} className={`party-player-tile ${p.ready ? "ready" : ""}`}><span>{p.avatar}</span><b>{p.nickname}</b><small>{p.ready ? "READY" : "on phone…"}</small><button type="button" onClick={() => table.kick(p.uid)} aria-label={`Remove ${p.nickname}`}>×</button></article>)}</div>
        {definition.id === "punchline" ? <div className="party-lobby-settings"><label className="party-switch"><input type="checkbox" checked={table.room?.settings?.profanityFilter !== false} onChange={(e) => table.setSettings({ profanityFilter: e.target.checked })} /> Family-friendly filter</label><label>Prompt tone<select value={table.room?.settings?.spice || "cleaner"} onChange={(e) => table.setSettings({ spice: e.target.value })}><option value="cleaner">Cleaner</option><option value="spicier">Spicier PG-13</option></select></label></div> : null}
        <button className="party-primary party-start" type="button" disabled={table.busy || table.players.length < definition.minPlayers || readyCount !== table.players.length} onClick={() => { partyAudio.sfx("go"); table.start(); }}>START THE SHOW</button>
        <p className="party-minimum">{definition.minPlayers}–{definition.maxPlayers} phones · everyone must tap Ready</p>
        {twoPlayerCopy ? <p className="party-phone-help">{twoPlayerCopy}</p> : null}
      </div>
    </section>
  </main>;
}

function PhoneLobby({ table, definition }) {
  return <main className={`party-phone party-theme-${definition.id}`}><div className="party-phone-card"><div className="party-phone-logo">{definition.name}</div><div className="party-avatar-big">{table.me?.avatar}</div><h1>{table.me?.nickname}</h1><p>Room <b>{table.roomCode}</b></p><button type="button" className={`party-primary ${table.me?.ready ? "ready" : ""}`} onClick={() => { partyAudio.enable().then(() => partyAudio.sfx("ready")); table.ready(!table.me?.ready); }}>{table.me?.ready ? "✓ READY — TAP TO UNREADY" : "I'M READY"}</button><p className="party-phone-help">Keep this page open. Your controls change automatically when the TV starts the game.</p></div></main>;
}

function StagePanel({ title, kicker, timer, children }) {
  return <section className="party-stage-panel"><div className="party-stage-title"><div><span className="party-kicker">{kicker}</span><h1>{title}</h1></div><Timer deadline={timer} /></div>{children}</section>;
}
function Progress({ value, total, label }) { const pct = total ? Math.min(100, value / total * 100) : 0; return <div className="party-progress-wrap"><div className="party-progress"><span style={{ width: `${pct}%` }} /></div><b>{value}/{total} {label}</b></div>; }
function WaitingPhone({ title, text }) { return <main className="party-phone waiting"><div className="party-wait-pulse" /><h1>{title}</h1><p>{text}</p><small>Eyes on the TV</small></main>; }

function PunchlineHost({ state, players, table }) {
  const matchup = state.matchups?.[state.matchupIndex];
  const answers = matchup?.authors?.map((uid) => ({ uid, text: state.submissions?.[uid]?.[matchup.promptId] || "(ran out of time)", player: playerById(players, uid) })) || [];
  const duelMode = players.length === 2;
  if (state.phase === "answer") {
    const total = players.length * 2;
    const done = Object.values(state.submissions || {}).reduce((sum, perPlayer) => sum + Object.keys(perPlayer || {}).length, 0);
    return <StagePanel title={`ROUND ${state.round}`} kicker="WRITE TWO · KEEP THEM SECRET" timer={state.deadline}><h2 className="party-stage-bigcopy">Phones are hot. Make the room laugh.</h2><Progress value={done} total={total} label="answers locked" /></StagePanel>;
  }
  if (state.phase === "vote") {
    const hostVote = state.votes?.[table.user?.uid];
    const eligible = duelMode ? 1 : players.filter((p) => !matchup.authors.includes(p.uid)).length;
    return <StagePanel title={`ROUND ${state.round} · MATCHUP ${state.matchupIndex + 1}`} kicker={duelMode ? "DUEL MODE · TV HOST JUDGES" : "VOTE ON YOUR PHONES"} timer={state.deadline}><p className="party-prompt">{state.prompts?.[matchup?.promptId]}</p><div className="party-answer-showdown">{answers.map((a, i) => <article key={a.uid}><span>{String.fromCharCode(65 + i)}</span><strong>{a.text}</strong></article>)}</div>{duelMode ? <div className="party-answer-phone-grid">{answers.map((a, i) => <button type="button" key={a.uid} disabled={Boolean(hostVote)} onClick={() => { partyAudio.sfx("vote"); table.act({ type: "vote", choice: a.uid }); }}><span>{String.fromCharCode(65 + i)}</span>{hostVote === a.uid ? "✓ PICKED" : `PICK ${String.fromCharCode(65 + i)}`}</button>)}</div> : null}<Progress value={submittedCount(state.votes)} total={eligible} label={duelMode ? "judge decision locked" : "votes locked"} /></StagePanel>;
  }
  if (state.phase === "result") return <StagePanel title={duelMode ? "THE JUDGE HAS SPOKEN" : "THE ROOM HAS SPOKEN"} kicker="POINTS ARE LIVE"><p className="party-prompt small">{state.prompts?.[matchup?.promptId]}</p><div className="party-answer-showdown results">{answers.map((a) => { const votes = state.result?.counts?.[a.uid] || 0; const eligible = state.result?.eligible || 1; const bonus = votes === eligible && eligible > 1 ? 250 : 0; return <article key={a.uid}><div className="party-author">{a.player?.avatar} {a.player?.nickname}</div><strong>{a.text}</strong><div className="party-vote-score">{votes} vote{votes === 1 ? "" : "s"} · +{votes * 100 + bonus}</div></article>; })}</div></StagePanel>;
  if (state.phase === "finaleAnswer") return <StagePanel title="FINAL · CROWD PLEASER" kicker="EVERYBODY ANSWERS" timer={state.deadline}><p className="party-prompt">{state.finalePrompt}</p><Progress value={submittedCount(state.submissions)} total={players.length} label="final answers locked" /></StagePanel>;
  if (state.phase === "finaleVote") {
    const entries = Object.entries(state.submissions || {});
    if (duelMode) {
      const locked = state.rankings?.[table.user?.uid]?.[0];
      return <StagePanel title="TV HOST: PICK THE CROWD PLEASER" kicker="DUEL MODE · FINAL JUDGMENT" timer={state.deadline}><p className="party-prompt small">{state.finalePrompt}</p><div className="party-answer-showdown">{entries.map(([uid, text], i) => <article key={uid}><span>{String.fromCharCode(65 + i)}</span><strong>{text}</strong></article>)}</div><div className="party-answer-phone-grid">{entries.map(([uid], i) => <button type="button" key={uid} disabled={Boolean(locked)} onClick={() => { partyAudio.sfx("vote"); table.act({ type: "rankFinale", ranking: [uid] }); }}><span>{String.fromCharCode(65 + i)}</span>{locked === uid ? "✓ WINNER" : `PICK ${String.fromCharCode(65 + i)}`}</button>)}</div><Progress value={submittedCount(state.rankings)} total={1} label="final decision locked" /></StagePanel>;
    }
    return <StagePanel title="RANK YOUR TOP THREE" kicker="300 · 200 · 100 POINTS" timer={state.deadline}><p className="party-prompt small">{state.finalePrompt}</p><div className="party-finale-wall">{entries.map(([, text], i) => <article key={`${text}-${i}`}><span>{i + 1}</span>{text}</article>)}</div><Progress value={submittedCount(state.rankings)} total={players.length} label="rankings locked" /></StagePanel>;
  }
  return <FinalPodium title="PUNCHLINE CHAMPION" players={players} state={state} definitionId="punchline" extra={state.highlights?.slice().sort((a, b) => b.votes - a.votes)[0]?.answer} />;
}

function PunchlinePlayer({ state, table }) {
  const uid = table.user.uid;
  const duelMode = table.players.length === 2;
  if (state.phase === "answer") return <PunchlineAnswerPhone state={state} uid={uid} act={table.act} />;
  if (state.phase === "vote") {
    const matchup = state.matchups[state.matchupIndex];
    if (duelMode) return <WaitingPhone title="Your answers are on TV" text="Duel Mode: the TV host is judging this matchup." />;
    if (matchup.authors.includes(uid)) return <WaitingPhone title="Your answer is on TV" text="You sit this vote out. Enjoy the chaos." />;
    if (state.votes?.[uid]) return <WaitingPhone title="Vote locked" text="Look up at the TV for the reveal." />;
    return <main className="party-phone game"><p className="party-phone-kicker">VOTE</p><h1>{state.prompts[matchup.promptId]}</h1><Timer deadline={state.deadline} /><div className="party-answer-phone-grid">{matchup.authors.map((authorUid, index) => <button type="button" key={authorUid} onClick={() => { partyAudio.sfx("vote"); table.act({ type: "vote", choice: authorUid }); }}><span>{String.fromCharCode(65 + index)}</span>{state.submissions?.[authorUid]?.[matchup.promptId] || "(ran out of time)"}</button>)}</div></main>;
  }
  if (state.phase === "finaleAnswer") return <FinaleAnswerPhone state={state} table={table} />;
  if (state.phase === "finaleVote") return duelMode ? <WaitingPhone title="Final judgment" text="The TV host is choosing the Crowd Pleaser winner." /> : <FinaleRankPhone state={state} table={table} />;
  if (state.phase === "final") return <PlayerFinal definitionId="punchline" state={state} table={table} />;
  return <WaitingPhone title="Eyes on the TV" text="Results are being revealed." />;
}

function PunchlineAnswerPhone({ state, uid, act }) {
  const prompts = state.assignments?.[uid] || [];
  const [drafts, setDrafts] = useState({});
  return <main className="party-phone game"><p className="party-phone-kicker">ROUND {state.round}</p><h1>Write your punchlines</h1><Timer deadline={state.deadline} />{prompts.map((promptId, index) => { const locked = state.submissions?.[uid]?.[promptId]; return <section className={`party-prompt-card ${locked ? "locked" : ""}`} key={promptId}><small>PROMPT {index + 1}</small><h2>{state.prompts[promptId]}</h2>{locked ? <div className="party-locked-answer">✓ {locked}</div> : <><textarea maxLength={90} value={drafts[promptId] || ""} onChange={(e) => setDrafts({ ...drafts, [promptId]: e.target.value })} placeholder="Make it funny…" /><div className="party-input-row"><span>{(drafts[promptId] || "").length}/90</span><button type="button" className="party-primary" onClick={() => { partyAudio.enable().then(() => partyAudio.sfx("lock")); act({ type: "submitAnswer", promptId, answer: drafts[promptId] }); }}>LOCK IT</button></div></>}</section>; })}</main>;
}

function FinaleAnswerPhone({ state, table }) {
  const uid = table.user.uid;
  const [answer, setAnswer] = useState("");
  if (state.submissions?.[uid]) return <WaitingPhone title="Final answer locked" text={state.submissions[uid]} />;
  return <main className="party-phone game"><p className="party-phone-kicker">CROWD PLEASER</p><h1>{state.finalePrompt}</h1><Timer deadline={state.deadline} /><textarea maxLength={100} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your best shot…" /><button type="button" className="party-primary" onClick={() => table.act({ type: "submitFinale", answer })}>LOCK FINAL ANSWER</button></main>;
}

function FinaleRankPhone({ state, table }) {
  const uid = table.user.uid;
  const [ranking, setRanking] = useState([]);
  if (state.rankings?.[uid]) return <WaitingPhone title="Ranking locked" text="Top three submitted." />;
  const options = Object.entries(state.submissions || {}).filter(([authorUid]) => authorUid !== uid);
  function toggle(authorUid) { setRanking((current) => current.includes(authorUid) ? current.filter((id) => id !== authorUid) : current.length < 3 ? [...current, authorUid] : current); }
  return <main className="party-phone game"><p className="party-phone-kicker">PICK YOUR TOP 3 IN ORDER</p><h1>1st = 300 · 2nd = 200 · 3rd = 100</h1><Timer deadline={state.deadline} /><div className="party-rank-list">{options.map(([authorUid, text]) => { const place = ranking.indexOf(authorUid); return <button type="button" className={place >= 0 ? "selected" : ""} key={authorUid} onClick={() => toggle(authorUid)}><span>{place >= 0 ? place + 1 : "○"}</span>{text}</button>; })}</div><button type="button" className="party-primary" disabled={!ranking.length} onClick={() => table.act({ type: "rankFinale", ranking })}>LOCK RANKING</button></main>;
}

function LifeWall({ state, players, highlight = [] }) { return <div className="party-life-wall">{players.map((p) => { const stat = state.stats[p.uid]; return <article className={`${stat.ghost ? "ghost" : ""} ${highlight?.includes(p.uid) ? "hit" : ""}`} key={p.uid}><span>{p.avatar}</span><b>{p.nickname}</b><strong>{stat.ghost ? "👻 GHOST" : "♥".repeat(stat.hearts)}</strong><small>{stat.score} pts</small></article>; })}</div>; }

const MICRO_COPY = {
  deadButton: ["DEAD BUTTON", "Pick one sealed button. One is cursed."],
  safeDial: ["SAFE DIAL", "Stop your dial inside the glowing safe zone."],
  oddOneOut: ["ODD ONE OUT", "Nine symbols. One does not belong."],
  majorityGrave: ["MAJORITY GRAVE", "Choose A or B. The minority survives."],
  memoryMorgue: ["MEMORY MORGUE", "Remember the tray. Then identify what vanished."],
  cutWire: ["CUT THE WIRE", "One labeled wire is safe. Choose carefully."],
};

function MicrogameTV({ state, players }) {
  const [title, standardCopy] = MICRO_COPY[state.microType] || ["TRAP", "Choose carefully."];
  const copy = state.microType === "majorityGrave" && state.wrongUids.length === 1 ? "Two graves. One is safe. Pick A or B." : standardCopy;
  return <StagePanel title={title} kicker="WRONG ANSWERS HAVE CONSEQUENCES" timer={state.deadline}><p className="party-stage-bigcopy">{copy}</p>{state.microType === "safeDial" ? <div className="party-dial-tv"><span style={{ left: `${(state.target - state.width / 2) * 100}%`, width: `${state.width * 100}%` }} /></div> : null}<div className="party-doomed-row">{state.wrongUids.map((uid) => { const p = playerById(players, uid); return <span key={uid}>{p?.avatar} {p?.nickname}</span>; })}</div><Progress value={submittedCount(state.microAnswers)} total={state.wrongUids.length} label="choices locked" /></StagePanel>;
}

function EscapeTrack({ state, players }) { return <div className="party-escape-track">{players.map((p) => <div className="party-runner" key={p.uid}><span>{p.avatar}</span><b>{p.nickname}</b><div><i style={{ width: `${Math.min(100, (state.positions[p.uid] || 0) / 12 * 100)}%` }} /></div><strong>{Math.min(12, state.positions[p.uid] || 0)}/12</strong></div>)}</div>; }

function LastOneAliveHost({ state, players }) {
  const qIndex = state.phase === "resurrection" || state.phase === "resurrectionResult" ? state.resurrectionQuestion : state.phase === "finale" ? state.finaleQuestion : state.questionIndex;
  const q = state._trivia?.[qIndex];
  if (state.phase === "trivia") return <StagePanel title={`TRIVIA ${state.round} OF 6`} kicker="ANSWER BEFORE THE BELL" timer={state.deadline}><p className="party-prompt">{q?.q}</p><div className="party-tv-choices">{q?.a.map((answer, i) => <div key={answer}><span>{String.fromCharCode(65 + i)}</span>{answer}</div>)}</div><Progress value={submittedCount(state.answers)} total={players.length} label="answers locked" /></StagePanel>;
  if (state.phase === "triviaResult") return <StagePanel title="ANSWER REVEAL" kicker={state.wrongUids?.length ? `${state.wrongUids.length} HEADING TO THE TRAP` : "EVERYBODY SURVIVED"}><p className="party-prompt">{q?.q}</p><div className="party-correct-answer">✓ {q?.a?.[state.correctChoice]}</div><LifeWall state={state} players={players} /></StagePanel>;
  if (state.phase === "microgame") return <MicrogameTV state={state} players={players} />;
  if (state.phase === "microResult") return <StagePanel title={state.microLosers?.length ? "THE TRAP CLAIMS A HEART" : "EVERYBODY ESCAPED"} kicker="SURVIVAL RESULT"><LifeWall state={state} players={players} highlight={state.microLosers} /></StagePanel>;
  if (state.phase === "resurrection") return <StagePanel title="THE DEAD GET ONE SHOT" kicker="RESURRECTION ROUND" timer={state.deadline}><p className="party-prompt">{q?.q}</p><div className="party-tv-choices">{q?.a.map((answer, i) => <div key={answer}><span>{String.fromCharCode(65 + i)}</span>{answer}</div>)}</div></StagePanel>;
  if (state.phase === "resurrectionResult") { const winner = playerById(players, state.resurrectionWinner); return <StagePanel title={winner ? `${winner.nickname.toUpperCase()} IS BACK` : "THE GRAVE STAYS FULL"} kicker="RESURRECTION RESULT"><div className="party-resurrection">{winner ? `${winner.avatar} ♥` : "👻 👻 👻"}</div></StagePanel>; }
  if (state.phase === "finale") return <StagePanel title="RUN FOR THE EXIT" kicker={`ESCAPE QUESTION ${state.finaleStep}`} timer={state.deadline}><p className="party-prompt">{q?.q}</p><EscapeTrack state={state} players={players} /></StagePanel>;
  return <FinalPodium title="THE ONE WHO GOT OUT" players={players} state={state} definitionId="lastonealive" winnerUid={state.winnerUid} />;
}

function SafeDialPhone({ state, table }) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => { const x = ((now - start) % 1800) / 1800; setValue(x <= .5 ? x * 2 : (1 - x) * 2); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);
  return <main className="party-phone game horror"><p className="party-phone-kicker">SAFE DIAL</p><h1>Stop inside the safe zone</h1><Timer deadline={state.deadline} /><div className="party-dial-phone"><span className="safe" style={{ left: `${(state.target - state.width / 2) * 100}%`, width: `${state.width * 100}%` }} /><i style={{ left: `${value * 100}%` }} /></div><button type="button" className="party-primary danger" onClick={() => table.act({ type: "microAnswer", payload: { value } })}>STOP</button></main>;
}

function MemoryMorguePhone({ state, table }) {
  const [study, setStudy] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setStudy(false), 3200); return () => clearTimeout(timer); }, []);
  return <main className="party-phone game horror"><p className="party-phone-kicker">MEMORY MORGUE</p><Timer deadline={state.deadline} />{study ? <><h1>Remember this tray</h1><div className="party-memory-tray">{state.icons.map((icon) => <span key={icon}>{icon}</span>)}</div></> : <><h1>What vanished?</h1><div className="party-memory-options">{state.icons.map((icon, i) => <button type="button" key={icon} onClick={() => table.act({ type: "microAnswer", payload: { choice: i } })}>{icon}</button>)}</div></>}</main>;
}

function MicrogamePhone({ state, table }) {
  if (state.microType === "safeDial") return <SafeDialPhone state={state} table={table} />;
  if (state.microType === "deadButton") return <main className="party-phone game horror"><p className="party-phone-kicker">DEAD BUTTON</p><h1>One is cursed.</h1><Timer deadline={state.deadline} /><div className="party-dead-buttons">{Array.from({ length: 6 }).map((_, i) => <button type="button" key={i} onClick={() => table.act({ type: "microAnswer", payload: { choice: i } })}>{i + 1}</button>)}</div></main>;
  if (state.microType === "oddOneOut") return <main className="party-phone game horror"><p className="party-phone-kicker">ODD ONE OUT</p><h1>Tap the intruder</h1><Timer deadline={state.deadline} /><div className="party-symbol-grid">{state.symbols.map((symbol, i) => <button type="button" key={i} onClick={() => table.act({ type: "microAnswer", payload: { choice: i } })}>{i === state.odd ? "●" : symbol}</button>)}</div></main>;
  if (state.microType === "majorityGrave") return <main className="party-phone game horror"><p className="party-phone-kicker">MAJORITY GRAVE</p><h1>{state.wrongUids.length === 1 ? "One grave is safe. Choose." : "The minority survives."}</h1><Timer deadline={state.deadline} /><div className="party-binary"><button type="button" onClick={() => table.act({ type: "microAnswer", payload: { choice: "A" } })}>A</button><button type="button" onClick={() => table.act({ type: "microAnswer", payload: { choice: "B" } })}>B</button></div></main>;
  if (state.microType === "memoryMorgue") return <MemoryMorguePhone state={state} table={table} />;
  return <main className="party-phone game horror"><p className="party-phone-kicker">CUT THE WIRE</p><h1>Pick the safe pattern</h1><Timer deadline={state.deadline} /><div className="party-wire-list">{state.wires.map((wire, i) => <button type="button" key={wire} onClick={() => table.act({ type: "microAnswer", payload: { choice: i } })}><span className={`wire-pattern wire-${i}`} />{wire}</button>)}</div></main>;
}

function HauntPanel({ state, table }) { const uid = table.user.uid; const living = table.players.filter((p) => p.uid !== uid && !state.stats[p.uid]?.ghost); return <section className="party-haunt"><b>ONE-TIME HAUNT</b><p>Nudge one living player with a harmless distraction.</p><div>{living.map((p) => <button type="button" key={p.uid} onClick={() => table.act({ type: "haunt", targetUid: p.uid })}>{p.avatar} {p.nickname}</button>)}</div></section>; }

function LastOneAlivePlayer({ state, table }) {
  const uid = table.user.uid;
  const stat = state.stats?.[uid];
  const qIndex = state.phase === "resurrection" ? state.resurrectionQuestion : state.phase === "finale" ? state.finaleQuestion : state.questionIndex;
  const q = state._trivia?.[qIndex];
  if (state.phase === "trivia") {
    if (state.answers?.[uid]) return <WaitingPhone title={stat?.ghost ? "Ghost answer locked" : "Answer locked"} text="Look up. The TV will reveal it." />;
    return <main className="party-phone game horror"><div className="party-phone-status">{stat?.ghost ? "👻 GHOST" : `♥ ${stat?.hearts}`} · {stat?.score} pts</div><p className="party-phone-kicker">TRIVIA {state.round}</p><h1>{q?.q}</h1><Timer deadline={state.deadline} /><div className="party-choice-grid">{(q?.a || []).map((answer, choice) => <button type="button" key={answer} onClick={() => table.act({ type: "answerTrivia", choice })}><span>{String.fromCharCode(65 + choice)}</span>{answer}</button>)}</div>{stat?.ghost && !stat.hauntUsed ? <HauntPanel state={state} table={table} /> : null}</main>;
  }
  if (state.phase === "microgame") {
    if (!state.wrongUids.includes(uid)) return <WaitingPhone title="You were correct" text="Enjoy watching the others try to survive." />;
    if (state.microAnswers?.[uid]) return <WaitingPhone title="Choice locked" text="The trap is deciding your fate." />;
    return <MicrogamePhone state={state} table={table} />;
  }
  if (state.phase === "resurrection") {
    if (!stat?.ghost) return <WaitingPhone title="The ghosts are fighting back" text="You are alive. For now." />;
    if (state.resurrectionAnswers?.[uid]) return <WaitingPhone title="Resurrection answer locked" text="Fastest correct ghost comes back." />;
    return <main className="party-phone game horror"><p className="party-phone-kicker">RESURRECTION</p><h1>{q?.q}</h1><Timer deadline={state.deadline} /><div className="party-choice-grid">{(q?.a || []).map((answer, choice) => <button type="button" key={answer} onClick={() => table.act({ type: "answerResurrection", choice })}><span>{String.fromCharCode(65 + choice)}</span>{answer}</button>)}</div></main>;
  }
  if (state.phase === "finale") {
    if (state.finaleAnswers?.[uid]) return <WaitingPhone title="Keep running" text={`You are at ${state.positions?.[uid] || 0}/12.`} />;
    return <main className="party-phone game horror"><p className="party-phone-kicker">RUN FOR THE EXIT · {state.positions?.[uid] || 0}/12</p><h1>{q?.q}</h1><Timer deadline={state.deadline} /><div className="party-choice-grid">{(q?.a || []).map((answer, choice) => <button type="button" key={answer} onClick={() => table.act({ type: "answerFinale", choice })}><span>{String.fromCharCode(65 + choice)}</span>{answer}</button>)}</div></main>;
  }
  if (state.phase === "final") return <PlayerFinal definitionId="lastonealive" state={state} table={table} />;
  return <WaitingPhone title={stat?.ghost ? "You are haunting the room" : "Still alive"} text={stat?.ghost ? "Ghosts are never completely out of this game." : `You have ${stat?.hearts || 0} hearts.`} />;
}

function StrokeSvg({ strokes, label }) { return <svg className="party-drawing-svg" viewBox="0 0 1000 700" role="img" aria-label={label}>{(strokes || []).map((stroke, index) => <polyline key={index} points={(stroke.points || []).map(([x, y]) => `${x * 1000},${y * 700}`).join(" ")} fill="none" stroke={stroke.color || "#fff"} strokeWidth={(stroke.width || 4) * 2.2} strokeLinecap="round" strokeLinejoin="round" />)}</svg>; }
function DrawingGallery({ state, players, revealNames }) { const finalCase = state.round === 4; return <div className="party-drawing-gallery">{players.map((p, index) => <article key={p.uid}><div className="party-drawing-number">#{index + 1}</div>{finalCase ? <div className="party-before-after"><div><small>BEFORE</small><StrokeSvg strokes={state.beforeDrawings?.[p.uid]} label={`Drawing ${index + 1} before twist`} /></div><div><small>AFTER</small><StrokeSvg strokes={state.drawings?.[p.uid]} label={`Drawing ${index + 1} after twist`} /></div></div> : <StrokeSvg strokes={state.drawings?.[p.uid]} label={`Drawing ${index + 1}`} />}{revealNames ? <b>{p.avatar} {p.nickname}{state.suspectUids.includes(p.uid) ? " · SUSPECT" : ""}</b> : null}</article>)}</div>; }

function DoodleAlibiHost({ state, players, table }) {
  const duelMode = Boolean(state.duelMode || players.length === 2);
  if (["draw", "finalBase", "finalTwist"].includes(state.phase)) {
    const key = state.phase === "finalBase" ? "beforeDrawings" : "drawings";
    return <StagePanel title={state.round === 4 ? state.phase === "finalBase" ? "FINAL CASE · BASE DRAW" : "FINAL CASE · THE TWIST" : `CASE ${state.round}`} kicker="DRAW ON YOUR PHONES · NO PEEKING" timer={state.deadline}><p className="party-stage-bigcopy">{state.phase === "finalTwist" ? "Same drawing. New instruction. Fifteen seconds." : "Everybody has an assignment. The altered prompt is hiding in plain sight."}</p><Progress value={submittedCount(state[key])} total={players.length} label="drawings locked" /></StagePanel>;
  }
  if (state.phase === "gallery") return <StagePanel title="THE EVIDENCE WALL" kicker={duelMode ? "TV DETECTIVE · STUDY BOTH DRAWINGS" : "STUDY THE DRAWINGS"} timer={state.deadline}><DrawingGallery state={state} players={players} revealNames={false} /><Progress value={players.length} total={players.length} label="drawings revealed" /></StagePanel>;
  if (state.phase === "vote") {
    if (duelMode) {
      const locked = state.votes?.[table.user?.uid];
      return <StagePanel title="TV DETECTIVE: WHO GOT THE ALTERED PROMPT?" kicker="DETECTIVE MODE · MAKE THE ACCUSATION" timer={state.deadline}><DrawingGallery state={state} players={players} revealNames={false} /><div className="party-answer-phone-grid">{players.map((p, index) => <button type="button" key={p.uid} disabled={Boolean(locked)} onClick={() => { partyAudio.sfx("vote"); table.act({ type: "voteSuspect", targetUid: p.uid }); }}><span>#{index + 1}</span>{locked === p.uid ? "✓ ACCUSED" : `ACCUSE #${index + 1}`}</button>)}</div><Progress value={submittedCount(state.votes)} total={1} label="detective accusation locked" /></StagePanel>;
    }
    return <StagePanel title="WHO GOT THE ALTERED PROMPT?" kicker="ACCUSE ON YOUR PHONES" timer={state.deadline}><DrawingGallery state={state} players={players} revealNames={false} /><Progress value={submittedCount(state.votes)} total={players.length} label="accusations locked" /></StagePanel>;
  }
  if (state.phase === "suspectGuess") return <StagePanel title="ONE LAST ALIBI" kicker="THE SUSPECTS ARE GUESSING" timer={state.deadline}><p className="party-stage-bigcopy">Can the altered artists figure out what everybody else was actually drawing?</p><Progress value={submittedCount(state.suspectGuesses)} total={state.suspectUids.length} label="suspect guesses locked" /></StagePanel>;
  if (state.phase === "result") return <StagePanel title="CASE CLOSED" kicker={duelMode ? (state.duelJudgeCorrect ? "TV DETECTIVE GOT IT" : "THE ALTERED ARTIST FOOLED THE TV") : "IDENTITIES REVEALED"}><div className="party-case-prompts"><div><small>COMMON PROMPT</small>{state.case.common}</div><div><small>ALTERED PROMPT</small>{state.case.suspect}</div></div><DrawingGallery state={state} players={players} revealNames /><div className="party-suspect-reveal">Suspect{state.suspectUids.length > 1 ? "s" : ""}: {state.suspectUids.map((uid) => { const p = playerById(players, uid); return `${p?.avatar} ${p?.nickname}`; }).join(" · ")}</div></StagePanel>;
  return <FinalPodium title="MASTER OF THE ALIBI" players={players} state={state} definitionId="doodlealibi" />;
}

const PALETTE = ["#f7f5ef", "#17171d", "#ef5350", "#42a5f5", "#66bb6a", "#ffca28"];
function DrawingPhone({ state, table, prompt, baseStrokes = [] }) {
  const [strokes, setStrokes] = useState(() => structuredClone(baseStrokes || []));
  const [color, setColor] = useState(PALETTE[0]);
  const [width, setWidth] = useState(5);
  const active = useRef(null);
  const svgRef = useRef(null);
  function point(event) { const rect = svgRef.current.getBoundingClientRect(); return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]; }
  function down(event) { event.preventDefault(); svgRef.current.setPointerCapture?.(event.pointerId); const stroke = { color, width, points: [point(event)] }; active.current = stroke; setStrokes((current) => [...current, stroke]); partyAudio.enable().then(() => partyAudio.sfx("draw")); }
  function move(event) { if (!active.current) return; const p = point(event); active.current.points.push(p); setStrokes((current) => [...current.slice(0, -1), { ...active.current, points: [...active.current.points] }]); }
  function up() { active.current = null; }
  return <main className="party-phone game doodle drawing"><p className="party-phone-kicker">YOUR SECRET ASSIGNMENT</p><h1>{prompt}</h1><Timer deadline={state.deadline} /><div className="party-draw-toolbar"><div>{PALETTE.map((item) => <button type="button" key={item} className={color === item ? "selected" : ""} style={{ background: item }} onClick={() => setColor(item)} aria-label={`Brush color ${item}`} />)}</div><div>{[3, 6, 10].map((size) => <button type="button" key={size} className={width === size ? "selected" : ""} onClick={() => setWidth(size)}>{size === 3 ? "•" : size === 6 ? "●" : "⬤"}</button>)}</div><button type="button" onClick={() => setStrokes((current) => current.slice(0, -1))}>Undo</button><button type="button" onClick={() => setStrokes([])}>Clear</button></div><svg ref={svgRef} className="party-draw-canvas" viewBox="0 0 1000 700" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>{strokes.map((stroke, index) => <polyline key={index} points={stroke.points.map(([x, y]) => `${x * 1000},${y * 700}`).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.width * 2.2} strokeLinecap="round" strokeLinejoin="round" />)}</svg><button type="button" className="party-primary" disabled={!strokes.length} onClick={() => table.act({ type: "submitDrawing", strokes })}>LOCK DRAWING</button></main>;
}

function DoodleAlibiPlayer({ state, table }) {
  const uid = table.user.uid;
  const suspect = state.suspectUids?.includes(uid);
  const duelMode = Boolean(state.duelMode || table.players.length === 2);
  if (["draw", "finalBase", "finalTwist"].includes(state.phase)) {
    const key = state.phase === "finalBase" ? "beforeDrawings" : "drawings";
    if (state[key]?.[uid]) return <WaitingPhone title="Drawing locked" text="Do not reveal your prompt. Look up at the TV." />;
    const prompt = state.phase === "finalBase" ? state.case.base : state.phase === "finalTwist" ? (suspect ? state.case.twistSuspect : state.case.twistCommon) : (suspect ? state.case.suspect : state.case.common);
    return <DrawingPhone key={`${state.round}-${state.phase}`} state={state} table={table} prompt={prompt} baseStrokes={state.phase === "finalTwist" ? state.beforeDrawings?.[uid] : []} />;
  }
  if (state.phase === "vote") {
    if (duelMode) return <WaitingPhone title="The TV is investigating" text="Detective Mode: keep a straight face while the TV chooses the altered drawing." />;
    if (state.votes?.[uid]) return <WaitingPhone title="Accusation locked" text="Now watch the case unravel on TV." />;
    return <main className="party-phone game doodle"><p className="party-phone-kicker">MAKE YOUR ACCUSATION</p><h1>Which drawing got the altered prompt?</h1><Timer deadline={state.deadline} /><div className="party-phone-gallery">{table.players.map((p, index) => p.uid === uid ? null : <button type="button" key={p.uid} onClick={() => table.act({ type: "voteSuspect", targetUid: p.uid })}><StrokeSvg strokes={state.drawings?.[p.uid]} label={`Drawing ${index + 1}`} /><span>#{index + 1}</span></button>)}</div></main>;
  }
  if (state.phase === "suspectGuess") {
    if (!suspect) return <WaitingPhone title="The suspect is scrambling" text={duelMode ? "The altered artist gets one last chance to identify your prompt." : "You have made your accusation."} />;
    if (state.suspectGuesses?.[uid]) return <WaitingPhone title="Alibi locked" text="Let's see if you guessed the common prompt." />;
    return <main className="party-phone game doodle"><p className="party-phone-kicker">SUSPECT BONUS</p><h1>What was everybody else asked to draw?</h1><Timer deadline={state.deadline} /><div className="party-common-options">{state.commonOptions.map((option) => <button type="button" key={option} onClick={() => table.act({ type: "guessCommon", guess: option })}>{option}</button>)}</div></main>;
  }
  if (state.phase === "final") return <PlayerFinal definitionId="doodlealibi" state={state} table={table} />;
  return <WaitingPhone title="Eyes on the evidence wall" text="Study every drawing before the accusation begins." />;
}

function FinalPodium({ title, players, state, definitionId, winnerUid, extra }) {
  const definition = { id: definitionId };
  const ordered = winnerUid ? [playerById(players, winnerUid), ...orderedByScore(definition, state, players).filter((p) => p.uid !== winnerUid)].filter(Boolean) : orderedByScore(definition, state, players);
  const podium = [ordered[1], ordered[0], ordered[2]];
  return <StagePanel title={title} kicker="FINAL RESULTS"><div className="party-podium">{podium.map((p, index) => p ? <article key={p.uid}><span>{p.avatar}</span><b>{p.nickname}</b><strong>{scoreValue(definition, state, p.uid)} pts</strong><i>{index === 1 ? "1" : index === 0 ? "2" : "3"}</i></article> : null)}</div>{extra ? <div className="party-best-line"><small>ROOM FAVORITE</small>“{extra}”</div> : null}<div className="party-fanfare">★ THANKS FOR PLAYING ★</div></StagePanel>;
}

function PlayerFinal({ definitionId, state, table }) { const uid = table.user.uid; const def = { id: definitionId }; const ordered = orderedByScore(def, state, table.players); const rank = Math.max(1, ordered.findIndex((p) => p.uid === uid) + 1); return <main className="party-phone final"><div className="party-avatar-big">{table.me?.avatar}</div><p className="party-phone-kicker">FINAL RESULT</p><h1>#{rank}</h1><h2>{scoreValue(def, state, uid)} points</h2><p>Look up at the TV for the full podium.</p></main>; }

function interactionComplete(definition, state, players, hostUid) {
  if (!state) return false;
  if (definition.id === "punchline") {
    if (state.phase === "answer") return players.every((p) => (state.assignments?.[p.uid] || []).every((id) => state.submissions?.[p.uid]?.[id]));
    if (state.phase === "vote") {
      if (players.length === 2) return Boolean(state.votes?.[hostUid]);
      const matchup = state.matchups[state.matchupIndex];
      return players.filter((p) => !matchup.authors.includes(p.uid)).every((p) => state.votes?.[p.uid]);
    }
    if (state.phase === "finaleAnswer") return players.every((p) => state.submissions?.[p.uid]);
    if (state.phase === "finaleVote") return players.length === 2 ? Boolean(state.rankings?.[hostUid]) : players.every((p) => state.rankings?.[p.uid]);
  }
  if (definition.id === "lastonealive") {
    if (state.phase === "trivia") return players.every((p) => state.answers?.[p.uid]);
    if (state.phase === "microgame") return state.wrongUids.every((uid) => state.microAnswers?.[uid]);
    if (state.phase === "resurrection") return players.filter((p) => state.stats[p.uid]?.ghost).every((p) => state.resurrectionAnswers?.[p.uid]);
    if (state.phase === "finale") return players.every((p) => state.finaleAnswers?.[p.uid]);
  }
  if (definition.id === "doodlealibi") {
    if (state.phase === "draw" || state.phase === "finalTwist") return players.every((p) => state.drawings?.[p.uid]);
    if (state.phase === "finalBase") return players.every((p) => state.beforeDrawings?.[p.uid]);
    if (state.phase === "vote") return state.duelMode ? Boolean(state.votes?.[hostUid]) : players.every((p) => state.votes?.[p.uid]);
    if (state.phase === "suspectGuess") return state.suspectUids.every((uid) => state.suspectGuesses?.[uid]);
  }
  return false;
}

function phaseSting(phase) {
  if (["result", "triviaResult", "microResult", "resurrectionResult"].includes(phase)) return "reveal";
  if (phase === "final") return "fanfare";
  if (phase === "finale") return "go";
  if (["vote", "suspectGuess"].includes(phase)) return "vote";
  if (phase === "microgame") return "eliminate";
  return "tick";
}

function GameStage({ table, definition }) {
  const [intro, setIntro] = useState(true);
  const state = useMemo(() => {
    if (!table.room?.gameState) return null;
    if (definition.id === "lastonealive") return { ...table.room.gameState, _trivia: definition.trivia };
    return table.room.gameState;
  }, [table.room?.gameState, definition]);
  const lastPhase = useRef("");

  useEffect(() => {
    if (!table.isHost || !state) return;
    partyAudio.startMusic(state.phase === "final" ? "finale" : definition.music);
    if (lastPhase.current && lastPhase.current !== state.phase) partyAudio.sfx(phaseSting(state.phase));
    lastPhase.current = state.phase;
  }, [table.isHost, state?.phase, definition.music]);

  useEffect(() => {
    if (!table.isHost || !state || state.phase === "final") return undefined;
    const early = interactionComplete(definition, state, table.players, table.user?.uid);
    const transitional = ["result", "triviaResult", "microResult", "resurrectionResult", "gallery"].includes(state.phase);
    const delay = early ? 900 : state.deadline ? Math.max(150, state.deadline - Date.now() + 120) : transitional ? 3500 : null;
    if (delay == null) return undefined;
    const timer = window.setTimeout(() => table.act({ type: "hostAdvance", force: true }), delay);
    return () => window.clearTimeout(timer);
  }, [table.isHost, state, definition, table.players.length, table.user?.uid]);

  if (table.isHost && intro) return <IntroVideo definition={definition} onDone={() => { setIntro(false); partyAudio.startMusic(definition.music); partyAudio.sfx("go"); }} />;
  if (table.isHost) return <main className={`party-stage party-theme-${definition.id}`}><div className="party-stage-lights" aria-hidden="true" /><header className="party-tv-bar compact"><div><span className="party-kicker">{definition.name}</span><strong>ROOM {table.roomCode}</strong></div><SoundControls /></header><ScoreStrip definition={definition} state={state} players={table.players} />{definition.id === "punchline" ? <PunchlineHost state={state} players={table.players} table={table} /> : definition.id === "lastonealive" ? <LastOneAliveHost state={state} players={table.players} /> : <DoodleAlibiHost state={state} players={table.players} table={table} />}<div className="party-host-tools"><button type="button" onClick={() => table.act({ type: "hostAdvance", force: true })}>Skip / advance</button></div></main>;
  if (definition.id === "punchline") return <PunchlinePlayer state={state} table={table} />;
  if (definition.id === "lastonealive") return <LastOneAlivePlayer state={state} table={table} />;
  return <DoodleAlibiPlayer state={state} table={table} />;
}

function EntryScreen({ table, definition }) {
  const [joinOpen, setJoinOpen] = useState(table.mode === "join");
  if (!table.firebaseReady) return <main className="party-entry"><section><h1>Firebase is not configured</h1><p>This game uses the same Firebase setup as the rest of Family Game Room.</p></section></main>;
  return <main className={`party-entry party-theme-${definition.id}`}><div className="party-stage-lights" aria-hidden="true" /><section className="party-entry-card"><span className="party-kicker">FAMILY GAME ROOM · PARTY STAGE</span><h1>{definition.name}</h1><p>{definition.description}</p>{table.error ? <div className="party-error" role="alert">{table.error}</div> : null}{!joinOpen ? <div className="party-entry-actions"><button type="button" className="party-primary" disabled={!table.user || table.busy} onClick={table.host}>HOST ON THIS SCREEN</button><button type="button" className="party-secondary" onClick={() => setJoinOpen(true)}>JOIN FROM A PHONE</button></div> : <div className="party-join-form"><label>ROOM CODE<input value={table.joinCode} maxLength={4} inputMode="text" autoCapitalize="characters" onChange={(e) => table.setJoinCode(e.target.value.toUpperCase())} /></label><label>YOUR NAME<input value={table.nickname} maxLength={18} autoComplete="nickname" onChange={(e) => table.setNickname(e.target.value)} /></label><div className="party-avatar-picker">{PARTY_AVATARS.map((avatar) => <button type="button" key={avatar} className={table.avatar === avatar ? "selected" : ""} onClick={() => table.setAvatar(avatar)}>{avatar}</button>)}</div><button type="button" className="party-primary" disabled={!table.user || table.busy || table.joinCode.length < 4 || !table.nickname.trim()} onClick={table.join}>JOIN ROOM</button><button type="button" className="party-link" onClick={() => setJoinOpen(false)}>← Host instead</button></div>}<small>{definition.minPlayers}–{definition.maxPlayers} players · phones are controllers · TV is the stage</small></section></main>;
}

export default function PartyStageGame({ definition }) {
  const table = usePartyRoom(definition);
  if (!table.roomCode || !table.room) return <EntryScreen table={table} definition={definition} />;
  if (table.room.status === "lobby") return table.isHost ? <HostLobby table={table} definition={definition} /> : <PhoneLobby table={table} definition={definition} />;
  return <GameStage table={table} definition={definition} />;
}
