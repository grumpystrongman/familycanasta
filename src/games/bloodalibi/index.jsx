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
import "./styles.css";

const LOCATION_MAP = Object.freeze(Object.fromEntries(LOCATIONS.map((location) => [location.id, location])));
const SUSPECT_MAP = Object.freeze(Object.fromEntries(SUSPECTS.map((suspect) => [suspect.id, suspect])));
const METHOD_MAP = Object.freeze(Object.fromEntries(METHODS.map((method) => [method.id, method])));
const VICTIM = Object.freeze({ name: "Ruby Ash", role: "investigative journalist", detail: "She came to Blackglass chasing a story somebody was desperate to bury." });

const ROOM_LAYOUT = Object.freeze({
  greenhouse: { left: 2, top: 2, width: 29, height: 23, tech: "Climate sensors · smart glass", icon: "🌿" },
  penthouse: { left: 35, top: 2, width: 30, height: 27, tech: "Biometric safe · smart glass", icon: "🏙" },
  security: { left: 69, top: 2, width: 29, height: 22, tech: "CCTV wall · badge logs", icon: "📹" },
  laundry: { left: 2, top: 32, width: 25, height: 27, tech: "RFID linen tracking", icon: "🫧" },
  atrium: { left: 31, top: 31, width: 36, height: 30, tech: "Building controls · elevators", icon: "◉" },
  kitchen: { left: 72, top: 31, width: 26, height: 28, tech: "Cold-chain sensors · service cams", icon: "🍽" },
  garage: { left: 2, top: 66, width: 28, height: 31, tech: "ANPR cameras · EV chargers", icon: "🚘" },
  nightclub: { left: 34, top: 66, width: 31, height: 30, tech: "DMX lighting · audio console", icon: "♬" },
  boiler: { left: 70, top: 65, width: 28, height: 32, tech: "BMS telemetry · pressure sensors", icon: "♨" },
});

const SUSPECT_TONES = Object.freeze({
  "mara-voss": "#a14f68",
  "dex-vale": "#3e86a7",
  "imani-cross": "#7760b2",
  "theo-rook": "#b87333",
  "june-mercer": "#7d9f62",
  "elias-flint": "#d0b358",
});

const METHOD_ICONS = Object.freeze({
  "nail-gun": "▰",
  cleaver: "◢",
  garrote: "∞",
  revolver: "⌁",
  poison: "⚗",
  "fire-axe": "⚒",
});

const DIE_PIPS = Object.freeze({
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
});

