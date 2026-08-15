import React, { useMemo, useState } from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import { BLOOD_ALIBI_RULES, LOCATIONS, METHODS, SUSPECTS, chooseBloodAlibiRobotMove, createBloodAlibiGame, evidenceLabel, reduceBloodAlibi } from "./engine";
import "./styles.css";

const LOCATION_MAP = Object.freeze(Object.fromEntries(LOCATIONS.map((location) => [location.id, location])));

function SelectField({ label, value, onChange, options, disabled }) {
  return <label className="blackglass-select"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

function EvidenceCard({ cardId }) {
  const [kind] = String(cardId).split(":");
  return <article className={`blackglass-evidence-card ${kind}`}><small>{kind.toUpperCase()}</small><strong>{evidenceLabel(cardId)}</strong><span>Ruled out by evidence in your file.</span></article>;
}

function BloodAlibiTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const myLocationId = state.positions?.[user?.uid] || "atrium";
  const myLocation = LOCATION_MAP[myLocationId];
  const [suspectId, setSuspectId] = useState(SUSPECTS[0].id);
  const [methodId, setMethodId] = useState(METHODS[0].id);
  const [accuseLocationId, setAccuseLocationId] = useState(LOCATIONS[0].id);
  const winner = members.find((member) => member.uid === state.winnerUid);
  const myHand = Array.isArray(state.hands?.[user?.uid]) ? state.hands[user.uid] : [];
  const myReveals = Array.isArray(state.reveals) ? state.reveals.filter((reveal) => reveal.toUid === user?.uid) : [];
  const knownEvidence = useMemo(() => [...new Set([...myHand, ...myReveals.map((reveal) => reveal.cardId)])].sort(), [myHand, myReveals]);
  const latestReveal = myReveals[myReveals.length - 1];
  const canInvestigate = myTurn && state.turnPhase === "investigate" && !state.eliminated?.[user?.uid];
  const connected = new Set(myLocation?.links || []);
  const solution = state.solution || {};

  function occupants(locationId) {
    return members.filter((member) => state.positions?.[member.uid] === locationId);
  }

  return <main className="modular-game-shell blackglass-shell"><section className="modular-game-panel blackglass-table">
    <div className="modular-game-toolbar blackglass-toolbar"><div><p className="game-kicker">Modern murder mystery · deduction under pressure</p><h1>Blackglass: Blood &amp; Alibi</h1></div><button type="button" className="secondary" onClick={navigateToHub}>← All games</button></div>
    {error ? <p className="modular-error">{error}</p> : null}
    <PlayerChips members={members} activeUid={state.phase === "playing" ? current?.uid : state.winnerUid} renderDetail={(member) => state.eliminated?.[member.uid] ? "False accusation · out" : member.uid === state.winnerUid ? "Solved the murder" : LOCATION_MAP[state.positions?.[member.uid]]?.name || "Unknown location"} />
    <section className="blackglass-status"><div><small>CASE STATUS</small><strong>{state.message}</strong><span>{myTurn ? state.turnPhase === "move" ? "Choose a connected location." : "Build a theory from the room you're standing in—or make one final accusation." : state.phase === "playing" ? `Waiting for ${current?.nickname}.` : "The case is closed."}</span></div><aside><b>{state.turnNumber || 1}</b><small>turn</small></aside></section>

    <div className="blackglass-grid">
      <section className="blackglass-map-panel"><div className="blackglass-section-heading"><div><small>BLACKGLASS HOTEL</small><h2>Crime scene map</h2></div><span>You are in <strong>{myLocation?.name}</strong></span></div>
        <div className="blackglass-map">
          {LOCATIONS.map((location) => {
            const here = location.id === myLocationId;
            const reachable = myTurn && state.turnPhase === "move" && connected.has(location.id) && !busy && !state.eliminated?.[user?.uid];
            const people = occupants(location.id);
            return <button key={location.id} type="button" disabled={!reachable} onClick={() => act({ type:"move", locationId:location.id })} className={`blackglass-location ${here ? "here" : ""} ${reachable ? "reachable" : ""}`}>
              <small>{here ? "YOU ARE HERE" : reachable ? "MOVE HERE" : "LOCATION"}</small><strong>{location.name}</strong><span>{location.detail}</span>{people.length ? <em>{people.map((member) => member.avatar).join(" ")} {people.map((member) => member.nickname).join(", ")}</em> : null}
            </button>;
          })}
        </div>
      </section>

      <aside className="blackglass-case-panel"><div className="blackglass-section-heading"><div><small>YOUR PRIVATE FILE</small><h2>Known evidence</h2></div><span>{knownEvidence.length} ruled out</span></div>
        {latestReveal ? <div className="blackglass-reveal"><small>LATEST REVEAL</small><strong>{evidenceLabel(latestReveal.cardId)}</strong><span>{members.find((member) => member.uid === latestReveal.fromUid)?.nickname || "Another investigator"} could refute your theory.</span></div> : null}
        <div className="blackglass-evidence-list">{knownEvidence.map((cardId) => <EvidenceCard key={cardId} cardId={cardId} />)}</div>
        <p className="blackglass-privacy-note">Hidden-information note: cards and the solution are concealed by the interface, but this first version uses the shared modular room state and is not cheat-resistant against someone inspecting raw Firebase data.</p>
      </aside>
    </div>

    <section className="blackglass-theory-panel"><div><p className="game-kicker">Theory desk</p><h2>{canInvestigate ? `What happened in ${myLocation?.name}?` : "Build your next theory"}</h2><p>A normal theory always uses your current location. A final accusation can name any location, but one wrong accusation removes you from the investigation.</p></div><div className="blackglass-controls">
      <SelectField label="Suspect" value={suspectId} onChange={setSuspectId} options={SUSPECTS} disabled={!canInvestigate || busy} />
      <SelectField label="Method" value={methodId} onChange={setMethodId} options={METHODS} disabled={!canInvestigate || busy} />
      <div className="blackglass-action-row"><button type="button" className="action-button" disabled={!canInvestigate || busy} onClick={() => act({ type:"suggest", suspectId, methodId })}>Test theory in {myLocation?.name}</button><button type="button" className="secondary" disabled={!canInvestigate || busy} onClick={() => act({ type:"end" })}>End turn quietly</button></div>
      <details className="blackglass-accuse"><summary>Make a final accusation</summary><div><SelectField label="Final location" value={accuseLocationId} onChange={setAccuseLocationId} options={LOCATIONS} disabled={!canInvestigate || busy} /><button type="button" className="blackglass-accuse-button" disabled={!canInvestigate || busy} onClick={() => act({ type:"accuse", suspectId, methodId, locationId:accuseLocationId })}>Lock accusation — no take-backs</button></div></details>
    </div></section>

    <section className="blackglass-suspect-strip"><div className="blackglass-section-heading"><div><small>PERSONS OF INTEREST</small><h2>Six ugly motives</h2></div></div><div>{SUSPECTS.map((suspect) => <article key={suspect.id}><strong>{suspect.name}</strong><small>{suspect.role}</small><span>{suspect.detail}</span></article>)}</div></section>
    <section className="blackglass-log"><div className="blackglass-section-heading"><div><small>SHARED CASE LOG</small><h2>What everyone saw</h2></div></div>{(state.caseLog || []).slice(-8).reverse().map((entry, index) => <p key={`${entry.type}-${index}`}>{entry.text}</p>)}</section>

    {state.phase === "game-over" ? <div className="blackglass-game-over"><div><p className="game-kicker">CASE CLOSED</p><h2>{winner ? `${winner.nickname} solved Blackglass` : "The case went cold"}</h2><p>The truth: <strong>{SUSPECTS.find((item) => item.id === solution.suspectId)?.name}</strong> · <strong>{METHODS.find((item) => item.id === solution.methodId)?.name}</strong> · <strong>{LOCATIONS.find((item) => item.id === solution.locationId)?.name}</strong>.</p></div><button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button></div> : null}
  </section></main>;
}

