import React, { useEffect, useMemo, useState } from "react";
import GameGuidance from "./platform/GameGuidance";
import GameLearningCenter from "./platform/GameLearningCenter";
import TabletopLearningCenter from "./platform/TabletopLearningCenter";
import LayoutModeControl from "./platform/LayoutModeControl";

const GAME_CATALOG = [
  { id: "canasta", name: "Canasta", icon: "♣", eyebrow: "Meld strategy", description: "The complete family Canasta table, preserved exactly as it plays today.", players: "2–6 players", status: "Ready" },
  { id: "pixelquest", name: "PixelQuest: The Living Dungeon", icon: "⚔", eyebrow: "Co-op fantasy campaign", description: "A 1–8 player living dungeon with honest d20 dice, tactical battles, party votes, private choices, AI companions, and twenty adventure cartridges.", players: "1–8 online players", status: "Ready" },
  { id: "punchline", name: "Punchline", icon: "🎤", eyebrow: "Write it · vote it", description: "A big-screen comedy show where every phone writes the punchlines and the room decides what lands.", players: "3–12 phones", status: "Ready" },
  { id: "lastonealive", name: "Last One Alive", icon: "👻", eyebrow: "Trivia · traps · escape", description: "Horror-comedy trivia with six survival micro-games, ghosts, resurrection, and a final race for the exit.", players: "3–12 phones", status: "Ready" },
  { id: "doodlealibi", name: "Doodle Alibi", icon: "🖍️", eyebrow: "Draw · accuse · deceive", description: "Draw secret assignments on your phone, study the TV evidence wall, and expose the altered prompt.", players: "4–12 phones", status: "Ready" },
  { id: "slumlord", name: "Slum Lord", icon: "🏚️", eyebrow: "Buy · patch · collect", description: "A full-board property game with terrible maintenance: buy the block, patch the leaks, dodge inspections, trade properties, and collect rent.", players: "2–4 local players", status: "Ready" },
  { id: "hearts", name: "Hearts", icon: "♥", eyebrow: "Avoid the points", description: "Pass three cards, dodge penalty tricks, and try to shoot the moon.", players: "4 players", status: "Planned" },
  { id: "spades", name: "Spades", icon: "♠", eyebrow: "Bid with a partner", description: "Call your contract, manage bags, protect nil bids, and race to 500.", players: "4 players", status: "Planned" },
  { id: "rummy", name: "Rummy", icon: "♦", eyebrow: "Sets and runs", description: "Draw, meld, lay off, and be the first player to empty your hand.", players: "2–6 players", status: "Planned" },
  { id: "gofish", name: "Go Fish", icon: "🐟", eyebrow: "Ask, draw, collect", description: "Ask for ranks you hold, build four-card books, and fish from the pond when you miss.", players: "2–6 players", status: "Planned" },
  { id: "connect4", name: "Connect 4", icon: "🔴", eyebrow: "Vertical strategy", description: "Drop checkers into a 7×6 board, block threats, and connect four before your opponent.", players: "2 players", status: "Planned" },
  { id: "battleship", name: "Battleship", icon: "⚓", eyebrow: "Hidden-fleet tactics", description: "Hunt a hidden 10×10 fleet with classic ships, alternating shots, hits, misses, and sinks.", players: "2 players", status: "Planned" },
  { id: "hnefatafl", name: "Hnefatafl", icon: "♔", eyebrow: "Viking king hunt", description: "An asymmetric 11×11 siege: raiders hunt the king while defenders fight to escape him to a corner.", players: "2 players", status: "Planned" },
  { id: "ers", name: "Egyptian Rat Screw", icon: "⚡", eyebrow: "Flip and react", description: "Survive face-card challenges and be first to slap doubles, sandwiches, tens, and more.", players: "2–6 players", status: "Planned" },
  { id: "spoons", name: "Spoons", icon: "🥄", eyebrow: "Four of a kind scramble", description: "Pass fast, collect four of a kind, then grab a spoon before somebody else does.", players: "3–6 players", status: "Planned" },
  { id: "indians", name: "Indians", icon: "♠", eyebrow: "Progressive Spades", description: "Play partnership Spades while another complete low rank disappears every hand.", players: "4 players", status: "Planned" },
  { id: "poker", name: "Five-Card Draw", icon: "★", eyebrow: "Family poker points", description: "Classic draw poker with game points only: bet, draw, bluff, and compare hands.", players: "2–6 players", status: "Planned" },
  { id: "golf", name: "Six Card Golf", icon: "⛳", eyebrow: "Low score wins", description: "Improve a six-card grid across nine holes and cancel matching columns to zero.", players: "2–4 players", status: "Planned" },
  { id: "chompageddon", name: "Chompageddon!", icon: "👹", eyebrow: "Physics party arcade", description: "Outrageous monsters lunge into a bouncing ball pit. Time your chomps, steal the clusters, and become the greediest creature at the table.", players: "1–4 local players", status: "Planned" },
  { id: "gofyourself", name: "Go F' Yourself", icon: "😈", eyebrow: "Go Fish after dark · 18+", description: "Go Fish with profanity, raunchy innuendo, toxic exes, bad decisions, and absolutely no dignity.", players: "2–6 adults", status: "Planned" },
];

