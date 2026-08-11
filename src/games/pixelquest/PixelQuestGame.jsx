import React, { useEffect, useMemo, useRef, useState } from "react";
import useModularTable from "../../platform/useModularTable";
import { navigateToHub } from "../../HubApp";
import { ADVENTURES, ADVENTURE_BY_ID, ENEMIES, HEROES, HERO_BY_ID } from "./data.js";
import {
  currentAdventure,
  currentCombatActor,
  currentScene,
  reachableCells,
  tileLegend,
} from "./engine.js";
import { localNarrator } from "./dm.js";
import { createPixelQuestGameState, pixelQuestSeatForUid, reducePixelQuest } from "./network.js";
import "./styles.css";

const HERO_PATTERNS = [
  ["..111...", ".12221..", ".12221..", "..111...", ".23332..", ".23332..", ".3..3...", "33..33.."],
  ["...11...", "..1221..", "..1221..", ".111111.", "..333...", ".33333..", "..3.3...", ".33.33.."],
  ["..111...", ".12221..", "..121...", ".33333..", "..333...", "..333...", ".33.33..", "33...33."],
  ["..111...", ".12221..", "..111...", ".3333...", "333333..", ".3333...", "..3.3...", ".33.33.."],
  ["..111...", ".12221..", "..111...", "...3....", "..333...", ".33333..", "..3.3...", ".33.33.."],
  ["..111...", ".12221..", "..111...", ".23332..", "2233322.", ".23332..", "..3.3...", ".33.33.."],
];

const ENEMY_PATTERNS = {
  boggobbler: ["........", "..111...", ".12221..", "1122211.", ".13331..", "..333...", ".3.3.3..", "33...33."],
  boneguard: ["..111...", ".12221..", ".12121..", "..111...", "...3....", "..333...", "...3....", "..3.3..."],
  mireSpider: ["........", ".1.11.1.", "..1221..", "11122111", "..1221..", ".1.11.1.", "1......1", "........"],
  emberImp: ["1..11..1", ".111111.", "..1221..", ".123321.", "..3333..", ".33..33.", "33....33", "........"],
  graveHound: ["........", "..1111..", ".122221.", "11233221", "..3333..", "...33...", "..3..3..", ".33..33."],
  ironBrute: [".111111.", "11222211", "12211221", "11111111", ".333333.", "33333333", ".33..33.", "33....33"],
  bellWarden: ["...11...", "..1111..", ".122221.", "..1111..", ".333333.", "33333333", ".3.33.3.", "33....33"],
};

const CLASS_PATTERN = Object.freeze({
  Vanguard: 0, Berserker: 1, Shadow: 2, Warden: 2, Arcanist: 4, Luminary: 5,
  Oathkeeper: 0, Wildcaller: 3, Troubadour: 2, Engineer: 3, Hexbinder: 4, "Wayfarer Monk": 1,
});

function PixelSprite({ heroId, enemyId, size = "md", className = "" }) {
  const hero = heroId ? HERO_BY_ID[heroId] : null;
  const enemy = enemyId ? ENEMIES[enemyId] : null;
  const pattern = hero ? HERO_PATTERNS[CLASS_PATTERN[hero.className] ?? 0] : ENEMY_PATTERNS[enemyId] || ENEMY_PATTERNS.boggobbler;
  const palette = hero?.palette || enemy?.palette || ["#ddd", "#888", "#444"];
  return (
    <span className={`pq-sprite pq-sprite-${size} ${className}`} aria-hidden="true">
      {pattern.flatMap((row, y) => row.split("").map((pixel, x) => (
        <i key={`${x}-${y}`} style={pixel === "." ? undefined : { backgroundColor: palette[Math.max(0, Number(pixel) - 1) % palette.length] }} />
      )))}
    </span>
  );
}

function MiniStat({ label, value }) {
  return <span className="pq-mini-stat"><small>{label}</small><strong>{value}</strong></span>;
}

function HealthBar({ hp, maxHp, compact = false }) {
  const percent = Math.max(0, Math.min(100, Math.round((Number(hp || 0) / Math.max(1, Number(maxHp || 1))) * 100)));
  return <div className={`pq-health ${compact ? "compact" : ""}`} aria-label={`${hp} of ${maxHp} hit points`}><span style={{ width: `${percent}%` }} /><b>{hp}/{maxHp}</b></div>;
}

function usePixelAudio() {
  const contextRef = useRef(null);
  const [muted, setMuted] = useState(() => localStorage.getItem("pixelquest-muted") === "true");
  useEffect(() => { localStorage.setItem("pixelquest-muted", String(muted)); }, [muted]);

  function tone(notes = [220], duration = 0.08, volume = 0.035) {
    if (muted || typeof window === "undefined") return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = contextRef.current || new AudioContext();
      contextRef.current = context;
      const now = context.currentTime;
      notes.forEach((frequency, index) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = "square";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, now + index * duration * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * duration * 0.7 + duration);
        osc.connect(gain).connect(context.destination);
        osc.start(now + index * duration * 0.7);
        osc.stop(now + index * duration * 0.7 + duration + 0.01);
      });
    } catch {
      // Audio is decorative; gameplay must never depend on browser audio support.
    }
  }

  return { muted, setMuted, tone };
}

