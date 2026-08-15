import React, { useEffect, useMemo, useState } from "react";
import GameGuidance from "./platform/GameGuidance";
import GameLearningCenter from "./platform/GameLearningCenter";
import TabletopLearningCenter from "./platform/TabletopLearningCenter";
import LayoutModeControl from "./platform/LayoutModeControl";

const GAME_CATEGORIES = [
  {
    id: "card",
    label: "Card Games",
    icon: "🂡",
    description: "Classic hands, tricks, melds, draws, slaps, and family-table chaos.",
  },
  {
    id: "board",
    label: "Board Games",
    icon: "♟",
    description: "Strategy, deduction, wordplay, property battles, and head-to-head tabletop games.",
  },
  {
    id: "video",
    label: "Video Games",
    icon: "🎮",
    description: "Digital-first adventures, party shows, arcade games, and phone-controlled experiences.",
  },
];

const GAME_CATALOG = [
  { id: "canasta", category: "card", name: "Canasta", icon: "♣", eyebrow: "Meld strategy", description: "The complete family Canasta table, preserved exactly as it plays today.", players: "2–6 players", status: "Ready" },
  { id: "pixelquest", category: "video", name: "PixelQuest: The Living Dungeon", icon: "⚔", eyebrow: "Co-op fantasy campaign", description: "A 1–8 player living dungeon with honest d20 dice, tactical battles, party votes, private choices, AI companions, and twenty adventure cartridges.", players: "1–8 online players", status: "Ready" },
  { id: "punchline", category: "video", name: "Punchline", icon: "🎤", eyebrow: "Write it · vote it", description: "A big-screen comedy show where every phone writes the punchlines and the room decides what lands.", players: "3–12 phones", status: "Ready" },
  { id: "lastonealive", category: "video", name: "Last One Alive", icon: "👻", eyebrow: "Trivia · traps · escape", description: "Horror-comedy trivia with six survival micro-games, ghosts, resurrection, and a final race for the exit.", players: "3–12 phones", status: "Ready" },
  { id: "doodlealibi", category: "video", name: "Doodle Alibi", icon: "🖍️", eyebrow: "Draw · accuse · deceive", description: "Draw secret assignments on your phone, study the TV evidence wall, and expose the altered prompt.", players: "4–12 phones", status: "Ready" },
  { id: "slumlord", category: "board", name: "Slum Lord", icon: "🏚️", eyebrow: "Buy · patch · collect", description: "A full-board property game with terrible maintenance: buy the block, patch the leaks, dodge inspections, trade properties, and collect rent.", players: "2–4 local players", status: "Ready" },
  { id: "chess", category: "board", name: "Chess", icon: "♚", eyebrow: "Pure strategy", description: "Full legal chess with check, checkmate, castling, en passant, stalemate, and a quick robot opponent.", players: "2 players", status: "Ready" },
  { id: "checkers", category: "board", name: "Checkers", icon: "⛀", eyebrow: "Jump · crown · trap", description: "American checkers with mandatory captures, chained jumps, kings, online rooms, and robot play.", players: "2 players", status: "Ready" },
  { id: "lexiconforge", category: "board", name: "Lexicon Forge", icon: "⚒", eyebrow: "Build words · claim premiums", description: "Original word-tile strategy with seven-tile racks, cross-word scoring, exchanges, custom tile math, and house-rule word challenges.", players: "2–4 players", status: "Ready" },
  { id: "bloodalibi", category: "board", name: "Blackglass: Blood & Alibi", icon: "🩸", eyebrow: "Modern murder mystery", description: "A darker deduction case with six original suspects, nine crime scenes, brutal methods, evidence files, and final accusations.", players: "2–6 investigators", status: "Ready" },
  { id: "hearts", category: "card", name: "Hearts", icon: "♥", eyebrow: "Avoid the points", description: "Pass three cards, dodge penalty tricks, and try to shoot the moon.", players: "4 players", status: "Planned" },
  { id: "spades", category: "card", name: "Spades", icon: "♠", eyebrow: "Bid with a partner", description: "Call your contract, manage bags, protect nil bids, and race to 500.", players: "4 players", status: "Planned" },
  { id: "rummy", category: "card", name: "Rummy", icon: "♦", eyebrow: "Sets and runs", description: "Draw, meld, lay off, and be the first player to empty your hand.", players: "2–6 players", status: "Planned" },
  { id: "gofish", category: "card", name: "Go Fish", icon: "🐟", eyebrow: "Ask, draw, collect", description: "Ask for ranks you hold, build four-card books, and fish from the pond when you miss.", players: "2–6 players", status: "Planned" },
  { id: "connect4", category: "board", name: "Connect 4", icon: "🔴", eyebrow: "Vertical strategy", description: "Drop checkers into a 7×6 board, block threats, and connect four before your opponent.", players: "2 players", status: "Planned" },
  { id: "battleship", category: "board", name: "Battleship", icon: "⚓", eyebrow: "Hidden-fleet tactics", description: "Hunt a hidden 10×10 fleet with classic ships, alternating shots, hits, misses, and sinks.", players: "2 players", status: "Planned" },
  { id: "hnefatafl", category: "board", name: "Hnefatafl", icon: "♔", eyebrow: "Viking king hunt", description: "An asymmetric 11×11 siege: raiders hunt the king while defenders fight to escape him to a corner.", players: "2 players", status: "Planned" },
  { id: "ers", category: "card", name: "Egyptian Rat Screw", icon: "⚡", eyebrow: "Flip and react", description: "Survive face-card challenges and be first to slap doubles, sandwiches, tens, and more.", players: "2–6 players", status: "Planned" },
  { id: "spoons", category: "card", name: "Spoons", icon: "🥄", eyebrow: "Four of a kind scramble", description: "Pass fast, collect four of a kind, then grab a spoon before somebody else does.", players: "3–6 players", status: "Planned" },
  { id: "indians", category: "card", name: "Indians", icon: "♠", eyebrow: "Progressive Spades", description: "Play partnership Spades while another complete low rank disappears every hand.", players: "4 players", status: "Planned" },
  { id: "poker", category: "card", name: "Five-Card Draw", icon: "★", eyebrow: "Family poker points", description: "Classic draw poker with game points only: bet, draw, bluff, and compare hands.", players: "2–6 players", status: "Planned" },
  { id: "golf", category: "card", name: "Six Card Golf", icon: "⛳", eyebrow: "Low score wins", description: "Improve a six-card grid across nine holes and cancel matching columns to zero.", players: "2–4 players", status: "Planned" },
  { id: "chompageddon", category: "video", name: "Chompageddon!", icon: "👹", eyebrow: "Physics party arcade", description: "Outrageous monsters lunge into a shared bouncing ball pit. Play solo, cause couch chaos, or battle friends online with room codes and bots filling empty seats.", players: "1–4 local · 2–4 online", status: "Planned" },
  { id: "gofyourself", category: "card", name: "Go F' Yourself", icon: "😈", eyebrow: "Go Fish after dark · 18+", description: "Go Fish with profanity, raunchy innuendo, toxic exes, bad decisions, and absolutely no dignity.", players: "2–6 adults", status: "Planned" },
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
        <div><p className="hub-kicker">Family game night</p><h1>Pick a shelf. Find your game.</h1><p className="hub-intro">The library is organized the way people actually browse a game night: card games, board games, and video games. Every title still keeps its own rules, state, table, and tests while sharing the same front door.</p></div>
        <div className="hub-deck-mark" aria-hidden="true"><span>♠</span><span>♟</span><span>🎮</span><span>♥</span></div>
      </section>

      <nav className="hub-category-nav" aria-label="Game library categories">
        {GAME_CATEGORIES.map((category) => {
          const games = GAME_CATALOG.filter((game) => game.category === category.id);
          const ready = games.filter((game) => Boolean(gameLoaders[gameModulePath(game.id)])).length;
          return (
            <a key={category.id} className={`hub-category-link hub-category-${category.id}`} href={`#${category.id}-games`}>
              <span className="hub-category-link-icon" aria-hidden="true">{category.icon}</span>
              <span><strong>{category.label}</strong><small>{games.length} games · {ready} ready</small></span>
            </a>
          );
        })}
      </nav>

      <div className="hub-library">
        {GAME_CATEGORIES.map((category) => {
          const games = GAME_CATALOG.filter((game) => game.category === category.id);
          const ready = games.filter((game) => Boolean(gameLoaders[gameModulePath(game.id)])).length;
          return (
            <section key={category.id} id={`${category.id}-games`} className={`hub-category-section hub-category-section-${category.id}`} aria-labelledby={`${category.id}-games-title`}>
              <header className="hub-category-header">
                <div className="hub-category-heading">
                  <span className="hub-category-icon" aria-hidden="true">{category.icon}</span>
                  <div><p className="hub-kicker">Game library</p><h2 id={`${category.id}-games-title`}>{category.label}</h2><p>{category.description}</p></div>
                </div>
                <span className="hub-category-count">{ready} ready · {games.length - ready} planned</span>
              </header>
              <div className="hub-game-grid" aria-label={category.label}>{games.map((game) => <HubCard key={game.id} game={game} />)}</div>
            </section>
          );
        })}
      </div>

      <footer className="hub-footer"><strong>Family Game Room</strong><span>Three shelves, one game night: cards, boards, and video games.</span></footer>
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

export { GAME_CATALOG, GAME_CATEGORIES, PARTY_STAGE_GAMES, gameModulePath, navigateToHub };