const gameLoaders = import.meta.glob("./games/*/index.jsx");
const LEGACY_GUIDANCE_GAMES = new Set(["canasta", "hearts", "spades", "rummy"]);
const TABLETOP_GUIDANCE_GAMES = new Set(["gofish", "gofyourself", "connect4", "battleship", "hnefatafl", "chompageddon"]);
const PARTY_STAGE_GAMES = new Set(["punchline", "lastonealive", "doodlealibi"]);
const IMMERSIVE_FULLSCREEN_GAMES = new Set([...PARTY_STAGE_GAMES, "pixelquest", "slumlord"]);

function selectedGameId() { return new URLSearchParams(window.location.search).get("game") || ""; }
function gameModulePath(gameId) { return `./games/${gameId}/index.jsx`; }
function navigateToGame(gameId) { const next = new URL(window.location.href); next.searchParams.set("game", gameId); next.searchParams.delete("room"); next.searchParams.delete("role"); window.location.assign(next.toString()); }
function navigateToHub() { const next = new URL(window.location.href); next.searchParams.delete("game"); next.searchParams.delete("room"); next.searchParams.delete("role"); window.location.assign(next.toString()); }

function HubCard({ game }) {
  const available = Boolean(gameLoaders[gameModulePath(game.id)]);
  return (
    <article className={`hub-game-card hub-game-${game.id} ${available ? "available" : "planned"}`}>
      <div className="hub-game-card-topline"><span className="hub-game-icon" aria-hidden="true">{game.icon}</span><span className={`hub-game-status ${available ? "ready" : "planned"}`}>{available ? "Ready to play" : game.status}</span></div>
      <p className="hub-game-eyebrow">{game.eyebrow}</p>
      <h2>{game.name}</h2>
      <p className="hub-game-description">{game.description}</p>
      <div className="hub-game-card-footer"><span>{game.players}</span><button type="button" disabled={!available} onClick={() => navigateToGame(game.id)} aria-label={available ? `Open ${game.name}` : `${game.name} is coming soon`}>{available ? "Play" : "Coming soon"}</button></div>
    </article>
  );
}

function GameHub() {
  return (
    <main className="family-game-hub">
      <section className="hub-hero">
        <div><p className="hub-kicker">Family game night</p><h1>Pick a table. Start a game.</h1><p className="hub-intro">One home for the games people actually play together—cards, boards, strategy, phone-controlled party shows, and one clearly marked adults-only table. Every game keeps its own rules, state, table, and tests while sharing the same front door.</p></div>
        <div className="hub-deck-mark" aria-hidden="true"><span>♠</span><span>⚔</span><span>🎤</span><span>👻</span></div>
      </section>
      <section className="hub-game-grid" aria-label="Available family games">{GAME_CATALOG.map((game) => <HubCard key={game.id} game={game} />)}</section>
      <footer className="hub-footer"><strong>Family Game Room</strong><span>Card games, board games, party games, and strategy tables—each isolated behind its own rules engine.</span></footer>
    </main>
  );
}

function GameUnavailable({ gameId }) {
  const game = GAME_CATALOG.find((candidate) => candidate.id === gameId);
  return <main className="hub-loading-screen"><section><p className="hub-kicker">Game not installed</p><h1>{game?.name || "That game"} is not available on this branch.</h1><p>Return to the hub and choose a game marked ready to play.</p><button type="button" onClick={navigateToHub}>Back to all games</button></section></main>;
}

export default function HubApp() {
  const gameId = useMemo(selectedGameId, []);
  const [loadedGame, setLoadedGame] = useState({ Component: null, error: null });
  const loader = gameId ? gameLoaders[gameModulePath(gameId)] : null;

  useEffect(() => {
    let active = true;
    if (!loader) return () => { active = false; };
    loader().then((module) => {
      if (!active) return;
      if (typeof module.default !== "function") throw new Error(`${gameId} does not export a game component.`);
      setLoadedGame({ Component: module.default, error: null });
    }).catch((error) => { if (active) setLoadedGame({ Component: null, error }); });
    return () => { active = false; };
  }, [gameId, loader]);

  if (!gameId) return <GameHub />;
  if (!loader) return <GameUnavailable gameId={gameId} />;
  if (loadedGame.error) return <main className="hub-loading-screen"><section><p className="hub-kicker">Unable to open game</p><h1>{loadedGame.error.message}</h1><button type="button" onClick={navigateToHub}>Back to all games</button></section></main>;
  if (!loadedGame.Component) return <main className="hub-loading-screen"><section><p className="hub-kicker">Setting the table</p><h1>Opening the game…</h1></section></main>;

  const SelectedGame = loadedGame.Component;
  if (IMMERSIVE_FULLSCREEN_GAMES.has(gameId)) return <SelectedGame />;

  return <><LayoutModeControl gameId={gameId} />{LEGACY_GUIDANCE_GAMES.has(gameId) ? <GameGuidance gameId={gameId} /> : null}{TABLETOP_GUIDANCE_GAMES.has(gameId) ? <TabletopLearningCenter gameId={gameId} /> : <GameLearningCenter gameId={gameId} />}<SelectedGame /></>;
}

export { GAME_CATALOG, PARTY_STAGE_GAMES, gameModulePath, navigateToHub };