function DiceTray({ roll, onClose, tone }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (!roll) return undefined;
    const timer = window.setTimeout(() => { setSettled(true); tone?.(roll.outcome === "critical" ? [440, 660, 880] : roll.outcome === "fumble" ? [130, 98] : [260, 320], 0.09, 0.025); }, 720);
    return () => window.clearTimeout(timer);
  }, [roll?.id]);
  if (!roll) return null;
  const dieSides = Number(String(roll.die || "d20").replace(/\D/g, "")) || 20;
  return (
    <div className={`pq-dice-tray ${settled ? "settled" : "rolling"}`} role="status" aria-live="polite">
      <div className="pq-dice-shadow" />
      <div className={`pq-die pq-d${dieSides}`}><span>{settled ? roll.raw : "?"}</span></div>
      <div className="pq-roll-copy">
        <small>{roll.actorName} · {roll.kind}</small>
        <strong>{settled ? roll.outcome.toUpperCase() : "ROLLING…"}</strong>
        {settled ? <p>{roll.raw}{roll.modifiers?.length ? ` ${roll.modifiers.map((value) => `${value >= 0 ? "+" : ""}${value}`).join(" ")}` : ""} = <b>{roll.total}</b>{roll.target != null ? ` vs ${roll.target}` : ""}</p> : <p>The result is already locked by the game engine.</p>}
      </div>
      {settled ? <button type="button" onClick={onClose}>×</button> : null}
    </div>
  );
}

function Cartridge({ adventure, selected, onSelect, disabled = false }) {
  return (
    <button type="button" disabled={disabled} className={`pq-cartridge ${selected ? "selected" : ""}`} style={{ "--quest-accent": adventure.accent }} onClick={() => onSelect(adventure.id)}>
      <span className="pq-cartridge-spine">QUEST {String(adventure.number).padStart(2, "0")}</span>
      <span className="pq-cartridge-art"><i /><i /><i /><b>⚔</b></span>
      <span className="pq-cartridge-copy"><small>{adventure.tone} · ~{adventure.estimatedMinutes} min</small><strong>{adventure.title}</strong><em>{adventure.subtitle}</em></span>
    </button>
  );
}

function GamePortal({ controller, adventureId, setAdventureId, difficulty, setDifficulty, audio }) {
  const selected = ADVENTURE_BY_ID[adventureId];
  const [showLibrary, setShowLibrary] = useState(false);
  const { nickname, setNickname, joinCode, setJoinCode, error, busy, user } = controller;
  return (
    <main className="pq-shell pq-title-screen">
      <div className="pq-sky" aria-hidden="true"><i className="star s1" /><i className="star s2" /><i className="star s3" /><span className="moon" /><div className="mountains" /><div className="castle"><b /><b /><b /><i /></div><div className="mist mist-a" /><div className="mist mist-b" /></div>
      <header className="pq-title-top"><button type="button" className="pq-ghost-button" onClick={navigateToHub}>← FAMILY GAME ROOM</button><button type="button" className="pq-icon-button" onClick={() => audio.setMuted(!audio.muted)} aria-label={audio.muted ? "Unmute PixelQuest" : "Mute PixelQuest"}>{audio.muted ? "🔇" : "🔊"}</button></header>
      <section className="pq-title-hero">
        <p className="pq-overline">1–8 ONLINE ADVENTURERS · ORIGINAL d20 FANTASY</p>
        <h1><span>PIXEL</span>QUEST</h1>
        <h2>THE LIVING DUNGEON</h2>
        <p>An AI-DM-ready cooperative fantasy RPG where the dice are honest, the world remembers, and your family decides what kind of trouble to walk into together.</p>
        <div className="pq-title-party" aria-hidden="true">{HEROES.slice(0, 6).map((hero) => <PixelSprite key={hero.id} heroId={hero.id} size="lg" />)}</div>
      </section>

      <section className="pq-portal-console">
        <div className="pq-portal-selected" style={{ "--quest-accent": selected.accent }}>
          <div><small>INSERTED ADVENTURE</small><strong>{selected.title}</strong><span>{selected.subtitle}</span></div>
          <button type="button" onClick={() => setShowLibrary((value) => !value)}>{showLibrary ? "Close cartridges" : "Choose cartridge"}</button>
        </div>
        {showLibrary ? <div className="pq-cartridge-library">{ADVENTURES.map((adventure) => <Cartridge key={adventure.id} adventure={adventure} selected={adventure.id === adventureId} onSelect={(id) => { setAdventureId(id); audio.tone([220, 330]); }} />)}</div> : null}
        <div className="pq-portal-actions">
          <label><span>YOUR NAME</span><input value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} /></label>
          <label><span>DIFFICULTY</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="story">Story · forgiving</option><option value="classic">Classic · balanced</option><option value="heroic">Heroic · dangerous</option></select></label>
          <button type="button" className="pq-primary" disabled={!user || busy} onClick={() => { audio.tone([196, 247, 294]); controller.createRoom(); }}>CREATE ADVENTURE ROOM</button>
        </div>
        <div className="pq-join-row">
          <span>Already have a party?</span><input value={joinCode} maxLength={6} placeholder="ROOM CODE" onChange={(event) => setJoinCode(event.target.value.toUpperCase())} />
          <button type="button" disabled={!user || busy || joinCode.length !== 6} onClick={() => { audio.tone([294, 370]); controller.joinRoom(); }}>JOIN PARTY</button>
        </div>
        {error ? <p className="pq-error">{error}</p> : null}
        <div className="pq-feature-runes"><span>🎲 Visible dice</span><span>🗺 Tactical maps</span><span>🤖 AI companions</span><span>🗝 Private choices</span><span>🏆 Persistent legends</span></div>
      </section>
    </main>
  );
}

