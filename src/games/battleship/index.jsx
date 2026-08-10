import React from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { BATTLESHIP_FLEET, BATTLESHIP_RULES, cellLabel, chooseBattleshipRobotMove, createBattleshipGame, reduceBattleship } from "./engine";
import "./styles.css";

function fleetCellMap(fleet = []) {
  const map = {};
  for (const ship of fleet) for (const cell of ship.cells) map[cell] = ship;
  return map;
}

function OceanGrid({ title, fleet = [], shots = {}, target = false, enabled = false, busy = false, onFire }) {
  const ships = fleetCellMap(fleet);
  return (
    <section className={`battle-ocean-panel ${target ? "target" : "own"}`}>
      <div className="battle-ocean-title"><h3>{title}</h3><span>{target ? "Enemy waters" : "Your fleet"}</span></div>
      <div className="battle-ocean" role="grid" aria-label={title}>
        {Array.from({ length: BATTLESHIP_RULES.size * BATTLESHIP_RULES.size }, (_, cell) => {
          const shot = shots[cell];
          const ship = ships[cell];
          const fired = shot != null;
          return (
            <button
              key={cell}
              type="button"
              role="gridcell"
              className={`${ship && !target ? "ship" : ""} ${shot || ""}`}
              disabled={!target || !enabled || busy || fired}
              onClick={() => target && onFire?.(cell)}
              aria-label={`${cellLabel(cell)}${shot ? ` ${shot}` : ship && !target ? ` ${ship.name}` : ""}`}
            >
              <small>{cellLabel(cell)}</small>
              {shot === "hit" ? <b>✹</b> : shot === "miss" ? <i>•</i> : ship && !target ? <span /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BattleshipTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const current = members[Number(state.currentPlayerIndex || 0)];
  const opponent = members.find((member) => member.uid !== user?.uid);
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const myFleet = state.fleets?.[user?.uid] || [];
  const enemyFleet = state.fleets?.[opponent?.uid] || [];
  const myShots = state.shots?.[user?.uid] || {};
  const incomingShots = state.shots?.[opponent?.uid] || {};
  const winner = members.find((member) => member.uid === state.winnerUid);

  return (
    <main className="modular-game-shell battleship-shell"><section className="modular-game-panel battleship-table">
      <div className="modular-game-toolbar"><div><p className="game-kicker">Naval deduction · hunt the hidden fleet</p><h1>Battleship</h1></div><button type="button" className="secondary" onClick={navigateToHub}>All games</button></div>
      {error ? <p className="modular-error">{error}</p> : null}
      <PlayerChips members={members} renderDetail={(member) => {
        const fleet = state.fleets?.[member.uid] || [];
        const sunk = fleet.filter((ship) => ship.hits.length >= ship.cells.length).length;
        return `${BATTLESHIP_FLEET.length - sunk} ships afloat${current?.uid === member.uid && state.phase === "playing" ? " · firing" : ""}`;
      }} />
      <section className="battle-status" aria-live="polite"><strong>{state.message}</strong><span>{myTurn ? "Your shot. Pick a square in enemy waters." : state.phase === "playing" ? `Waiting for ${current?.nickname}.` : "Battle complete."}</span></section>
      <div className="battle-fleet-status">
        {myFleet.map((ship) => <span key={ship.id} className={ship.hits.length >= ship.cells.length ? "sunk" : ""}><b>{ship.name}</b> {ship.hits.length}/{ship.size} hits</span>)}
      </div>
      <div className="battle-layout">
        <OceanGrid title="Your ocean" fleet={myFleet} shots={incomingShots} />
        <OceanGrid title={`Target: ${opponent?.nickname || "Enemy"}`} fleet={enemyFleet} shots={myShots} target enabled={myTurn} busy={busy} onFire={(cell) => act({ type: "fire", cell })} />
      </div>
      <p className="battle-note">Fleets are auto-deployed at the start so the room gets straight to firing. Your opponent never sees unhit ship positions on their targeting board.</p>
      {state.phase === "game-over" ? <div className="battle-game-over"><h2>{winner?.nickname || "Winner"} controls the sea</h2><button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button></div> : null}
    </section></main>
  );
}

export default function BattleshipGame() {
  const controller = useModularTable({ gameId: "battleship", maxPlayers: 2, minimumPlayers: 2, createGameState: createBattleshipGame, reduceGameState: reduceBattleship, chooseRobotMove: chooseBattleshipRobotMove, robotDelay: 900 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Battleship" kicker="Find them before they find you" summary="Two hidden 10×10 fleets, classic Carrier/Battleship/Cruiser/Submarine/Destroyer lineups, and alternating shots until one navy is completely sunk." maxPlayers={2} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening Battleship room…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Battleship" minimumPlayers={2} maxPlayers={2} startLabel="Deploy fleets" />;
  return <BattleshipTable controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "battleship", name: "Battleship", players: "2" });