export default function BloodAlibiGame() {
  const controller = useModularTable({ gameId:"bloodalibi", maxPlayers:BLOOD_ALIBI_RULES.playersMax, minimumPlayers:BLOOD_ALIBI_RULES.playersMin, createGameState:createBloodAlibiGame, reduceGameState:reduceBloodAlibi, chooseRobotMove:chooseBloodAlibiRobotMove, robotDelay:700 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Blackglass: Blood & Alibi" kicker="Move · question · eliminate · accuse" summary="An original modern murder-mystery deduction game set inside the Blackglass Hotel: six suspects, nine connected crime scenes, six brutal methods, private evidence files, refuted theories, false-accusation elimination, and a hidden three-part solution." maxPlayers={6} quickPlayChoices={[{ icon:"🩸", label:"Open a case vs robot", description:"Learn the deduction loop immediately with one automated investigator.", rules:{} }]} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening the Blackglass case file…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Blackglass: Blood & Alibi" minimumPlayers={2} maxPlayers={6} startLabel="Seal the hotel" lobbyHint="Two to six investigators. The hotel, suspects, methods, evidence copy, and movement graph are original to this game." />;
  return <BloodAlibiTable controller={controller} />;
}

export const gameInfo = Object.freeze({ id:"bloodalibi", name:"Blackglass: Blood & Alibi", players:"2–6" });