function PixelQuestLobby({ controller, audio }) {
  const { room, user, members, error, busy } = controller;
  const adventure = ADVENTURE_BY_ID[room.rules?.adventureId] || ADVENTURES[0];
  const isHost = room.hostUid === user?.uid;
  const seats = Array.from({ length: 8 }, (_, seat) => members.find((member) => Number(member.seat) === seat) || null);
  return (
    <main className="pq-shell pq-lobby-screen">
      <header className="pq-game-header"><button type="button" onClick={navigateToHub}>← HUB</button><div><small>ADVENTURE ROOM</small><strong>{adventure.title}</strong></div><button type="button" onClick={() => audio.setMuted(!audio.muted)}>{audio.muted ? "🔇" : "🔊"}</button></header>
      <section className="pq-lobby-banner" style={{ "--quest-accent": adventure.accent }}><div><small>ROOM CODE</small><strong>{room.roomCode}</strong><p>Send this six-character code to up to seven more family members.</p></div><div className="pq-lobby-runes"><span>{adventure.tone}</span><span>{room.rules?.difficulty || "story"}</span><span>1–8 heroes</span></div></section>
      {error ? <p className="pq-error">{error}</p> : null}
      <section className="pq-seat-grid">{seats.map((member, index) => <article key={index} className={`pq-seat ${member ? "filled" : "empty"}`}><span className="pq-seat-number">{index + 1}</span>{member ? <><div className="pq-seat-avatar">{member.avatar}</div><div><strong>{member.nickname}</strong><small>{member.isRobot ? "AI COMPANION" : member.uid === room.hostUid ? "PARTY LEADER" : "ADVENTURER"}</small></div><b>{member.connected === false ? "AWAY" : "READY"}</b></> : <><div className="pq-seat-avatar ghost">?</div><div><strong>Open seat</strong><small>Waiting for an adventurer</small></div></>}</article>)}</section>
      <footer className="pq-lobby-footer"><div><p>{isHost ? "Add AI companions to fill empty seats, or begin with whoever is here." : "Waiting for the party leader to open the character roster."}</p><small>Drop-in architecture: empty seats can be filled by AI companions.</small></div>{isHost ? <div><button type="button" disabled={busy || members.length >= 8} onClick={() => { audio.tone([180, 240]); controller.addRobot(); }}>＋ ADD AI COMPANION</button><button type="button" className="pq-primary" disabled={busy || members.length < 1} onClick={() => { audio.tone([220, 330, 440]); controller.start(); }}>OPEN CHARACTER ROSTER →</button></div> : null}</footer>
    </main>
  );
}

