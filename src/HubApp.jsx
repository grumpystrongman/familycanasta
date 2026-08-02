import React, { useEffect, useMemo, useState } from "react";

const GAME_CATALOG = [
  {
    id: "canasta",
    name: "Canasta",
    icon: "♣",
    eyebrow: "Meld strategy",
    description: "The complete family Canasta table, preserved exactly as it plays today.",
    players: "2–6 players",
    status: "Ready",
  },
  {
    id: "hearts",
    name: "Hearts",
    icon: "♥",
    eyebrow: "Avoid the points",
    description: "Pass three cards, dodge penalty tricks, and try to shoot the moon.",
    players: "4 players",
    status: "Planned",
  },
  {
    id: "spades",
    name: "Spades",
    icon: "♠",
    eyebrow: "Bid with a partner",
    description: "Call your contract, manage bags, protect nil bids, and race to 500.",
    players: "4 players",
    status: "Planned",
  },
  {
    id: "rummy",
    name: "Rummy",
    icon: "♦",
    eyebrow: "Sets and runs",
    description: "Draw, meld, lay off, and be the first player to empty your hand.",
    players: "2–6 players",
    status: "Planned",
  },
];

const gameLoaders = import.meta.glob("./games/*/index.jsx");

function selectedGameId() {
  return new URLSearchParams(window.location.search).get("game") || "";
}

function gameModulePath(gameId) {
  return `./games/${gameId}/index.jsx`;
}

function navigateToGame(gameId) {
  const next = new URL(window.location.href);
  next.searchParams.set("game", gameId);
  window.location.assign(next.toString());
}

function navigateToHub() {
  const next = new URL(window.location.href);
  next.searchParams.delete("game");
  window.location.assign(next.toString());
}

function HubCard({ game }) {
  const available = Boolean(gameLoaders[gameModulePath(game.id)]);
  return (
    <article className={`hub-game-card hub-game-${game.id} ${available ? "available" : "planned"}`}>
      <div className="hub-game-card-topline">
        <span className="hub-game-icon" aria-hidden="true">{game.icon}</span>
        <span className={`hub-game-status ${available ? "ready" : "planned"}`}>
          {available ? "Ready to play" : game.status}
        </span>
      </div>
      <p className="hub-game-eyebrow">{game.eyebrow}</p>
      <h2>{game.name}</h2>
      <p className="hub-game-description">{game.description}</p>
      <div className="hub-game-card-footer">
        <span>{game.players}</span>
        <button
          type="button"
          disabled={!available}
          onClick={() => navigateToGame(game.id)}
          aria-label={available ? `Open ${game.name}` : `${game.name} is coming soon`}
        >
          {available ? "Play" : "Coming soon"}
        </button>
      </div>
    </article>
  );
}

function GameHub() {
  return (
    <main className="family-game-hub">
      <section className="hub-hero">
        <div>
          <p className="hub-kicker">Family game night</p>
          <h1>Pick a table. Deal the cards.</h1>
          <p className="hub-intro">
            One home for the card games your family plays together. Every game keeps its own rules,
            scoring, table, and tests while sharing the same welcoming front door.
          </p>
        </div>
        <div className="hub-deck-mark" aria-hidden="true">
          <span>♠</span><span>♥</span><span>♣</span><span>♦</span>
        </div>
      </section>

      <section className="hub-game-grid" aria-label="Available card games">
        {GAME_CATALOG.map((game) => <HubCard key={game.id} game={game} />)}
      </section>

      <footer className="hub-footer">
        <strong>Family Card Room</strong>
        <span>Canasta remains isolated from every new game engine.</span>
      </footer>
    </main>
  );
}

function GameUnavailable({ gameId }) {
  const game = GAME_CATALOG.find((candidate) => candidate.id === gameId);
  return (
    <main className="hub-loading-screen">
      <section>
        <p className="hub-kicker">Game not installed</p>
        <h1>{game?.name || "That game"} is not available on this branch.</h1>
        <p>Return to the hub and choose a game marked ready to play.</p>
        <button type="button" onClick={navigateToHub}>Back to all games</button>
      </section>
    </main>
  );
}

export default function HubApp() {
  const gameId = useMemo(selectedGameId, []);
  const [loadedGame, setLoadedGame] = useState({ Component: null, error: null });
  const loader = gameId ? gameLoaders[gameModulePath(gameId)] : null;

  useEffect(() => {
    let active = true;
    if (!loader) return () => { active = false; };

    loader()
      .then((module) => {
        if (!active) return;
        if (typeof module.default !== "function") throw new Error(`${gameId} does not export a game component.`);
        setLoadedGame({ Component: module.default, error: null });
      })
      .catch((error) => {
        if (active) setLoadedGame({ Component: null, error });
      });

    return () => { active = false; };
  }, [gameId, loader]);

  if (!gameId) return <GameHub />;
  if (!loader) return <GameUnavailable gameId={gameId} />;
  if (loadedGame.error) {
    return (
      <main className="hub-loading-screen">
        <section>
          <p className="hub-kicker">Unable to open game</p>
          <h1>{loadedGame.error.message}</h1>
          <button type="button" onClick={navigateToHub}>Back to all games</button>
        </section>
      </main>
    );
  }
  if (!loadedGame.Component) {
    return (
      <main className="hub-loading-screen">
        <section>
          <p className="hub-kicker">Shuffling the deck</p>
          <h1>Opening the table…</h1>
        </section>
      </main>
    );
  }

  const SelectedGame = loadedGame.Component;
  return <SelectedGame />;
}

export { GAME_CATALOG, gameModulePath, navigateToHub };