function SelectField({ label, value, onChange, options, disabled, testId }) {
  return <label className="bg-select"><span>{label}</span><select data-testid={testId} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

function DieFace({ value, rolling }) {
  const pips = DIE_PIPS[value] || [];
  return <div className={`bg-die ${rolling ? "rolling" : ""} ${value ? "rolled" : "idle"}`} aria-label={value ? `Die shows ${value}` : "Die not rolled yet"}>{Array.from({ length: 9 }, (_, index) => <span key={index} className={pips.includes(index + 1) ? "on" : ""} />)}</div>;
}

function RoomSceneGraphic({ roomId, className = "" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" };
  const art = {
    greenhouse: <><path {...common} d="M8 78 Q30 30 50 22 Q72 30 92 78"/><path {...common} d="M18 78V44M34 78V34M50 78V26M66 78V34M82 78V44"/><path {...common} d="M16 80c9-19 16-21 25-2M42 80c10-25 22-28 35-4M66 80c9-17 16-18 22-3"/></>,
    penthouse: <><rect {...common} x="12" y="16" width="76" height="34" rx="3"/><path {...common} d="M18 44 32 26 43 40 56 22 73 39 82 30"/><rect {...common} x="25" y="58" width="50" height="20" rx="4"/><path {...common} d="M25 67h50M32 58v-8M68 58v-8"/></>,
    security: <><rect {...common} x="10" y="12" width="80" height="52" rx="3"/><path {...common} d="M36 12v52M63 12v52M10 38h80"/><path {...common} d="M18 78h64M28 64l-4 14M72 64l4 14"/><circle {...common} cx="50" cy="76" r="5"/></>,
    laundry: <><rect {...common} x="11" y="17" width="24" height="60" rx="3"/><rect {...common} x="39" y="17" width="24" height="60" rx="3"/><rect {...common} x="67" y="17" width="22" height="60" rx="3"/><circle {...common} cx="23" cy="39" r="8"/><circle {...common} cx="51" cy="39" r="8"/><circle {...common} cx="78" cy="39" r="8"/><path {...common} d="M16 63h14M44 63h14M72 63h12"/></>,
    atrium: <><circle {...common} cx="50" cy="48" r="31"/><circle {...common} cx="50" cy="48" r="18"/><path {...common} d="M50 17v62M19 48h62M28 26l44 44M72 26 28 70"/><path {...common} d="M13 82h74M20 82l8-10M80 82l-8-10"/></>,
    kitchen: <><path {...common} d="M10 23h80v20H10zM18 43v34M82 43v34M10 77h80"/><circle {...common} cx="27" cy="33" r="6"/><circle {...common} cx="47" cy="33" r="6"/><circle {...common} cx="67" cy="33" r="6"/><path {...common} d="M34 58h32v19H34zM50 58V47"/></>,
    garage: <><path {...common} d="M10 75h80M16 75V25h68v50"/><path {...common} d="M24 63 32 44h36l10 19z"/><circle {...common} cx="34" cy="65" r="7"/><circle {...common} cx="68" cy="65" r="7"/><path {...common} d="M22 30h16M62 30h16"/></>,
    nightclub: <><path {...common} d="M12 70h76M20 70V34h60v36M30 34l8-13M70 34l-8-13"/><path {...common} d="M30 50h40M26 61h48"/><circle {...common} cx="31" cy="27" r="5"/><circle {...common} cx="69" cy="27" r="5"/><path {...common} d="M18 18 35 44M82 18 65 44"/></>,
    boiler: <><rect {...common} x="18" y="25" width="24" height="50" rx="10"/><rect {...common} x="58" y="18" width="24" height="57" rx="10"/><path {...common} d="M30 25V12h40v6M42 47h16M10 59h8M82 51h8M28 75v10M70 75v10"/><circle {...common} cx="50" cy="47" r="7"/></>,
  }[roomId];
  return <svg className={`bg-room-art ${className}`} viewBox="0 0 100 100" aria-hidden="true">{art}</svg>;
}

function InvestigatorToken({ member, eliminated, isYou }) {
  const hue = (Number(member.seat || 0) * 61 + 8) % 360;
  return <span className={`bg-pawn ${eliminated ? "eliminated" : ""} ${isYou ? "you" : ""}`} style={{ "--pawn-hue": hue }} title={`${member.nickname}${isYou ? " (you)" : ""}`}><i /><b>{member.avatar || "●"}</b></span>;
}
function SuspectMarker({ suspect }) { return <span className="bg-suspect-marker" style={{ "--suspect-tone": SUSPECT_TONES[suspect.id] || "#9f5965" }} title={suspect.name}>{suspect.name.split(" ").map((part) => part[0]).join("")}</span>; }
function MethodMarker({ method }) { return <span className="bg-method-marker" title={method.name}>{METHOD_ICONS[method.id] || "◆"}</span>; }

function SecretPassages({ activeRoomId }) {
  return <svg className="bg-passage-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className={activeRoomId === "greenhouse" || activeRoomId === "boiler" ? "active" : ""} d="M16 13 C 2 32, 4 80, 84 82" /><path className={activeRoomId === "security" || activeRoomId === "garage" ? "active" : ""} d="M84 12 C 99 31, 96 78, 16 82" /></svg>;
}

function HotelBoard({ state, members, user, myTurn, busy, act }) {
  const me = members.find((member) => member.uid === user?.uid);
  const myNodeId = normalizeBoardPosition(state.positions?.[user?.uid], me?.seat);
  const myRoomId = boardRoomId(myNodeId);
  const [zoom, setZoom] = useState(1);
  const [intelMode, setIntelMode] = useState(false);
  const reachable = useMemo(() => {
    if (!myTurn || state.turnPhase !== "move" || !user?.uid) return new Map();
    return new Map(getReachableBoardNodes(state, user.uid, members).map((item) => [item.id, item]));
  }, [state, members, myTurn, user?.uid]);
  const doorNodes = useMemo(() => new Set(LOCATIONS.flatMap((location) => location.doors.map(({ x, y }) => `hall:${x},${y}`))), []);
  function occupants(nodeId) { return members.filter((member) => normalizeBoardPosition(state.positions?.[member.uid], member.seat) === nodeId); }
  function suspectsInRoom(locationId) { return SUSPECTS.filter((suspect) => state.suspectPositions?.[suspect.id] === locationId); }
  function methodsInRoom(locationId) { return METHODS.filter((method) => state.methodPositions?.[method.id] === locationId); }
  function moveTo(nodeId) { if (reachable.has(nodeId) && !busy) act({ type: "move", nodeId }); }
  return <section className={`bg-board-shell ${intelMode ? "intel" : ""}`} data-testid="blackglass-board"><header className="bg-board-hud"><div><small>INVESTIGATION FLOOR</small><strong>{myRoomId ? LOCATION_MAP[myRoomId]?.name : "Hotel corridor"}</strong></div><div className="bg-board-tools"><button type="button" onClick={() => setIntelMode((value) => !value)} className={intelMode ? "active" : ""}>⌁ Intel</button><button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(.84, value - .08))}>−</button><button type="button" onClick={() => setZoom(1)}>Fit</button><button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.24, value + .08))}>＋</button></div></header><div className="bg-board-viewport"><div className="bg-board-canvas" style={{ "--zoom": zoom }}><SecretPassages activeRoomId={myRoomId} />{LOCATIONS.map((location) => {
    const ui = ROOM_LAYOUT[location.id]; const nodeId = roomNodeId(location.id); const roomReach = reachable.get(nodeId); const here = myNodeId === nodeId; const roomOccupants = occupants(nodeId); const roomSuspects = suspectsInRoom(location.id); const roomMethods = methodsInRoom(location.id);
    return <button key={location.id} type="button" disabled={!roomReach || busy} onClick={() => moveTo(nodeId)} className={`bg-board-room theme-${location.theme} ${here ? "here" : ""} ${roomReach ? "reachable" : ""}`} style={{ left: `${ui.left}%`, top: `${ui.top}%`, width: `${ui.width}%`, height: `${ui.height}%` }} aria-label={roomReach ? `Enter ${location.name}, costs ${roomReach.distance} movement` : location.name}><RoomSceneGraphic roomId={location.id} /><span className="bg-room-vignette"/><span className="bg-room-copy"><small>{here ? "YOU ARE HERE" : roomReach ? `${roomReach.distance} MOVE${roomReach.distance === 1 ? "" : "S"}` : "CRIME SCENE"}</small><strong>{location.name}</strong><em>{location.detail}</em></span><span className="bg-room-tech">{ui.icon} {ui.tech}</span>{location.passageTo ? <span className="bg-passage-chip">↝ {LOCATION_MAP[location.passageTo]?.name}</span> : null}{roomSuspects.length || roomMethods.length ? <span className="bg-marker-stack">{roomSuspects.map((suspect) => <SuspectMarker key={suspect.id} suspect={suspect} />)}{roomMethods.map((method) => <MethodMarker key={method.id} method={method} />)}</span> : null}{roomOccupants.length ? <span className="bg-token-stack">{roomOccupants.map((member) => <InvestigatorToken key={member.uid} member={member} eliminated={state.eliminated?.[member.uid]} isYou={member.uid === user?.uid} />)}</span> : null}</button>;
  })}{CORRIDOR_SPACES.map((space) => { const reach = reachable.get(space.id); const here = myNodeId === space.id; const people = occupants(space.id); const left = (space.x / Math.max(1, BOARD_SIZE - 1)) * 100; const top = (space.y / Math.max(1, BOARD_SIZE - 1)) * 100; return <button key={space.id} type="button" className={`bg-hall-space ${here ? "here" : ""} ${reach ? "reachable" : ""} ${doorNodes.has(space.id) ? "door" : ""}`} style={{ left: `${left}%`, top: `${top}%` }} disabled={!reach || busy} onClick={() => moveTo(space.id)} aria-label={reach ? `Move ${reach.distance} spaces here` : doorNodes.has(space.id) ? "Hotel door" : "Hotel corridor"}>{doorNodes.has(space.id) ? <span className="bg-door-mark">▣</span> : null}{reach ? <span className="bg-move-cost">{reach.distance}</span> : null}{people.length ? <span className="bg-hall-tokens">{people.map((member) => <InvestigatorToken key={member.uid} member={member} eliminated={state.eliminated?.[member.uid]} isYou={member.uid === user?.uid} />)}</span> : null}</button>; })}</div></div><footer className="bg-board-legend"><span><i className="door"/> Door</span><span><i className="passage"/> Secret passage</span><span><i className="reachable"/> Reachable</span><span>⌁ Intel reveals room tech</span></footer></section>;
}