function HeroSelect({ controller, audio }) {
  const { room, members, user, act, busy, error } = controller;
  const state = room.gameState;
  const selectedMine = state.selections?.[user?.uid] || null;
  const taken = new Set(Object.values(state.selections || {}));
  const isHost = room.hostUid === user?.uid;
  const allReady = members.every((member) => member.isRobot || state.selections?.[member.uid]);
  return (
    <main className="pq-shell pq-roster-screen">
      <header className="pq-game-header"><button type="button" onClick={navigateToHub}>← HUB</button><div><small>CHOOSE YOUR HERO</small><strong>{ADVENTURE_BY_ID[state.adventureId]?.title}</strong></div><span className="pq-room-chip">ROOM {room.roomCode}</span></header>
      <section className="pq-roster-intro"><div><h1>WHO ENTERS THE DUNGEON?</h1><p>Every hero is pregenerated and ready to play. Choose a role that sounds fun; the interface explains the rules as you go.</p></div><div className="pq-ready-strip">{members.map((member) => { const heroId = state.selections?.[member.uid]; return <span key={member.uid} className={heroId ? "ready" : ""}>{member.avatar} {member.nickname}<b>{heroId ? HERO_BY_ID[heroId]?.className : "CHOOSING…"}</b></span>; })}</div></section>
      {error ? <p className="pq-error">{error}</p> : null}
      <section className="pq-hero-grid">{HEROES.map((hero) => { const mine = selectedMine === hero.id; const unavailable = taken.has(hero.id) && !mine; return <button type="button" key={hero.id} disabled={unavailable || busy} className={`pq-hero-card ${mine ? "selected" : ""}`} onClick={() => { audio.tone([200, 300, 400]); act({ type: "select-hero", heroId: hero.id }); }}><div className="pq-hero-card-top"><PixelSprite heroId={hero.id} size="xl" /><div><small>{hero.className}</small><strong>{hero.name}</strong><span>{hero.role}</span></div></div><p>{hero.tagline}</p><div className="pq-hero-stats"><MiniStat label="HP" value={hero.maxHp} /><MiniStat label="DEF" value={hero.defense} /><MiniStat label="MOVE" value={hero.move} /><MiniStat label="INIT" value={`+${hero.initiative}`} /></div><div className="pq-ability-preview">{hero.abilities.slice(0, 3).map((ability) => <span key={ability.id}>{ability.name}</span>)}</div><em>{unavailable ? "TAKEN" : mine ? "YOUR HERO" : "SELECT"}</em></button>; })}</section>
      <footer className="pq-roster-footer"><span>{selectedMine ? `You are ${HERO_BY_ID[selectedMine]?.name}.` : "Choose one hero above."}</span>{isHost ? <button type="button" className="pq-primary" disabled={!allReady || busy} onClick={() => { audio.tone([220, 330, 440, 660], 0.08); act({ type: "begin-adventure" }); }}>BEGIN ADVENTURE →</button> : <span className="pq-waiting">{allReady ? "Waiting for the host…" : "Waiting for everyone to choose…"}</span>}</footer>
    </main>
  );
}

function PartyHud({ campaign, members, seatHeroes, currentActor }) {
  return <aside className="pq-party-hud"><h3>THE PARTY</h3>{campaign.heroes.map((hero) => { const member = members.find((candidate) => seatHeroes?.[candidate.uid] === hero.id); const active = currentActor?.id === hero.id; return <article key={hero.id} className={`${active ? "active" : ""} ${hero.downed ? "downed" : ""}`}><PixelSprite heroId={hero.id} size="sm" /><div><strong>{member?.nickname || hero.name}</strong><small>{hero.name} · {hero.className}{member?.isRobot ? " · AI" : ""}</small><HealthBar hp={hero.hp} maxHp={hero.maxHp} compact /></div>{active ? <b>TURN</b> : null}</article>; })}</aside>;
}

function DMPanel({ campaign }) {
  const [showRolls, setShowRolls] = useState(false);
  const log = (campaign.log || []).slice(-8).reverse();
  return <aside className="pq-dm-panel"><div className="pq-dm-title"><span className="pq-dm-eye">◆</span><div><small>THE DUNGEON MASTER</small><strong>THE WORLD IS LISTENING</strong></div></div><div className="pq-dm-scroll">{log.map((entry) => <p key={entry.id} className={`type-${entry.type}`}>{entry.private ? "[A private choice was made.]" : entry.text}</p>)}</div><button type="button" onClick={() => setShowRolls((value) => !value)}>🎲 {showRolls ? "Hide" : "Show"} dice history</button>{showRolls ? <div className="pq-roll-history">{(campaign.rollHistory || []).slice(-10).reverse().map((roll) => <span key={roll.id}><b>{roll.raw}</b><small>{roll.actorName}</small><em>{roll.kind} · {roll.outcome}</em></span>)}</div> : null}</aside>;
}

function StoryScene({ controller, campaign, scene, audio }) {
  const isHost = controller.room.hostUid === controller.user?.uid;
  return <section className="pq-story-stage"><div className="pq-scene-art scene-story"><div className="pq-pixel-landscape"><i className="tree t1" /><i className="tree t2" /><i className="road" /><i className="torch" /></div></div><div className="pq-story-copy"><span className="pq-scene-type">STORY</span><h1>{scene.title}</h1><p>{localNarrator.describe(campaign)}</p>{isHost ? <button type="button" className="pq-primary" onClick={() => { audio.tone([220, 277]); controller.act({ type: "continue-story" }); }}>CONTINUE →</button> : <p className="pq-waiting">Waiting for the party leader to continue…</p>}</div></section>;
}

