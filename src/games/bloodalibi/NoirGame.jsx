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
} from "./engineThreePart";
import { buildDeductionGroups, matchingAlibiCards } from "./deduction";
import { itemAssetUrl, theoryAssetUrls } from "./itemAssets";
import "./noir.css";
import "./deduction.css";

const LOCATION_MAP = Object.freeze(Object.fromEntries(LOCATIONS.map((item) => [item.id, item])));
const DIE_PIPS = Object.freeze({ 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] });
const NOTEBOOK_GROUPS = Object.freeze([
  ["suspect", "Suspects", SUSPECTS],
  ["method", "Weapons", METHODS],
  ["location", "Rooms", LOCATIONS],
]);

function cardMeta(cardId) {
  const [kind, id] = String(cardId || "").split(":");
  if (kind === "suspect") {
    const item = SUSPECTS.find((entry) => entry.id === id);
    return { kind, label: "SUSPECT", name: item?.name || id, image: itemAssetUrl("suspect", id) };
  }
  if (kind === "method") {
    const item = METHODS.find((entry) => entry.id === id);
    return { kind, label: "WEAPON", name: item?.name || id, image: itemAssetUrl("weapon", id) };
  }
  const item = LOCATIONS.find((entry) => entry.id === id);
  return { kind: "location", label: "ROOM", name: item?.name || id, image: itemAssetUrl("room", id) };
}

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
    if (known.includes(cardId)) return "fact";
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
      <header><strong>DETECTIVE NOTEBOOK</strong><span>? possible · ! watch · × ruled out · ✓ proven alibi</span></header>
      {NOTEBOOK_GROUPS.map(([kind, label, items]) => <section key={kind}>
        <h3>{label}</h3>
        {items.map((item) => {
          const cardId = `${kind}:${item.id}`;
          const mark = stateFor(cardId);
          const image = kind === "suspect" ? itemAssetUrl("suspect", item.id) : kind === "method" ? itemAssetUrl("weapon", item.id) : itemAssetUrl("room", item.id);
          return <button key={cardId} type="button" className={mark} disabled={known.includes(cardId)} onClick={() => cycle(cardId)}>
            <img src={image} alt="" /><span>{item.name}</span><b>{mark === "fact" ? "✓" : mark === "watch" ? "!" : mark === "cleared" ? "×" : "?"}</b>
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

  return <section className="bn-board-shell" data-testid="blackglass-noir-board">
    <header><div><small>BLACKGLASS HOTEL · 3:17 AM</small><strong>{myRoom ? LOCATION_MAP[myRoom]?.name : "Hotel corridor"}</strong></div><span>{state.turnPhase === "move" ? `${state.moveRemaining || 0} moves remaining` : state.turnPhase === "refute" ? "Waiting for private alibi" : "Noir investigation floor"}</span></header>
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
    <footer><span>▣ Door threshold</span><span>◆ Player</span><span>Entering a room costs 1 move</span><span>Highlighted spaces are reachable</span></footer>
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

function EvidenceCard({ cardId, compact = false }) {
  const meta = cardMeta(cardId);
  return <article className={`bn-evidence-card ${compact ? "compact" : ""}`}>
    <img src={meta.image} alt="" />
    <div><small>{meta.label}</small><strong>{meta.name}</strong></div>
  </article>;
}

function DeductionDesk({ hand, reveals, known, notebook, setNotebook }) {
  const groups = useMemo(() => buildDeductionGroups({ known, notebook, suspects: SUSPECTS, methods: METHODS, locations: LOCATIONS }), [known, notebook]);
  const handSet = useMemo(() => new Set(hand), [hand]);
  const shownCards = useMemo(() => [...new Set(reveals.map((item) => item.cardId).filter((cardId) => !handSet.has(cardId)))], [reveals, handSet]);
  const provenCount = known.length;
  const manualCount = Object.values(notebook).filter((mark) => mark === "cleared").length;

  function toggleRuledOut(cardId) {
    if (known.includes(cardId)) return;
    setNotebook((value) => ({ ...value, [cardId]: value[cardId] === "cleared" ? "unknown" : "cleared" }));
  }

  return <div className="bn-deduction" data-testid="blackglass-deduction-desk">
    <header className="bn-deduction-head">
      <small>DEDUCTION DESK</small>
      <strong>Find the missing piece</strong>
      <p>Your hand and cards shown directly to you are hard facts. Rule out anything else you can prove. When only one card remains in a category, that is the live possibility.</p>
      <div><span><b>{provenCount}</b> proven</span><span><b>{manualCount}</b> notes ruled out</span></div>
    </header>

    <section className="bn-findings" aria-label="Deduction findings">
      {groups.map((group) => {
        const resolved = group.resolvedCardId ? cardMeta(group.resolvedCardId) : null;
        return <article key={group.kind} className={`${resolved ? "resolved" : ""} ${group.conflict ? "conflict" : ""}`}>
          <small>{group.label.toUpperCase()}</small>
          {resolved ? <><img src={resolved.image} alt="" /><strong>{resolved.name}</strong><span>ONLY POSSIBILITY</span></> : group.conflict ? <><strong>Check your notes</strong><span>Everything is crossed out</span></> : <><b>{group.remaining.length}</b><strong>still possible</strong><span>Rule out {Math.max(0, group.remaining.length - 1)} more</span></>}
        </article>;
      })}
    </section>

    <section className="bn-alibi-hand">
      <header><div><small>YOUR PRIVATE HAND</small><strong>Your alibi cards</strong></div><span>These can never be in the solution.</span></header>
      <div>{hand.length ? hand.map((cardId) => <EvidenceCard key={cardId} cardId={cardId} compact />) : <p>No cards were dealt to this seat.</p>}</div>
    </section>

    {shownCards.length ? <section className="bn-shown-evidence">
      <header><small>SHOWN TO YOU</small><span>Private evidence from other investigators</span></header>
      <div>{shownCards.map((cardId) => <EvidenceCard key={cardId} cardId={cardId} compact />)}</div>
    </section> : null}

    <section className="bn-deduction-grid">
      <header><small>WORKING GRID</small><span>Click a card to rule it out or restore it. Proven cards are locked.</span></header>
      {groups.map((group) => <div key={group.kind} className="bn-deduction-column">
        <h4>{group.label}s <span>{group.remaining.length} possible</span></h4>
        {group.entries.map((entry) => {
          const meta = cardMeta(entry.cardId);
          const statusLabel = entry.status === "fact" ? "PROVEN" : entry.status === "manual" ? "RULED OUT" : entry.status === "watch" ? "WATCH" : "POSSIBLE";
          return <button key={entry.cardId} type="button" className={entry.status} disabled={entry.status === "fact"} onClick={() => toggleRuledOut(entry.cardId)}>
            <img src={meta.image} alt="" /><span><strong>{meta.name}</strong><small>{statusLabel}</small></span><b>{entry.status === "fact" ? "✓" : entry.status === "manual" ? "×" : entry.status === "watch" ? "!" : "·"}</b>
          </button>;
        })}
      </div>)}
    </section>
  </div>;
}

function CaseRail({ tab, setTab, known, hand, reveals, reveal, members, state, theory, scenario, notebook, setNotebook }) {
  return <aside className="bn-case">
    <nav><button type="button" className={tab === "case" ? "active" : ""} onClick={() => setTab("case")}>CASE FILE</button><button type="button" className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>LOG</button><button type="button" className={tab === "deduce" ? "active" : ""} onClick={() => setTab("deduce")}>DEDUCE</button></nav>
    <div className="bn-case-body">
      {tab === "case" ? <div className="bn-case-file">
        <TheoryStrip scenario={scenario} title="RECONSTRUCTING THE SCENE" />
        {reveal ? <article className="bn-refuted"><small>REFUTED ×</small><strong>{evidenceLabel(reveal.cardId)}</strong><span>{members.find((member) => member.uid === reveal.fromUid)?.nickname || "Another investigator"} showed you this private alibi card.</span></article> : null}
        <div className="bn-theory-form"><small>NEW THEORY</small><Select label="Suspect" value={theory.suspectId} onChange={theory.setSuspectId} options={SUSPECTS} disabled={!theory.can} /><Select label="Weapon" value={theory.methodId} onChange={theory.setMethodId} options={METHODS} disabled={!theory.can} /><label><span>Room</span><strong>{theory.location?.name || "Enter a room"}</strong></label><button type="button" className="bn-primary" disabled={!theory.can} onClick={theory.submit}>PROPOSE THEORY</button><details><summary>MAKE ACCUSATION</summary><Select label="Final room" value={theory.accuseLocationId} onChange={theory.setAccuseLocationId} options={LOCATIONS} disabled={!theory.can} /><button type="button" className="bn-danger" disabled={!theory.can} onClick={() => theory.act({ type: "accuse", suspectId: theory.suspectId, methodId: theory.methodId, locationId: theory.accuseLocationId })}>LOCK ACCUSATION</button></details></div>
      </div> : tab === "log" ? <div className="bn-log">{[...(state.caseLog || [])].reverse().map((entry, index) => <p key={`${entry.type}-${index}`}>{entry.text}</p>)}</div> : <DeductionDesk hand={hand} reveals={reveals} known={known} notebook={notebook} setNotebook={setNotebook} />}
    </div>
  </aside>;
}

function AlibiPrompt({ state, user, hand, members, busy, act }) {
  const pending = state.pendingRefutation;
  if (!pending || pending.refuterUid !== user?.uid) return null;
  const matches = matchingAlibiCards(hand, pending.theory);
  const suggester = members.find((member) => member.uid === pending.suggestorUid);

  return <div className="bn-alibi-overlay" role="dialog" aria-modal="true" aria-label="Choose an alibi card">
    <section className="bn-alibi-prompt">
      <header><small>PRIVATE REFUTATION</small><h2>Choose your alibi card</h2><p>You can disprove this theory. Pick exactly one matching card from your hand. Only <strong>{suggester?.nickname || "the investigator"}</strong> will see which card you show.</p></header>
      <TheoryStrip scenario={pending.theory} title="THEORY TO REFUTE" />
      <div className="bn-alibi-options">
        {matches.map((cardId) => {
          const meta = cardMeta(cardId);
          return <button key={cardId} type="button" disabled={busy} onClick={() => act({ type: "showAlibi", cardId })}>
            <img src={meta.image} alt="" /><span><small>{meta.label}</small><strong>{meta.name}</strong><em>SHOW THIS CARD</em></span>
          </button>;
        })}
      </div>
      <footer><span>🔒 Your other cards stay private.</span><span>The turn continues after you choose.</span></footer>
    </section>
  </div>;
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
  const choosingAlibi = state.pendingRefutation?.refuterUid === user?.uid;
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
  const shownScenario = scenario || state.lastTheory;

  return <main className="bn-shell"><section className="bn-table" data-testid="blackglass-game-layout">
    <header className="bn-topbar"><div className="bn-title"><strong>BLACKGLASS HOTEL</strong><small>BLOOD &amp; ALIBI</small></div><div className="bn-turn"><span>TURN {state.turnNumber || 1}</span><strong>{choosingAlibi ? "SHOW AN ALIBI" : myTurn ? "YOUR TURN" : current?.nickname || "INVESTIGATING"}</strong><em>{state.message}</em></div><nav><button type="button" onClick={() => setTab("deduce")}>DEDUCTION</button><button type="button" onClick={navigateToHub}>ALL GAMES</button></nav></header>
    {error ? <p className="bn-error">{error}</p> : null}
    <div className="bn-main"><Notebook known={known} notebook={notebook} setNotebook={setNotebook} /><HotelBoard state={state} members={members} user={user} myTurn={myTurn} busy={busy} act={act} /><CaseRail tab={tab} setTab={setTab} known={known} hand={hand} reveals={reveals} reveal={latestReveal} members={members} state={state} theory={theory} scenario={shownScenario} notebook={notebook} setNotebook={setNotebook} /></div>
    <footer className="bn-bottom"><section className="bn-turn-controls"><Die value={state.lastRoll} rolling={rolling} /><div><button type="button" className="bn-primary" disabled={!canRoll || busy} onClick={roll}>ROLL DICE</button><span>{state.turnPhase === "move" ? `${state.moveRemaining || 0} moves` : state.turnPhase === "investigate" ? "Investigate" : state.turnPhase === "refute" ? "Alibi pending" : "Ready"}</span></div>{canRoll && myLocation?.passageTo ? <button type="button" onClick={() => act({ type: "passage" })}>SECRET PASSAGE</button> : null}{canRoll && myRoomId ? <button type="button" onClick={() => act({ type: "investigateHere" })}>STAY &amp; INVESTIGATE</button> : null}{myTurn && state.turnPhase === "move" ? <button type="button" onClick={() => act({ type: "endMove" })}>END MOVEMENT</button> : null}</section><PlayerDock members={members} state={state} user={user} /><section className="bn-end"><small>CASE STATUS</small><strong>{state.message}</strong><button type="button" disabled={!canInvestigate} onClick={() => act({ type: "end" })}>END TURN</button></section></footer>
    <AlibiPrompt state={state} user={user} hand={hand} members={members} busy={busy} act={act} />
    {state.phase === "game-over" ? <div className="bn-game-over"><div><small>CASE CLOSED</small><h2>{members.find((member) => member.uid === state.winnerUid)?.nickname || "The case"} solved Blackglass</h2><TheoryStrip scenario={solution} title="FINAL SOLUTION" /><button type="button" onClick={navigateToHub}>RETURN TO ALL GAMES</button></div></div> : null}
  </section></main>;
}

export default function NoirGame() {
  const controller = useModularTable({ gameId: "bloodalibi", maxPlayers: BLOOD_ALIBI_RULES.playersMax, minimumPlayers: BLOOD_ALIBI_RULES.playersMin, createGameState: createBloodAlibiGame, reduceGameState: reduceBloodAlibi, chooseRobotMove: chooseBloodAlibiRobotMove, robotDelay: 650 });
  if (!controller.roomCode) return <GameHome controller={controller} title="Blackglass: Blood & Alibi" kicker="Roll · move · reconstruct · refute · accuse" summary="A full-screen modern-noir deduction game set inside Blackglass Hotel. Move across the hotel, build a suspect/weapon/room theory, choose the alibi card you reveal, and use a private deduction desk to solve the case." maxPlayers={6} quickPlayChoices={[{ icon: "🕵️", label: "Open a case vs robot", description: "Start immediately on the full noir hotel board.", rules: {} }]} />;
  if (!controller.room) return <main className="modular-game-shell"><section className="modular-game-panel"><h1>Opening the Blackglass case file…</h1></section></main>;
  if (controller.room.status === "lobby") return <GameLobby controller={controller} title="Blackglass: Blood & Alibi" minimumPlayers={2} maxPlayers={6} startLabel="Seal the hotel" lobbyHint="Two to six investigators. Roll, move, test suspect/weapon/room theories, privately choose alibi cards, deduce the missing pieces, and make a final accusation." />;
  return <Table controller={controller} />;
}

export const gameInfo = Object.freeze({ id: "bloodalibi", name: "Blackglass: Blood & Alibi", players: "2–6" });