function NotebookRail({ notebookState, cycleNotebook }) {
  const groups = [["suspect", "Suspects", SUSPECTS], ["method", "Weapons", METHODS], ["location", "Rooms", LOCATIONS]];
  return <aside className="bg-left-rail" data-testid="blackglass-notebook"><div className="bg-notebook-scroll"><h2>Detective notebook</h2><p>Tap any line: <b>?</b> unknown → <b>!</b> watch → <b>×</b> cleared.</p>{groups.map(([kind, label, items]) => <section key={kind}><header><span>{label}</span><small>?</small><small>!</small><small>×</small></header><div>{items.map((item) => { const cardId = `${kind}:${item.id}`; const mark = notebookState(cardId); return <button key={cardId} type="button" className={`bg-note-row ${mark}`} onClick={() => cycleNotebook(cardId)}><span>{item.name}</span><b>{mark === "watch" ? "!" : mark === "cleared" ? "×" : "?"}</b></button>; })}</div></section>)}</div></aside>;
}
function EvidencePane({ knownEvidence, latestReveal, members }) { return <div className="bg-pane-scroll">{latestReveal ? <article className="bg-reveal-card"><small>LATEST REVELATION</small><strong>{evidenceLabel(latestReveal.cardId)}</strong><span>{members.find((member) => member.uid === latestReveal.fromUid)?.nickname || "Another investigator"} refuted your theory.</span></article> : <article className="bg-empty-card"><strong>No private reveal yet</strong><span>Ask the right question and somebody may have to show you evidence.</span></article>}<div className="bg-evidence-grid">{knownEvidence.map((cardId) => <article key={cardId}><small>{String(cardId).split(":")[0]}</small><strong>{evidenceLabel(cardId)}</strong><span>Cleared</span></article>)}</div></div>; }
function LogPane({ caseLog }) { return <div className="bg-log-scroll" data-testid="blackglass-action-log">{[...(caseLog || [])].reverse().map((entry, index) => <p key={`${entry.type}-${index}`}><span className={`log-dot ${entry.type}`}/>{entry.text}</p>)}</div>; }
function TheoryPane({ canInvestigate, busy, suspectId, setSuspectId, methodId, setMethodId, myLocation, accuseLocationId, setAccuseLocationId, onSuggest, act }) { return <div className="bg-theory-pane"><div className="bg-theory-copy"><small>SUGGEST A THEORY</small><strong>{canInvestigate ? `Reconstruct ${myLocation?.name}` : "Enter a room to question the scene"}</strong><span>The room is locked to your pawn's current location.</span></div><SelectField label="Suspect" value={suspectId} onChange={setSuspectId} options={SUSPECTS} disabled={!canInvestigate || busy} testId="theory-suspect"/><SelectField label="Weapon" value={methodId} onChange={setMethodId} options={METHODS} disabled={!canInvestigate || busy} testId="theory-method"/><label className="bg-locked-room"><span>Room</span><strong>{myLocation?.name || "No room"}</strong></label><button type="button" className="bg-primary blackglass-theory-submit" disabled={!canInvestigate || busy} onClick={onSuggest}>Reveal theory</button><details className="bg-accuse"><summary>Final accusation</summary><p>One wrong accusation eliminates you from the investigation.</p><SelectField label="Final room" value={accuseLocationId} onChange={setAccuseLocationId} options={LOCATIONS} disabled={!canInvestigate || busy}/><button type="button" className="bg-danger" disabled={!canInvestigate || busy} onClick={() => act({ type: "accuse", suspectId, methodId, locationId: accuseLocationId })}>Make accusation</button></details></div>; }
function CaseRail({ tab, setTab, knownEvidence, latestReveal, members, caseLog, theoryProps }) { return <aside className="bg-right-rail"><header><div><small>YOUR CASE FILE</small><strong>{knownEvidence.length} cards ruled out</strong></div><span className="bg-case-progress"><i style={{ width: `${Math.min(100, (knownEvidence.length / 18) * 100)}%` }}/></span></header><nav><button type="button" className={tab === "theory" ? "active" : ""} onClick={() => setTab("theory")}>Theory</button><button type="button" className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>Action log</button><button type="button" className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}>Evidence</button></nav><section className="bg-right-pane">{tab === "theory" ? <TheoryPane {...theoryProps}/> : tab === "log" ? <LogPane caseLog={caseLog}/> : <EvidencePane knownEvidence={knownEvidence} latestReveal={latestReveal} members={members}/>}</section></aside>; }