function PartyDecision({ controller, campaign, scene, myHeroId, audio }) {
  const myVote = campaign.votes?.[myHeroId];
  const isHost = controller.room.hostUid === controller.user?.uid;
  const [plan, setPlan] = useState("");
  const [dmAnswer, setDmAnswer] = useState("");
  const humanHeroIds = controller.members.filter((member) => !member.isRobot).map((member) => controller.room.gameState.seatHeroes?.[member.uid]).filter(Boolean);
  const allHumanVotes = humanHeroIds.every((heroId) => campaign.votes?.[heroId]);
  function suggestPlan() {
    if (!plan.trim()) return;
    const reaction = localNarrator.reactToPlan(campaign, plan.trim());
    setDmAnswer(reaction.narration);
    if (reaction.choiceId && myHeroId) controller.act({ type: "vote", choiceId: reaction.choiceId });
    audio.tone([180, 240, 320]);
  }
  return <section className="pq-choice-stage"><div className="pq-choice-heading"><span className="pq-scene-type">PARTY DECISION</span><h1>{scene.title}</h1><p>{localNarrator.describe(campaign)}</p><small>Everyone votes independently. Discuss it over voice chat first—or don't.</small></div><div className="pq-choice-list">{scene.choices.map((choice, index) => { const voters = campaign.heroes.filter((hero) => campaign.votes?.[hero.id] === choice.id); return <button type="button" key={choice.id} className={myVote === choice.id ? "chosen" : ""} onClick={() => { audio.tone([200 + index * 50]); controller.act({ type: "vote", choiceId: choice.id }); }}><b>{String.fromCharCode(65 + index)}</b><span><strong>{choice.label}</strong><small>{choice.detail}</small><i>{voters.map((hero) => <PixelSprite key={hero.id} heroId={hero.id} size="xs" />)}</i></span></button>; })}</div><div className="pq-free-plan"><label>DO SOMETHING ELSE<input value={plan} onChange={(event) => setPlan(event.target.value)} placeholder="I want to climb the roof and enter through the chimney…" /></label><button type="button" onClick={suggestPlan}>ASK THE DM</button>{dmAnswer ? <p>{dmAnswer}</p> : null}</div><footer><span>{myVote ? `Your vote: ${scene.choices.find((choice) => choice.id === myVote)?.label}` : "Choose your vote."}</span>{isHost ? <button type="button" className="pq-primary" disabled={!allHumanVotes} onClick={() => { audio.tone([250, 330, 500]); controller.act({ type: "resolve-vote" }); }}>{allHumanVotes ? "LOCK PARTY DECISION →" : "WAITING FOR VOTES"}</button> : null}</footer></section>;
}

function PrivateDecision({ controller, campaign, scene, myHeroId, audio }) {
  const [revealed, setRevealed] = useState(false);
  const myHero = HERO_BY_ID[myHeroId];
  if (!myHeroId) return <section className="pq-private-stage"><h1>This secret belongs to an active adventurer.</h1></section>;
  if (!revealed) return <section className="pq-private-stage veil"><PixelSprite heroId={myHeroId} size="xl" /><span className="pq-scene-type">PRIVATE MOMENT</span><h1>{myHero?.name}, this choice is yours.</h1><p>Other players should look away from this screen. In a separate browser, only your seat receives the choice controls.</p><button type="button" className="pq-primary" onClick={() => { audio.tone([160, 220]); setRevealed(true); }}>REVEAL MY CHOICE</button></section>;
  return <section className="pq-private-stage"><span className="pq-scene-type">ONLY YOU DECIDE</span><h1>{scene.title}</h1><p>{scene.text}</p><div className="pq-private-choices">{scene.choices.map((choice) => <button type="button" key={choice.id} onClick={() => { audio.tone([220, 330]); controller.act({ type: "private-choice", choiceId: choice.id }); }}>{choice.label}</button>)}</div></section>;
}

function SkillScene({ controller, campaign, scene, myHeroId, audio }) {
  const hero = HERO_BY_ID[myHeroId];
  const stat = hero?.stats?.[scene.stat] ?? 0;
  return <section className="pq-skill-stage"><div className="pq-skill-rune"><span>?</span></div><span className="pq-scene-type">SKILL CHECK</span><h1>{scene.title}</h1><p>{scene.text}</p><div className="pq-skill-card"><PixelSprite heroId={myHeroId} size="lg" /><div><small>{hero?.name}</small><strong>{String(scene.stat).toUpperCase()} CHECK</strong><span>d20 + {stat} + 2 proficiency vs DC {scene.dc}</span></div></div><button type="button" className="pq-primary pq-roll-button" disabled={!myHeroId} onClick={() => { audio.tone([120, 180, 260], 0.05); controller.act({ type: "skill-check" }); }}>🎲 ROLL d20</button></section>;
}

