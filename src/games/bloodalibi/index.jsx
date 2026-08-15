import React, { useMemo, useState } from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby, PlayerChips } from "../../platform/ModularGameChrome";
import { navigateToHub } from "../../HubApp";
import {
  BLOOD_ALIBI_RULES,
  BOARD_SIZE,
  CORRIDOR_SPACES,
  LOCATIONS,
  METHODS,
  SUSPECTS,
  boardRoomId,
  chooseBloodAlibiRobotMove,
  createBloodAlibiGame,
  evidenceLabel,
  getReachableBoardNodes,
  normalizeBoardPosition,
  reduceBloodAlibi,
  roomNodeId,
} from "./engine";
import "./styles.css";

const LOCATION_MAP = Object.freeze(Object.fromEntries(LOCATIONS.map((location) => [location.id, location])));
const DIE_PIPS = Object.freeze({
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
});

function SelectField({ label, value, onChange, options, disabled }) {
  return <label className="blackglass-select"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

function EvidenceCard({ cardId }) {
  const [kind] = String(cardId).split(":");
  return <article className={`blackglass-evidence-card ${kind}`}><small>{kind.toUpperCase()}</small><strong>{evidenceLabel(cardId)}</strong><span>Ruled out by evidence in your file.</span></article>;
}

function DieFace({ value, rolling }) {
  const pips = DIE_PIPS[value] || [];
  return <div className={`blackglass-die ${rolling ? "rolling" : ""} ${value ? "rolled" : "idle"}`} aria-label={value ? `Die shows ${value}` : "Die not rolled yet"}>
    {Array.from({ length: 9 }, (_, index) => <span key={index} className={pips.includes(index + 1) ? "on" : ""} />)}
  </div>;
}

function InvestigatorToken({ member, eliminated, isYou }) {
  const hue = (Number(member.seat || 0) * 61 + 8) % 360;
  return <span className={`blackglass-pawn ${eliminated ? "eliminated" : ""} ${isYou ? "you" : ""}`} style={{ "--pawn-hue": hue }} title={`${member.nickname}${isYou ? " (you)" : ""}`}>
    <i aria-hidden="true" />
    <b>{member.avatar || "●"}</b>
  </span>;
}

function SuspectMarker({ suspect }) {
  return <span className="blackglass-suspect-marker" title={suspect.name}>{suspect.name.split(" ").map((part) => part[0]).join("")}</span>;
}

function HotelBoard({ state, members, user, myTurn, busy, act }) {
  const me = members.find((member) => member.uid === user?.uid);
  const myNodeId = normalizeBoardPosition(state.positions?.[user?.uid], me?.seat);
  const reachable = useMemo(() => {
    if (!myTurn || state.turnPhase !== "move" || !user?.uid) return new Map();
    return new Map(getReachableBoardNodes(state, user.uid, members).map((item) => [item.id, item]));
  }, [state, members, myTurn, user?.uid]);

  function occupants(nodeId) {
    return members.filter((member) => normalizeBoardPosition(state.positions?.[member.uid], member.seat) === nodeId);
  }

  function suspectsInRoom(locationId) {
    return SUSPECTS.filter((suspect) => state.suspectPositions?.[suspect.id] === locationId);
  }

  function moveTo(nodeId) {
    if (!reachable.has(nodeId) || busy) return;
    act({ type: "move", nodeId });
  }

  return <div className="blackglass-board-scroll">
    <div className="blackglass-board-stage">
      <div className="blackglass-board-skyline" aria-hidden="true" />
      <div className="blackglass-board-plane" style={{ "--board-size": BOARD_SIZE }}>
        <div className="blackglass-board-grid" aria-label="Blackglass Hotel playboard">
          {LOCATIONS.map((location) => {
            const nodeId = roomNodeId(location.id);
            const roomReach = reachable.get(nodeId);
            const here = myNodeId === nodeId;
            const roomOccupants = occupants(nodeId);
            const roomSuspects = suspectsInRoom(location.id);
            return <button
              key={location.id}
              type="button"
              className={`blackglass-board-room theme-${location.theme} ${here ? "here" : ""} ${roomReach ? "reachable" : ""}`}
              style={{ gridColumn: `${location.bounds.x + 1} / span ${location.bounds.w}`, gridRow: `${location.bounds.y + 1} / span ${location.bounds.h}` }}
              disabled={!roomReach || busy}
              onClick={() => moveTo(nodeId)}
              aria-label={roomReach ? `Enter ${location.name}, costs ${roomReach.distance} movement` : location.name}
            >
              <span className="blackglass-room-light" aria-hidden="true" />
              <span className="blackglass-room-copy"><small>{here ? "YOUR LOCATION" : roomReach ? `${roomReach.distance} MOVE${roomReach.distance === 1 ? "" : "S"}` : "CRIME SCENE"}</small><strong>{location.name}</strong><em>{location.detail}</em></span>
              {location.passageTo ? <span className="blackglass-passage-mark">⇄ {LOCATION_MAP[location.passageTo]?.name}</span> : null}
              {roomSuspects.length ? <span className="blackglass-suspect-stack">{roomSuspects.map((suspect) => <SuspectMarker key={suspect.id} suspect={suspect} />)}</span> : null}
              {roomOccupants.length ? <span className="blackglass-token-stack">{roomOccupants.map((member) => <InvestigatorToken key={member.uid} member={member} eliminated={state.eliminated?.[member.uid]} isYou={member.uid === user?.uid} />)}</span> : null}
            </button>;
          })}

          {CORRIDOR_SPACES.map((space) => {
            const reach = reachable.get(space.id);
            const here = myNodeId === space.id;
            const people = occupants(space.id);
            return <button
              key={space.id}
              type="button"
              className={`blackglass-hall-space ${here ? "here" : ""} ${reach ? "reachable" : ""}`}
              style={{ gridColumn: space.x + 1, gridRow: space.y + 1 }}
              disabled={!reach || busy}
              onClick={() => moveTo(space.id)}
              aria-label={reach ? `Move ${reach.distance} spaces here` : "Hotel corridor"}
            >
              {reach ? <span className="blackglass-move-cost">{reach.distance}</span> : null}
              {people.length ? <span className="blackglass-hall-tokens">{people.map((member) => <InvestigatorToken key={member.uid} member={member} eliminated={state.eliminated?.[member.uid]} isYou={member.uid === user?.uid} />)}</span> : null}
            </button>;
          })}
        </div>
      </div>
      <div className="blackglass-board-caption"><span>BLACKGLASS HOTEL · 3:17 AM</span><small>Highlighted floor spaces are reachable with your remaining movement.</small></div>
    </div>
  </div>;
}

function BloodAlibiTable({ controller }) {
  const { room, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const me = members.find((member) => member.uid === user?.uid);
  const myNodeId = normalizeBoardPosition(state.positions?.[user?.uid], me?.seat);
  const myRoomId = boardRoomId(myNodeId);
  const myLocation = LOCATION_MAP[myRoomId];
  const [suspectId, setSuspectId] = useState(SUSPECTS[0].id);
  const [methodId, setMethodId] = useState(METHODS[0].id);
  const [accuseLocationId, setAccuseLocationId] = useState(LOCATIONS[0].id);
  const [rolling, setRolling] = useState(false);
  const winner = members.find((member) => member.uid === state.winnerUid);
  const myHand = Array.isArray(state.hands?.[user?.uid]) ? state.hands[user.uid] : [];
  const myReveals = Array.isArray(state.reveals) ? state.reveals.filter((reveal) => reveal.toUid === user?.uid) : [];
  const knownEvidence = useMemo(() => [...new Set([...myHand, ...myReveals.map((reveal) => reveal.cardId)])].sort(), [myHand, myReveals]);
  const latestReveal = myReveals[myReveals.length - 1];
  const eliminated = Boolean(state.eliminated?.[user?.uid]);
  const canRoll = myTurn && state.turnPhase === "roll" && !eliminated;
  const canInvestigate = myTurn && state.turnPhase === "investigate" && !eliminated && Boolean(myRoomId);
  const solution = state.solution || {};

  function locationForMember(member) {
    const node = normalizeBoardPosition(state.positions?.[member.uid], member.seat);
    const roomId = boardRoomId(node);
    return roomId ? LOCATION_MAP[roomId]?.name : "Hotel corridor";
  }

  async function rollDie() {
    if (!canRoll || busy) return;
    setRolling(true);
    try { await act({ type: "roll" }); }
    finally { window.setTimeout(() => setRolling(false), 420); }
  }

  const turnInstruction = !myTurn
    ? state.phase === "playing" ? `Waiting for ${current?.nickname}.` : "The case is closed."
    : state.turnPhase === "roll"
      ? myRoomId ? "Roll, use a secret passage, or stay and investigate this room." : "Roll the die to move through the hotel."
      : state.turnPhase === "move"
        ? `${state.moveRemaining || 0} movement remaining. Entering a room ends movement.`
        : `Build a theory from ${myLocation?.name || "the room"}, make a final accusation, or end your turn.`;

  return <main className="modular-game-shell blackglass-shell"><section className="modular-game-panel blackglass-table">
    <div className="modular-game-toolbar blackglass-toolbar"><div><p className="game-kicker">Modern murder mystery · physical deduction board</p><h1>Blackglass: Blood &amp; Alibi</h1></div><button type="button" className="secondary" onClick={navigateToHub}>← All games</button></div>
    {error ? <p className="modular-error">{error}</p> : null}
    <PlayerChips members={members} activeUid={state.phase === "playing" ? current?.uid : state.winnerUid} renderDetail={(member) => state.eliminated?.[member.uid] ? "False accusation · out" : member.uid === state.winnerUid ? "Solved the murder" : locationForMember(member)} />

    <section className="blackglass-status">
      <div className="blackglass-status-copy"><small>CASE STATUS</small><strong>{state.message}</strong><span>{turnInstruction}</span></div>
      <div className="blackglass-turn-console">
        <div className="blackglass-turn-number"><b>{state.turnNumber || 1}</b><small>turn</small></div>
        <DieFace value={state.lastRoll} rolling={rolling} />
        <div className="blackglass-dice-actions">
          <button type="button" className="action-button blackglass-roll-button" disabled={!canRoll || busy} onClick={rollDie}>🎲 Roll die</button>
          {canRoll && myLocation?.passageTo ? <button type="button" className="secondary" disabled={busy} onClick={() => act({ type: "passage" })}>Secret passage → {LOCATION_MAP[myLocation.passageTo]?.name}</button> : null}
          {canRoll && myRoomId ? <button type="button" className="secondary" disabled={busy} onClick={() => act({ type: "investigateHere" })}>Stay &amp; investigate</button> : null}
          {myTurn && state.turnPhase === "move" ? <button type="button" className="secondary" disabled={busy} onClick={() => act({ type: "endMove" })}>End movement</button> : null}
        </div>
      </div>
    </section>

    <div className="blackglass-grid">
      <section className="blackglass-map-panel">
        <div className="blackglass-section-heading"><div><small>BLACKGLASS HOTEL</small><h2>Investigation floor</h2></div><span>{myRoomId ? <>You are in <strong>{myLocation?.name}</strong></> : <>You are in the <strong>corridor</strong></>}</span></div>
        <HotelBoard state={state} members={members} user={user} myTurn={myTurn} busy={busy} act={act} />
      </section>

      <aside className="blackglass-case-panel"><div className="blackglass-section-heading"><div><small>YOUR PRIVATE FILE</small><h2>Known evidence</h2></div><span>{knownEvidence.length} ruled out</span></div>
        {latestReveal ? <div className="blackglass-reveal"><small>LATEST REVEAL</small><strong>{evidenceLabel(latestReveal.cardId)}</strong><span>{members.find((member) => member.uid === latestReveal.fromUid)?.nickname || "Another investigator"} could refute your theory.</span></div> : null}
        <div className="blackglass-evidence-list">{knownEvidence.map((cardId) => <EvidenceCard key={cardId} cardId={cardId} />)}</div>
        <p className="blackglass-privacy-note">Hidden-information note: cards and the solution are concealed by the interface, but this version still uses shared modular room state and is not cheat-resistant against someone inspecting raw Firebase data.</p>
      </aside>
    </div>

    <section className="blackglass-theory-panel"><div><p className="game-kicker">Theory desk</p><h2>{canInvestigate ? `What happened in ${myLocation?.name}?` : myRoomId ? `You are in ${myLocation?.name}` : "Get inside a room to test a theory"}</h2><p>Roll and move through the physical hotel board. A normal theory uses the room your pawn occupies and pulls the named suspect marker into that scene. A final accusation can name any room, but one wrong accusation removes you from the investigation.</p></div><div className="blackglass-controls">
      <SelectField label="Suspect" value={suspectId} onChange={setSuspectId} options={SUSPECTS} disabled={!canInvestigate || busy} />
      <SelectField label="Method" value={methodId} onChange={setMethodId} options={METHODS} disabled={!canInvestigate || busy} />
      <div className="blackglass-action-row"><button type="button" className="action-button" disabled={!canInvestigate || busy} onClick={() => act({ type: "suggest", suspectId, methodId })}>Test theory in {myLocation?.name || "this room"}</button><button type="button" className="secondary" disabled={!canInvestigate || busy} onClick={() => act({ type: "end" })}>End turn quietly</button></div>
      <details className="blackglass-accuse"><summary>Make a final accusation</summary><div><SelectField label="Final location" value={accuseLocationId} onChange={setAccuseLocationId} options={LOCATIONS} disabled={!canInvestigate || busy} /><button type="button" className="blackglass-accuse-button" disabled={!canInvestigate || busy} onClick={() => act({ type: "accuse", suspectId, methodId, locationId: accuseLocationId })}>Lock accusation — no take-backs</button></div></details>
    </div></section>

    <section className="blackglass-suspect-strip"><div className="blackglass-section-heading"><div><small>PERSONS OF INTEREST</small><h2>Six ugly motives</h2></div></div><div>{SUSPECTS.map((suspect) => <article key={suspect.id}><strong>{suspect.name}</strong><small>{suspect.role}</small><span>{suspect.detail}</span><em>Last placed: {LOCATION_MAP[state.suspectPositions?.[suspect.id]]?.name || "unknown"}</em></article>)}</div></section>
    <section className="blackglass-log"><div className="blackglass-section-heading"><div><small>SHARED CASE LOG</small><h2>What everyone saw</h2></div></div>{(state.caseLog || []).slice(-10).reverse().map((entry, index) => <p key={`${entry.type}-${index}`}>{entry.text}</p>)}</section>

    {state.phase === "game-over" ? <div className="blackglass-game-over"><div><p className="game-kicker">CASE CLOSED</p><h2>{winner ? `${winner.nickname} solved Blackglass` : "The case went cold"}</h2><p>The truth: <strong>{SUSPECTS.find((item) => item.id === solution.suspectId)?.name}</strong> · <strong>{METHODS.find((item) => item.id === solution.methodId)?.name}</strong> · <strong>{LOCATIONS.find((item) => item.id === solution.locationId)?.name}</strong>.</p></div><button type="button" className="action-button" onClick={navigateToHub}>Return to all games</button></div> : null}
  </section></main>;
}

export default function BloodAlibiGame() {
  const controller = useModularTable({ gameId: "bloodalibi", maxPlayers: BLOOD_ALIBI_RULES.playersMax, minimumPlayers: BLOOD_ALIBI_RULES.playersMin, createGameState: createBloodAlibiGame, reduceGameState: reduceBloodAlibi, chooseRobotMove: chooseBloodAlibiRobotMove, robotDelay: 700 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Blackglass: Blood & Alibi" kicker="Roll · move · question · eliminate · accuse" summary="An original modern murder-mystery board game set inside the Blackglass Hotel: roll the die, move a physical investigator pawn through corridors and rooms, use secret passages, test theories, reveal private evidence, eliminate false accusations, and solve the hidden three-part murder." maxPlayers={6} quickPlayChoices={[{ icon: "🩸", label: "Open a case vs robot", description: "Learn the full board-game loop immediately with one automated investigator.", rules: {} }]} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening the Blackglass case file…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Blackglass: Blood & Alibi" minimumPlayers={2} maxPlayers={6} startLabel="Seal the hotel" lobbyHint="Two to six investigators. Roll for movement, navigate the hotel floor plan, enter rooms, test theories, use secret passages, refute with evidence, and risk a final accusation." />;
  return <BloodAlibiTable controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "bloodalibi", name: "Blackglass: Blood & Alibi", players: "2–6" });