function ScenePerson({ suspect }) { const tone = SUSPECT_TONES[suspect.id] || "#a05a68"; return <div className="bg-scene-person" style={{ "--person-tone": tone }}><span className="head"/><span className="body"/><b>{suspect.name}</b><small>{suspect.role}</small></div>; }
function SceneWeapon({ method }) { return <div className="bg-scene-weapon"><span>{METHOD_ICONS[method.id] || "◆"}</span><strong>{method.name}</strong><small>{method.detail}</small></div>; }
function ScenarioReconstruction({ scenario, refutedBy, shownCard, onClose }) {
  if (!scenario) return null; const room = LOCATION_MAP[scenario.locationId]; const suspect = SUSPECT_MAP[scenario.suspectId]; const method = METHOD_MAP[scenario.methodId];
  return <div className="bg-scenario-backdrop" role="dialog" aria-modal="true" aria-label="Theory reconstruction"><article className={`bg-scenario-modal theme-${room?.theme || "atrium"}`} data-testid="blackglass-scenario-modal"><button type="button" className="bg-scenario-close" onClick={onClose} aria-label="Close reconstruction">×</button><header><small>AI RECONSTRUCTION · THEORY {scenario.turn}</small><h2>{suspect?.name} with {method?.name}</h2><p>{room?.name} · victim: {VICTIM.name}</p></header><div className="bg-scenario-stage"><RoomSceneGraphic roomId={scenario.locationId} className="hero"/><span className="bg-scene-grain"/><ScenePerson suspect={suspect}/><SceneWeapon method={method}/><div className="bg-victim-silhouette"><i/><b>{VICTIM.name}</b><small>{VICTIM.role}</small></div></div><footer className={refutedBy ? "refuted" : "unresolved"}><div><small>{refutedBy ? "THE THEORY WAS REFUTED" : "THEORY SUBMITTED"}</small><strong>{refutedBy ? `${refutedBy.nickname} produced evidence.` : "Waiting for the table to answer."}</strong>{shownCard ? <span>Privately shown: {evidenceLabel(shownCard)}</span> : null}</div><button type="button" className="bg-primary" onClick={onClose}>Continue investigation</button></footer></article></div>;
}
function PlayerDock({ members, state, user }) { return <div className="bg-player-dock">{members.map((member) => { const node = normalizeBoardPosition(state.positions?.[member.uid], member.seat); const roomId = boardRoomId(node); const active = members[Number(state.currentPlayerIndex || 0)]?.uid === member.uid; return <article key={member.uid} className={`${active ? "active" : ""} ${member.uid === user?.uid ? "you" : ""} ${state.eliminated?.[member.uid] ? "out" : ""}`}><span className="bg-player-avatar">{member.avatar}</span><div><strong>{member.nickname}</strong><small>{member.isRobot ? "AI · " : ""}{roomId ? LOCATION_MAP[roomId]?.name : "Corridor"}</small></div>{active ? <b>TURN</b> : null}</article>; })}</div>; }

