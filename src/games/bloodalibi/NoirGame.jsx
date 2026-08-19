import React, { useEffect, useMemo, useState } from "react";
import useModularTable from "../../platform/useModularTable";
import { GameHome, GameLobby } from "../../platform/ModularGameChrome";
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
import { itemAssetUrl, theoryAssetUrls } from "./itemAssets";
import "./noir.css";

const LOCATION_MAP = Object.freeze(Object.fromEntries(LOCATIONS.map((item) => [item.id, item])));
const DIE_PIPS = Object.freeze({ 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] });
const NOTEBOOK_GROUPS = Object.freeze([
  ["suspect", "Suspects", SUSPECTS],
  ["method", "Weapons", METHODS],
  ["location", "Rooms", LOCATIONS],
]);

function Die({ value, rolling }) {
  const pips = DIE_PIPS[value] || [];
  return <div className={`bn-die ${rolling ? "rolling" : ""}`} aria-label={value ? `Die shows ${value}` : "Die ready"}>
    {Array.from({ length: 9 }, (_, index) => <i key={index} className={pips.includes(index + 1) ? "on" : ""} />)}
  </div>;
}

function Pawn({ member, you, active }) {
  const hue = (Number(member.seat || 0) * 61 + 18) % 360;
  return <span className={`bn-pawn ${you ? "you" : ""} ${active ? "active" : ""}`} style={{ "--pawn-hue": hue }} title={member.nickname}>
    <i /><b>{member.avatar || "●"}</b>
  </span>;
}