function Tile({ tile, actor, current, reachable, selectedAbility, onClick }) {
  const enemyTemplate = actor?.type === "enemy" ? actor.templateId : null;
  return <button type="button" className={`pq-tile tile-${tileLegend(tile)} ${reachable ? "reachable" : ""} ${actor ? `occupied ${actor.type}` : ""} ${current ? "current" : ""} ${actor?.downed ? "downed" : ""}`} onClick={onClick} aria-label={`${tileLegend(tile)}${actor ? `, ${actor.name}` : ""}${reachable ? ", reachable" : ""}`}><span className="pq-tile-texture" />{tile === "C" ? <span className="pq-chest">▣</span> : null}{tile === "F" ? <span className="pq-flame">♨</span> : null}{actor?.type === "hero" ? <PixelSprite heroId={actor.templateId || actor.id} size="board" /> : null}{actor?.type === "enemy" ? <PixelSprite enemyId={enemyTemplate} size={actor.boss ? "boss" : "board"} /> : null}{actor ? <span className="pq-actor-hp"><i style={{ width: `${Math.max(0, Math.round((actor.hp / actor.maxHp) * 100))}%` }} /></span> : null}{current ? <span className="pq-turn-caret">▼</span> : null}{selectedAbility && actor ? <span className="pq-target-reticle">+</span> : null}</button>;
}

function CombatStage({ controller, campaign, myHeroId, audio }) {
  const combat = campaign.combat;
  const scene = currentScene(campaign);
  const isHost = controller.room.hostUid === controller.user?.uid;
  const [selectedAbilityId, setSelectedAbilityId] = useState(null);
  const current = currentCombatActor(campaign);
  const mine = current?.id === myHeroId;
  const myActor = combat?.actors.find((actor) => actor.id === myHeroId);
  const heroTemplate = HERO_BY_ID[myHeroId];
  const reachable = useMemo(() => new Set((mine && !selectedAbilityId ? reachableCells(campaign, myHeroId) : []).map((cell) => `${cell.x},${cell.y}`)), [campaign, mine, myHeroId, selectedAbilityId]);
  const selectedAbility = myActor?.abilities?.find((ability) => ability.id === selectedAbilityId) || null;

  if (!combat) return <section className="pq-combat-intro"><div className="pq-battle-banner"><span>⚔</span><small>ENCOUNTER</small><h1>{scene.title}</h1><p>{scene.text}</p></div>{isHost ? <button type="button" className="pq-primary" onClick={() => { audio.tone([110, 165, 220, 330], 0.07); controller.act({ type: "start-combat" }); }}>ROLL INITIATIVE →</button> : <p className="pq-waiting">Waiting for the party leader to start the encounter…</p>}</section>;

  const actorByCell = new Map(combat.actors.filter((actor) => actor.hp > 0).map((actor) => [`${actor.x},${actor.y}`, actor]));
  function cellClick(x, y) {
    if (!mine || current?.type !== "hero") return;
    const target = actorByCell.get(`${x},${y}`);
    if (selectedAbility) {
      if (selectedAbility.target === "self") {
        controller.act({ type: "ability", abilityId: selectedAbility.id, targetId: current.id });
        setSelectedAbilityId(null); return;
      }
      if (selectedAbility.target === "tile") {
        controller.act({ type: "tile-ability", abilityId: selectedAbility.id, x, y });
        setSelectedAbilityId(null); return;
      }
      if (target) {
        controller.act({ type: "ability", abilityId: selectedAbility.id, targetId: target.id });
        setSelectedAbilityId(null); return;
      }
      return;
    }
    if (!target && reachable.has(`${x},${y}`)) {
      audio.tone([160], 0.04, 0.015);
      controller.act({ type: "move", x, y });
    }
  }

  const winner = combat.victory;
  return <section className="pq-combat-stage"><div className="pq-initiative-ribbon">{combat.order.map((id) => { const actor = combat.actors.find((entry) => entry.id === id); if (!actor) return null; return <span key={id} className={`${current?.id === id ? "active" : ""} ${actor.downed ? "downed" : ""}`}><PixelSprite heroId={actor.type === "hero" ? actor.templateId || actor.id : null} enemyId={actor.type === "enemy" ? actor.templateId : null} size="xs" /><b>{actor.name}</b><small>{actor.initiativeRoll}</small></span>; })}</div><div className="pq-board-frame"><div className="pq-board" role="grid" aria-label="PixelQuest tactical battle map">{combat.map.flatMap((row, y) => row.split("").map((tile, x) => { const actor = actorByCell.get(`${x},${y}`); return <Tile key={`${x}-${y}`} tile={tile} actor={actor} current={actor?.id === current?.id} reachable={reachable.has(`${x},${y}`)} selectedAbility={selectedAbility} onClick={() => cellClick(x, y)} />; }))}{(combat.objects || []).map((object) => <span key={object.id} className={`pq-board-object object-${object.type}`} style={{ "--x": object.x, "--y": object.y }}>{object.type === "turret" ? "⌖" : "⌁"}</span>)}</div><div className="pq-board-status"><span>ROUND {combat.round}</span><strong>{combat.lastAction}</strong><em>{current?.type === "enemy" ? "THE DUNGEON MOVES…" : mine ? "YOUR TURN" : current?.controller === "ai" ? "AI COMPANION THINKING…" : `WAITING FOR ${current?.name?.toUpperCase()}`}</em></div></div>{winner ? <div className={`pq-combat-result ${winner}`}><h2>{winner === "heroes" ? "VICTORY" : "THE PARTY FALLS"}</h2><p>{winner === "heroes" ? "The last enemy drops. The room is suddenly much quieter." : "No one is eliminated from game night. Defeat costs time and gold, not your seat."}</p>{isHost ? <button type="button" className="pq-primary" onClick={() => controller.act({ type: winner === "heroes" ? "finish-combat" : "recover-defeat" })}>{winner === "heroes" ? "CLAIM LOOT →" : "WAKE UP LATER →"}</button> : null}</div> : null}<div className="pq-action-deck"><div className="pq-current-hero">{current ? <><PixelSprite heroId={current.type === "hero" ? current.templateId || current.id : null} enemyId={current.type === "enemy" ? current.templateId : null} size="sm" /><div><small>TURN</small><strong>{current.name}</strong><HealthBar hp={current.hp} maxHp={current.maxHp} compact /></div></> : null}</div>{mine && !winner ? <><div className="pq-ability-buttons">{myActor.abilities.map((ability) => { const cd = myActor.cooldowns?.[ability.id] || 0; return <button type="button" key={ability.id} disabled={cd > 0} className={selectedAbilityId === ability.id ? "selected" : ""} title={ability.description} onClick={() => { audio.tone([190, 240]); if (ability.target === "self") { controller.act({ type: "ability", abilityId: ability.id, targetId: myActor.id }); setSelectedAbilityId(null); } else setSelectedAbilityId((value) => value === ability.id ? null : ability.id); }}><strong>{ability.name}</strong><small>{cd ? `COOLDOWN ${cd}` : ability.target === "tile" ? "CHOOSE TILE" : ability.range ? `RANGE ${ability.range}` : "READY"}</small></button>; })}</div><button type="button" className="pq-end-turn" onClick={() => { audio.tone([130]); controller.act({ type: "end-turn" }); setSelectedAbilityId(null); }}>END TURN</button></> : <div className="pq-turn-help"><strong>{mine ? "Choose an ability or glowing movement tile." : localNarrator.combatQuip(campaign, current?.name || "The enemy")}</strong><small>{selectedAbility ? selectedAbility.description : heroTemplate?.utility || "The battle is resolving through the shared room state."}</small></div>}</div></section>;
}