function BloodAlibiTable({ controller }) {
  const { room, roomCode, user, members, busy, error, act } = controller; const state = room.gameState; const currentIndex = Number(state.currentPlayerIndex || 0); const current = members[currentIndex]; const myTurn = state.phase === "playing" && current?.uid === user?.uid; const me = members.find((member) => member.uid === user?.uid); const myNodeId = normalizeBoardPosition(state.positions?.[user?.uid], me?.seat); const myRoomId = boardRoomId(myNodeId); const myLocation = LOCATION_MAP[myRoomId];
  const [suspectId, setSuspectId] = useState(SUSPECTS[0].id); const [methodId, setMethodId] = useState(METHODS[0].id); const [accuseLocationId, setAccuseLocationId] = useState(LOCATIONS[0].id); const [rolling, setRolling] = useState(false); const [rightTab, setRightTab] = useState("theory"); const [scenario, setScenario] = useState(null); const winner = members.find((member) => member.uid === state.winnerUid); const myHand = Array.isArray(state.hands?.[user?.uid]) ? state.hands[user.uid] : []; const myReveals = Array.isArray(state.reveals) ? state.reveals.filter((reveal) => reveal.toUid === user?.uid) : []; const knownEvidence = useMemo(() => [...new Set([...myHand, ...myReveals.map((reveal) => reveal.cardId)])].sort(), [myHand, myReveals]); const latestReveal = myReveals[myReveals.length - 1]; const eliminated = Boolean(state.eliminated?.[user?.uid]); const canRoll = myTurn && state.turnPhase === "roll" && !eliminated; const canInvestigate = myTurn && state.turnPhase === "investigate" && !eliminated && Boolean(myRoomId); const solution = state.solution || {}; const scenarioReveal = scenario ? myReveals.find((reveal) => Number(reveal.turn) === Number(scenario.turn)) : null; const scenarioRefuter = scenarioReveal ? members.find((member) => member.uid === scenarioReveal.fromUid) : null;
  const notebookKey = `blackglassNotebook:${roomCode || "local"}`; const [notebook, setNotebook] = useState(() => { try { return JSON.parse(window.localStorage.getItem(notebookKey) || "{}"); } catch { return {}; } }); useEffect(() => { try { window.localStorage.setItem(notebookKey, JSON.stringify(notebook)); } catch { /* keep notebook in memory */ } }, [notebook, notebookKey]);
  function notebookState(cardId) { if (knownEvidence.includes(cardId)) return "cleared"; return notebook[cardId] || "unknown"; }
  function cycleNotebook(cardId) { if (knownEvidence.includes(cardId)) return; const mark = notebook[cardId] || "unknown"; const next = mark === "unknown" ? "watch" : mark === "watch" ? "cleared" : "unknown"; setNotebook((value) => ({ ...value, [cardId]: next })); }
  async function rollDie() { if (!canRoll || busy) return; setRolling(true); try { await act({ type: "roll" }); } finally { window.setTimeout(() => setRolling(false), 420); } }
  async function submitTheory() { if (!canInvestigate || busy) return; const nextScenario = { suspectId, methodId, locationId: myRoomId, turn: state.turnNumber }; setScenario(nextScenario); await act({ type: "suggest", suspectId, methodId }); }
  const instruction = !myTurn ? `Waiting for ${current?.nickname || "the next investigator"}.` : state.turnPhase === "roll" ? (myRoomId ? "Roll, take a passage, or stay and investigate." : "Roll the die to move through Blackglass.") : state.turnPhase === "move" ? `${state.moveRemaining || 0} moves remain. Entering a room ends movement.` : `Question the scene in ${myLocation?.name || "this room"}.`; const theoryProps = { canInvestigate, busy, suspectId, setSuspectId, methodId, setMethodId, myLocation, accuseLocationId, setAccuseLocationId, onSuggest: submitTheory, act };
  return <main className="blackglass-shell"><section className="blackglass-table" data-testid="blackglass-game-layout"><header className="bg-topbar"><div className="bg-title"><small>BLACKGLASS HOTEL</small><strong>Blood &amp; Alibi</strong></div><div className="bg-turn-state"><span>TURN {state.turnNumber || 1}</span><strong>{myTurn ? "Your turn" : `${current?.nickname}'s turn`}</strong><em>{instruction}</em></div><div className="bg-top-actions"><button type="button" onClick={() => setRightTab("evidence")}>Case file</button><button type="button" onClick={navigateToHub}>All games</button></div></header>{error ? <p className="bg-error">{error}</p> : null}<div className="bg-main-layout"><NotebookRail notebookState={notebookState} cycleNotebook={cycleNotebook}/><HotelBoard state={state} members={members} user={user} myTurn={myTurn} busy={busy} act={act}/><CaseRail tab={rightTab} setTab={setRightTab} knownEvidence={knownEvidence} latestReveal={latestReveal} members={members} caseLog={state.caseLog} theoryProps={theoryProps}/></div><footer className="bg-bottom-deck"><section className="bg-turn-controls"><DieFace value={state.lastRoll} rolling={rolling}/><div><button type="button" className="bg-primary blackglass-roll-button" disabled={!canRoll || busy} onClick={rollDie}>🎲 Roll die</button><span>{state.turnPhase === "move" ? `${state.moveRemaining || 0} moves left` : state.turnPhase === "investigate" ? "Investigate" : "Ready"}</span></div>{canRoll && myLocation?.passageTo ? <button type="button" className="bg-secondary" disabled={busy} onClick={() => act({ type: "passage" })}>Secret passage → {LOCATION_MAP[myLocation.passageTo]?.name}</button> : null}{canRoll && myRoomId ? <button type="button" className="bg-secondary" disabled={busy} onClick={() => act({ type: "investigateHere" })}>Stay &amp; investigate</button> : null}{myTurn && state.turnPhase === "move" ? <button type="button" className="bg-secondary" disabled={busy} onClick={() => act({ type: "endMove" })}>End movement</button> : null}</section><PlayerDock members={members} state={state} user={user}/><section className="bg-end-turn-card"><small>CASE STATUS</small><strong>{state.message}</strong><button type="button" className="bg-secondary" disabled={!canInvestigate || busy} onClick={() => act({ type: "end" })}>End turn</button></section></footer>{scenario ? <ScenarioReconstruction scenario={scenario} refutedBy={scenarioRefuter} shownCard={scenarioReveal?.cardId} onClose={() => setScenario(null)} /> : null}{state.phase === "game-over" ? <div className="bg-game-over"><article><small>CASE CLOSED</small><h2>{winner ? `${winner.nickname} solved Blackglass` : "The case went cold"}</h2><p><b>{SUSPECT_MAP[solution.suspectId]?.name}</b> · <b>{METHOD_MAP[solution.methodId]?.name}</b> · <b>{LOCATION_MAP[solution.locationId]?.name}</b></p><button type="button" className="bg-primary" onClick={navigateToHub}>Return to game room</button></article></div> : null}</section></main>;
}

