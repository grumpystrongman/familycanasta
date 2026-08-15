import React, { useEffect, useMemo, useState } from "react";
import GameGuidance from "./platform/GameGuidance";
import GameLearningCenter from "./platform/GameLearningCenter";
import TabletopLearningCenter from "./platform/TabletopLearningCenter";
import LayoutModeControl from "./platform/LayoutModeControl";
import { GAME_CATALOG, GAME_CATEGORIES } from "./gameCatalog.js";

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
        <div><p className="hub-kicker">Family game night</p><h1>Pick a shelf. Find your game.</h1><p className="hub-intro">The library is organized the way people actually browse a game night: card games, board games, and video games. Every title keeps its own rules, state, table, and tests while sharing the same front door.</p></div>
        <div className="hub-deck-mark" aria-hidden="true"><span>🂡</span><span>♟</span><span>🎮</span></div>
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