function EndingScene({ controller, campaign, scene, audio }) {
  const isHost = controller.room.hostUid === controller.user?.uid;
  return <section className="pq-ending-stage"><div className="pq-ending-castle"><span>★</span></div><span className="pq-scene-type">ADVENTURE COMPLETE</span><h1>{scene.title}</h1><p>{scene.text}</p><div className="pq-reward-grid"><MiniStat label="GOLD" value={`+${scene.rewardGold || 0}`} /><MiniStat label="XP" value={`+${scene.rewardXp || 0}`} /><MiniStat label="CRITS" value={campaign.stats.crits} /><MiniStat label="MONSTERS" value={campaign.stats.monstersDefeated} /></div>{isHost ? <button type="button" className="pq-primary" onClick={() => { audio.tone([330, 440, 554, 660], 0.12); controller.act({ type: "complete-adventure" }); }}>ENTER THE HALL OF LEGENDS →</button> : <p className="pq-waiting">Waiting for the party leader to close the chapter…</p>}</section>;
}

function HallOfLegends({ controller, audio }) {
  const state = controller.room.gameState;
  const campaign = state.campaign;
  const adventure = currentAdventure(campaign);
  useEffect(() => {
    try {
      const previous = JSON.parse(localStorage.getItem("pixelquest-guild") || "{}");
      const completed = Array.from(new Set([...(previous.completed || []), adventure.id]));
      const legends = [...(previous.legends || []), ...(campaign.legends || [])].slice(-30);
      localStorage.setItem("pixelquest-guild", JSON.stringify({ completed, legends, gold: Number(previous.gold || 0) + campaign.gold, crits: Number(previous.crits || 0) + campaign.stats.crits, monsters: Number(previous.monsters || 0) + campaign.stats.monstersDefeated }));
    } catch { /* Guild persistence is a convenience layer. */ }
  }, []);
  return <main className="pq-shell pq-hall-screen"><header className="pq-game-header"><button type="button" onClick={navigateToHub}>← FAMILY GAME ROOM</button><div><small>THE GUILD HALL</small><strong>HALL OF LEGENDS</strong></div><button type="button" onClick={() => audio.setMuted(!audio.muted)}>{audio.muted ? "🔇" : "🔊"}</button></header><section className="pq-hall-banner"><div className="pq-trophy">♜</div><div><small>CARTRIDGE CLEARED</small><h1>{adventure.title}</h1><p>{adventure.subtitle}</p></div></section><section className="pq-hall-stats"><MiniStat label="TOTAL GOLD THIS RUN" value={campaign.gold} /><MiniStat label="XP" value={campaign.xp} /><MiniStat label="CRITICAL HITS" value={campaign.stats.crits} /><MiniStat label="MONSTERS DEFEATED" value={campaign.stats.monstersDefeated} /></section><section className="pq-legend-wall"><h2>THIS PARTY'S LEGENDS</h2>{campaign.legends?.length ? campaign.legends.map((legend, index) => <article key={`${legend.text}-${index}`}><span>✦</span><p>{legend.text}</p></article>) : <article><span>✦</span><p>Survived {adventure.title} and lived to argue about the decisions afterward.</p></article>}</section><footer><button type="button" className="pq-primary" onClick={navigateToHub}>RETURN TO FAMILY GAME ROOM</button></footer></main>;
}