function Select({ label, value, onChange, options, disabled }) {
  return <label className="bn-select"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

function Notebook({ known, notebook, setNotebook }) {
  function stateFor(cardId) {
    if (known.includes(cardId)) return "cleared";
    return notebook[cardId] || "unknown";
  }
  function cycle(cardId) {
    if (known.includes(cardId)) return;
    const current = notebook[cardId] || "unknown";
    const next = current === "unknown" ? "watch" : current === "watch" ? "cleared" : "unknown";
    setNotebook((value) => ({ ...value, [cardId]: next }));
  }
  return <aside className="bn-notebook">
    <div className="bn-brand"><strong>BLACKGLASS</strong><span>HOTEL</span><small>BLOOD &amp; ALIBI</small></div>
    <div className="bn-notebook-body">
      <header><strong>DETECTIVE NOTEBOOK</strong><span>? unknown · ! watch · × cleared</span></header>
      {NOTEBOOK_GROUPS.map(([kind, label, items]) => <section key={kind}>
        <h3>{label}</h3>
        {items.map((item) => {
          const cardId = `${kind}:${item.id}`;
          const mark = stateFor(cardId);
          const image = kind === "suspect" ? itemAssetUrl("suspect", item.id) : kind === "method" ? itemAssetUrl("weapon", item.id) : itemAssetUrl("room", item.id);
          return <button key={cardId} type="button" className={mark} disabled={known.includes(cardId)} onClick={() => cycle(cardId)}>
            <img src={image} alt="" /><span>{item.name}</span><b>{mark === "watch" ? "!" : mark === "cleared" ? "×" : "?"}</b>
          </button>;
        })}
      </section>)}
    </div>
  </aside>;
}

function HotelBoard({ state, members, user, myTurn, busy, act }) {
  const me = members.find((member) => member.uid === user?.uid);
  const myNode = normalizeBoardPosition(state.positions?.[user?.uid], me?.seat);
  const myRoom = boardRoomId(myNode);
  const reachable = useMemo(() => {
    if (!myTurn || state.turnPhase !== "move" || !user?.uid) return new Map();
    return new Map(getReachableBoardNodes(state, user.uid, members).map((item) => [item.id, item]));
  }, [state, members, myTurn, user?.uid]);
  const doors = useMemo(() => new Set(LOCATIONS.flatMap((room) => room.doors.map(({ x, y }) => `hall:${x},${y}`))), []);
  const occupants = (nodeId) => members.filter((member) => normalizeBoardPosition(state.positions?.[member.uid], member.seat) === nodeId);
  const currentUid = members[Number(state.currentPlayerIndex || 0)]?.uid;
  const move = (nodeId) => reachable.has(nodeId) && !busy && act({ type: "move", nodeId });

  return <section className="bn-board-shell">
    <header><div><small>BLACKGLASS HOTEL · 3:17 AM</small><strong>{myRoom ? LOCATION_MAP[myRoom]?.name : "Hotel corridor"}</strong></div><span>{state.turnPhase === "move" ? `${state.moveRemaining || 0} moves remaining` : "Noir investigation floor"}</span></header>
    <div className="bn-board" aria-label="Blackglass Hotel investigation board">
      <svg className="bn-passages" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M13 11 C 1 44, 22 91, 89 89" />
        <path d="M89 11 C 100 40, 81 92, 12 88" />
      </svg>
      {LOCATIONS.map((room) => {
        const id = roomNodeId(room.id);
        const reach = reachable.get(id);
        const here = myNode === id;
        const people = occupants(id);
        const b = room.bounds;
        return <button key={room.id} type="button" className={`bn-room theme-${room.theme} ${reach ? "reachable" : ""} ${here ? "here" : ""}`}
          style={{ left: `${b.x / BOARD_SIZE * 100}%`, top: `${b.y / BOARD_SIZE * 100}%`, width: `${b.w / BOARD_SIZE * 100}%`, height: `${b.h / BOARD_SIZE * 100}%`, backgroundImage: `url(${itemAssetUrl("room", room.id)})` }}
          disabled={!reach || busy} onClick={() => move(id)} aria-label={reach ? `Enter ${room.name}, costs ${reach.distance} movement` : room.name}>
          <span className="bn-room-vignette" /><span className="bn-room-label"><small>{here ? "YOU ARE HERE" : reach ? `${reach.distance} MOVE${reach.distance === 1 ? "" : "S"}` : "CRIME SCENE"}</small><strong>{room.name}</strong></span>
          {room.passageTo ? <span className="bn-secret">SECRET ↝ {LOCATION_MAP[room.passageTo]?.name}</span> : null}
          {people.length ? <span className="bn-room-pawns">{people.map((member) => <Pawn key={member.uid} member={member} you={member.uid === user?.uid} active={member.uid === currentUid} />)}</span> : null}
        </button>;
      })}
      {CORRIDOR_SPACES.map((space) => {
        const reach = reachable.get(space.id);
        const here = myNode === space.id;
        const people = occupants(space.id);
        const left = (space.x + 0.5) / BOARD_SIZE * 100;
        const top = (space.y + 0.5) / BOARD_SIZE * 100;
        return <button key={space.id} type="button" className={`bn-hall ${doors.has(space.id) ? "door" : ""} ${reach ? "reachable" : ""} ${here ? "here" : ""}`}
          style={{ left: `${left}%`, top: `${top}%` }} disabled={!reach || busy} onClick={() => move(space.id)} aria-label={reach ? `Move ${reach.distance} spaces here` : "Hotel corridor"}>
          {reach ? <span>{reach.distance}</span> : doors.has(space.id) ? <span>▣</span> : null}
          {people.length ? <em>{people.map((member) => <Pawn key={member.uid} member={member} you={member.uid === user?.uid} active={member.uid === currentUid} />)}</em> : null}
        </button>;
      })}
    </div>
    <footer><span>▣ Door</span><span>◆ Player</span><span>— — Secret passage</span><span>Highlighted spaces are reachable</span></footer>
  </section>;
}

function TheoryStrip({ scenario, title = "Current theory" }) {
  if (!scenario) return null;
  const assets = theoryAssetUrls(scenario);
  const suspect = SUSPECTS.find((item) => item.id === scenario.suspectId);
  const method = METHODS.find((item) => item.id === scenario.methodId);
  const room = LOCATIONS.find((item) => item.id === scenario.locationId);
  return <section className="bn-theory-strip">
    <header><small>{title}</small><strong>{suspect?.name} · {method?.name} · {room?.name}</strong></header>
    <div>
      <figure><img src={assets.suspect} alt={suspect?.name || "Suspect"} /><figcaption><small>SUSPECT</small><strong>{suspect?.name}</strong></figcaption></figure>
      <figure><img src={assets.weapon} alt={method?.name || "Weapon"} /><figcaption><small>WEAPON</small><strong>{method?.name}</strong></figcaption></figure>
      <figure><img src={assets.room} alt={room?.name || "Room"} /><figcaption><small>ROOM</small><strong>{room?.name}</strong></figcaption></figure>
    </div>
  </section>;
}

function CaseRail({ tab, setTab, known, reveal, members, state, theory, scenario }) {
  return <aside className="bn-case">
    <nav><button className={tab === "case" ? "active" : ""} onClick={() => setTab("case")}>CASE FILE</button><button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>LOG</button><button className={tab === "intel" ? "active" : ""} onClick={() => setTab("intel")}>INTEL</button></nav>
    <div className="bn-case-body">
      {tab === "case" ? <div className="bn-case-file">
        <TheoryStrip scenario={scenario} title="RECONSTRUCTING THE SCENE" />
        {reveal ? <article className="bn-refuted"><small>REFUTED ×</small><strong>{evidenceLabel(reveal.cardId)}</strong><span>{members.find((member) => member.uid === reveal.fromUid)?.nickname || "Another investigator"} produced the evidence.</span></article> : null}
        <div className="bn-theory-form"><small>NEW THEORY</small><Select label="Suspect" value={theory.suspectId} onChange={theory.setSuspectId} options={SUSPECTS} disabled={!theory.can} /><Select label="Weapon" value={theory.methodId} onChange={theory.setMethodId} options={METHODS} disabled={!theory.can} /><label><span>Room</span><strong>{theory.location?.name || "Enter a room"}</strong></label><button className="bn-primary" disabled={!theory.can} onClick={theory.submit}>PROPOSE THEORY</button><details><summary>MAKE ACCUSATION</summary><Select label="Final room" value={theory.accuseLocationId} onChange={theory.setAccuseLocationId} options={LOCATIONS} disabled={!theory.can} /><button className="bn-danger" disabled={!theory.can} onClick={() => theory.act({ type: "accuse", suspectId: theory.suspectId, methodId: theory.methodId, locationId: theory.accuseLocationId })}>LOCK ACCUSATION</button></details></div>
      </div> : tab === "log" ? <div className="bn-log">{[...(state.caseLog || [])].reverse().map((entry, index) => <p key={`${entry.type}-${index}`}>{entry.text}</p>)}</div> : <div className="bn-intel"><small>KNOWN EVIDENCE</small><strong>{known.length} cards ruled out</strong>{known.map((cardId) => <article key={cardId}><span>{cardId.split(":")[0].toUpperCase()}</span><strong>{evidenceLabel(cardId)}</strong></article>)}</div>}
    </div>
  </aside>;
}

function PlayerDock({ members, state, user }) {
  const currentUid = members[Number(state.currentPlayerIndex || 0)]?.uid;
  return <div className="bn-players">{members.map((member) => {
    const node = normalizeBoardPosition(state.positions?.[member.uid], member.seat);
    const roomId = boardRoomId(node);
    return <article key={member.uid} className={`${member.uid === currentUid ? "active" : ""} ${member.uid === user?.uid ? "you" : ""}`}>
      <img src={itemAssetUrl("suspect", SUSPECTS[Number(member.seat || 0) % SUSPECTS.length]?.id)} alt="" />
      <div><small>{member.uid === user?.uid ? "YOU" : member.isRobot ? "AI" : "PLAYER"}</small><strong>{member.nickname}</strong><span>{roomId ? LOCATION_MAP[roomId]?.name : "Corridor"}</span></div>
      {member.uid === currentUid ? <b>TURN</b> : null}
    </article>;
  })}</div>;
}

function Table({ controller }) {
  const { room, roomCode, user, members, busy, error, act } = controller;
  const state = room.gameState;
  const current = members[Number(state.currentPlayerIndex || 0)];
  const me = members.find((member) => member.uid === user?.uid);
  const myTurn = state.phase === "playing" && current?.uid === user?.uid;
  const myRoomId = boardRoomId(normalizeBoardPosition(state.positions?.[user?.uid], me?.seat));
  const myLocation = LOCATION_MAP[myRoomId];
  const [suspectId, setSuspectId] = useState(SUSPECTS[0].id);
  const [methodId, setMethodId] = useState(METHODS[0].id);
  const [accuseLocationId, setAccuseLocationId] = useState(LOCATIONS[0].id);
  const [rolling, setRolling] = useState(false);
  const [tab, setTab] = useState("case");
  const [scenario, setScenario] = useState(null);
  const hand = Array.isArray(state.hands?.[user?.uid]) ? state.hands[user.uid] : [];
  const reveals = Array.isArray(state.reveals) ? state.reveals.filter((item) => item.toUid === user?.uid) : [];
  const known = useMemo(() => [...new Set([...hand, ...reveals.map((item) => item.cardId)])].sort(), [hand, reveals]);
  const latestReveal = reveals[reveals.length - 1];
  const eliminated = Boolean(state.eliminated?.[user?.uid]);
  const canRoll = myTurn && state.turnPhase === "roll" && !eliminated;
  const canInvestigate = myTurn && state.turnPhase === "investigate" && !eliminated && Boolean(myRoomId) && !busy;
  const notebookKey = `blackglassNotebook:${roomCode || "local"}`;
  const [notebook, setNotebook] = useState(() => { try { return JSON.parse(window.localStorage.getItem(notebookKey) || "{}"); } catch { return {}; } });
  useEffect(() => { try { window.localStorage.setItem(notebookKey, JSON.stringify(notebook)); } catch { /* local-only notebook */ } }, [notebook, notebookKey]);

  async function roll() {
    if (!canRoll || busy) return;
    setRolling(true);
    try { await act({ type: "roll" }); } finally { window.setTimeout(() => setRolling(false), 420); }
  }
  async function submit() {
    if (!canInvestigate) return;
    const next = { suspectId, methodId, locationId: myRoomId, turn: state.turnNumber };
    setScenario(next);
    setTab("case");
    await act({ type: "suggest", suspectId, methodId });
  }
  const theory = { can: canInvestigate, location: myLocation, suspectId, setSuspectId, methodId, setMethodId, accuseLocationId, setAccuseLocationId, submit, act };
  const solution = state.solution || {};

  return <main className="bn-shell"><section className="bn-table">
    <header className="bn-topbar"><div className="bn-title"><strong>BLACKGLASS HOTEL</strong><small>BLOOD &amp; ALIBI</small></div><div className="bn-turn"><span>TURN {state.turnNumber || 1}</span><strong>{myTurn ? "YOUR TURN" : current?.nickname || "INVESTIGATING"}</strong><em>{state.message}</em></div><nav><button onClick={() => setTab("case")}>CASE FILE</button><button onClick={navigateToHub}>ALL GAMES</button></nav></header>
    {error ? <p className="bn-error">{error}</p> : null}
    <div className="bn-main"><Notebook known={known} notebook={notebook} setNotebook={setNotebook} /><HotelBoard state={state} members={members} user={user} myTurn={myTurn} busy={busy} act={act} /><CaseRail tab={tab} setTab={setTab} known={known} reveal={latestReveal} members={members} state={state} theory={theory} scenario={scenario} /></div>
    <footer className="bn-bottom"><section className="bn-turn-controls"><Die value={state.lastRoll} rolling={rolling} /><div><button className="bn-primary" disabled={!canRoll || busy} onClick={roll}>ROLL DICE</button><span>{state.turnPhase === "move" ? `${state.moveRemaining || 0} moves` : state.turnPhase === "investigate" ? "Investigate" : "Ready"}</span></div>{canRoll && myLocation?.passageTo ? <button onClick={() => act({ type: "passage" })}>SECRET PASSAGE</button> : null}{canRoll && myRoomId ? <button onClick={() => act({ type: "investigateHere" })}>STAY &amp; INVESTIGATE</button> : null}{myTurn && state.turnPhase === "move" ? <button onClick={() => act({ type: "endMove" })}>END MOVEMENT</button> : null}</section><PlayerDock members={members} state={state} user={user} /><section className="bn-end"><small>CASE STATUS</small><strong>{state.message}</strong><button disabled={!canInvestigate} onClick={() => act({ type: "end" })}>END TURN</button></section></footer>
    {state.phase === "game-over" ? <div className="bn-game-over"><div><small>CASE CLOSED</small><h2>{members.find((member) => member.uid === state.winnerUid)?.nickname || "The case"} solved Blackglass</h2><TheoryStrip scenario={solution} title="FINAL SOLUTION" /><button onClick={navigateToHub}>RETURN TO ALL GAMES</button></div></div> : null}
  </section></main>;
}

export default function NoirGame() {
  const controller = useModularTable({ gameId: "bloodalibi", maxPlayers: BLOOD_ALIBI_RULES.playersMax, minimumPlayers: BLOOD_ALIBI_RULES.playersMin, createGameState: createBloodAlibiGame, reduceGameState: reduceBloodAlibi, chooseRobotMove: chooseBloodAlibiRobotMove, robotDelay: 650 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Blackglass: Blood & Alibi" kicker="Roll · move · reconstruct · refute · accuse" summary="A full-screen modern-noir deduction game set inside Blackglass Hotel. Move across the hotel, build a suspect/weapon/room theory, and use visual evidence to solve the case." maxPlayers={6} quickPlayChoices={[{ icon: "🕵️", label: "Open a case vs robot", description: "Start immediately on the full noir hotel board.", rules: {} }]} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening the Blackglass case file…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Blackglass: Blood & Alibi" minimumPlayers={2} maxPlayers={6} startLabel="Seal the hotel" lobbyHint="Two to six investigators. Roll, move, test suspect/weapon/room theories, refute with evidence, and make a final accusation." />;
  return <Table controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "bloodalibi", name: "Blackglass: Blood & Alibi", players: "2–6" });