export default function BloodAlibiGame() {
  const controller = useModularTable({ gameId: "bloodalibi", maxPlayers: BLOOD_ALIBI_RULES.playersMax, minimumPlayers: BLOOD_ALIBI_RULES.playersMin, createGameState: createBloodAlibiGame, reduceGameState: reduceBloodAlibi, chooseRobotMove: chooseBloodAlibiRobotMove, robotDelay: 700 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Blackglass: Blood & Alibi" kicker="Roll · move · reconstruct · refute · accuse" summary="A modern-noir murder mystery inside the Blackglass Hotel. Roll through a physical floor plan, use secret passages and hotel technology, reconstruct theories visually, collect private evidence, and risk a final accusation." maxPlayers={6} quickPlayChoices={[{ icon: "🩸", label: "Open a case vs robot", description: "Start immediately with the full board, dice, evidence, and reconstruction loop.", rules: {} }]} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening the Blackglass case file…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Blackglass: Blood & Alibi" minimumPlayers={2} maxPlayers={6} startLabel="Seal the hotel" lobbyHint="Two to six investigators. Roll, move, enter rooms, use passages, reconstruct theories, refute with private evidence, and accuse when you're ready." />;
  return <BloodAlibiTable controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "bloodalibi", name: "Blackglass: Blood & Alibi", players: "2–6" });