function CampaignScreen({ controller, audio }) {
  const state = controller.room.gameState;
  const campaign = state.campaign;
  const scene = currentScene(campaign);
  const adventure = currentAdventure(campaign);
  const myHeroId = pixelQuestSeatForUid(state, controller.user?.uid);
  const currentActor = currentCombatActor(campaign);
  const [diceRoll, setDiceRoll] = useState(null);
  const lastRollId = campaign.lastRoll?.id;
  useEffect(() => { if (campaign.lastRoll) setDiceRoll(campaign.lastRoll); }, [lastRollId]);
  if (!scene) return <main className="pq-shell"><p className="pq-error">The current adventure scene could not be loaded.</p></main>;
  return <main className="pq-shell pq-game-screen"><header className="pq-game-header"><button type="button" onClick={navigateToHub}>← HUB</button><div><small>{adventure.title}</small><strong>{scene.title}</strong></div><div className="pq-header-stats"><span>💰 {campaign.gold}</span><span>✦ {campaign.xp} XP</span><span>ROOM {controller.room.roomCode}</span><button type="button" onClick={() => audio.setMuted(!audio.muted)}>{audio.muted ? "🔇" : "🔊"}</button></div></header><div className="pq-game-layout"><PartyHud campaign={campaign} members={controller.members} seatHeroes={state.seatHeroes} currentActor={currentActor} /><section className="pq-main-stage">{scene.type === "story" ? <StoryScene controller={controller} campaign={campaign} scene={scene} audio={audio} /> : null}{scene.type === "party-choice" ? <PartyDecision controller={controller} campaign={campaign} scene={scene} myHeroId={myHeroId} audio={audio} /> : null}{scene.type === "private" ? <PrivateDecision controller={controller} campaign={campaign} scene={scene} myHeroId={myHeroId} audio={audio} /> : null}{scene.type === "skill" ? <SkillScene controller={controller} campaign={campaign} scene={scene} myHeroId={myHeroId} audio={audio} /> : null}{scene.type === "combat" ? <CombatStage controller={controller} campaign={campaign} myHeroId={myHeroId} audio={audio} /> : null}{scene.type === "ending" ? <EndingScene controller={controller} campaign={campaign} scene={scene} audio={audio} /> : null}</section><DMPanel campaign={campaign} /></div><DiceTray roll={diceRoll} onClose={() => setDiceRoll(null)} tone={audio.tone} /></main>;
}

export default function PixelQuestGame() {
  const [adventureId, setAdventureId] = useState("bells-blackhollow");
  const [difficulty, setDifficulty] = useState("story");
  const audio = usePixelAudio();
  const controller = useModularTable({
    gameId: "pixelquest",
    maxPlayers: 8,
    minimumPlayers: 1,
    rules: { adventureId, difficulty },
    createGameState: createPixelQuestGameState,
    reduceGameState: reducePixelQuest,
    robotDelay: 450,
  });

  if (!controller.roomCode) return <GamePortal controller={controller} adventureId={adventureId} setAdventureId={setAdventureId} difficulty={difficulty} setDifficulty={setDifficulty} audio={audio} />;
  if (!controller.room) return <main className="pq-shell pq-loading"><div className="pq-loader"><span>◆</span><h1>Opening the dungeon…</h1><p>Synchronizing the party table.</p></div></main>;
  if (controller.room.status === "lobby") return <PixelQuestLobby controller={controller} audio={audio} />;
  if (controller.room.gameState?.phase === "hero-select") return <HeroSelect controller={controller} audio={audio} />;
  if (controller.room.gameState?.phase === "complete") return <HallOfLegends controller={controller} audio={audio} />;
  return <CampaignScreen controller={controller} audio={audio} />;
}
