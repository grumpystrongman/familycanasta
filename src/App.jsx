import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Copy,
  Crown,
  Hand,
  LayoutPanelTop,
  MessageCircle,
  Play,
  Plus,
  Send,
  Settings,
  Shuffle,
  Trash2,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ensureAnonymousAuth, firebaseMissing, firebaseReady } from "./firebase";
import {
  addRobot,
  advanceDealAnimation,
  createRoom,
  joinRoom,
  removeRobot,
  runRobotTurn,
  sendMessage,
  setTeamBoardKeeper,
  startOnlineGame,
  updateMember,
  watchPrivateHand,
  watchRoom,
} from "./services/roomService";
import {
  discardSelectedCard,
  drawFromStock,
  meldSelectedCards,
  takeDiscardPile,
} from "./game/humanActions";
import {
  cardPoints,
  DEFAULT_RULES,
  isRedThree,
  isWild,
  openingRequirement,
  scoreTeamBoard,
  sortHand,
  SUIT_SYMBOLS,
  TEAM_NAMES,
} from "./game/engine";

const AVATARS = ["🦊","🐻","🦉","🐙","🦁","🐼","🐯","🦄","🐸","🤠"];
const BACKS = ["midnight","emerald","ruby","royal","sunset","linen"];
const PIPS = {
  A:[[50,50]], 2:[[50,22],[50,78]], 3:[[50,20],[50,50],[50,80]],
  4:[[28,25],[72,25],[28,75],[72,75]],
  5:[[28,22],[72,22],[50,50],[28,78],[72,78]],
  6:[[28,20],[72,20],[28,50],[72,50],[28,80],[72,80]],
  7:[[28,18],[72,18],[50,35],[28,52],[72,52],[28,82],[72,82]],
  8:[[28,17],[72,17],[50,32],[28,48],[72,48],[50,64],[28,83],[72,83]],
  9:[[28,16],[72,16],[28,36],[72,36],[50,50],[28,64],[72,64],[28,84],[72,84]],
  10:[[28,13],[72,13],[50,27],[28,37],[72,37],[28,63],[72,63],[50,73],[28,87],[72,87]],
};

function CardFace({ card, selected = false, onClick, compact = false, dragProps = {} }) {
  const suit = SUIT_SYMBOLS[card.suit] || "★";
  const face = ["J","Q","K"].includes(card.rank);
  const joker = card.rank === "JOKER";
  return (
    <motion.button
      type="button"
      className={`real-card ${card.color === "red" ? "red" : "black"} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
      aria-label={`${card.rank} ${suit}`}
      {...dragProps}
    >
      <span className="card-corner top"><b>{joker ? "JK" : card.rank}</b><i>{suit}</i></span>
      {joker ? (
        <div className="joker-art"><span>★</span><b>JOKER</b></div>
      ) : face ? (
        <div className="court-art"><span>{suit}</span><b>{card.rank}</b><span>{suit}</span></div>
      ) : (
        <div className="pip-field">
          {(PIPS[card.rank] || [[50,50]]).map(([x,y], index) => (
            <span key={index} style={{ left:`${x}%`, top:`${y}%` }}>{suit}</span>
          ))}
        </div>
      )}
      <span className="card-corner bottom"><b>{joker ? "JK" : card.rank}</b><i>{suit}</i></span>
    </motion.button>
  );
}

function TeamScoreCard({ room, team }) {
  const breakdown = scoreTeamBoard(room, team, null);
  const total = Number(room.publicState?.teamScores?.[team] || 0);
  const opened = Boolean(room.publicState?.opened?.[team]);
  const meldNeed = openingRequirement(total);
  return (
    <article className="score-team-card">
      <div className="score-team-head">
        <div><small>TEAM</small><b>{TEAM_NAMES[team]}</b></div>
        <strong>{total.toLocaleString()}</strong>
      </div>
      <div className="score-lines">
        <span><i>Current board</i><b>{breakdown.boardCardPoints + breakdown.canastaBonus + breakdown.redThreePoints}</b></span>
        <span><i>Cards played</i><b>{breakdown.boardCardPoints}</b></span>
        <span><i>Clean books</i><b>{breakdown.cleanCanastas} · {breakdown.cleanCanastas * 500}</b></span>
        <span><i>Dirty books</i><b>{breakdown.dirtyCanastas} · {breakdown.dirtyCanastas * 300}</b></span>
        <span><i>Red threes</i><b>{breakdown.redThreeCount} · {breakdown.redThreePoints}</b></span>
      </div>
      <div className={`meld-requirement ${opened ? "met" : ""}`}>
        {opened ? "Opening meld completed" : `Opening meld required: ${meldNeed} points`}
      </div>
    </article>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("home");
  const [nickname, setNickname] = useState(localStorage.getItem("canastaNickname") || "Jeff");
  const [avatar, setAvatar] = useState(localStorage.getItem("canastaAvatar") || "🦊");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [privateHand, setPrivateHand] = useState([]);
  const [selected, setSelected] = useState([]);
  const [targetRank, setTargetRank] = useState("");
  const [handOrder, setHandOrder] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("score");
  const [rules, setRules] = useState({ ...DEFAULT_RULES, cardBack:"midnight" });
  const [meetLink, setMeetLink] = useState("");
  const robotTimer = useRef(null);
  const robotTurnKey = useRef("");

  useEffect(() => {
    if (firebaseReady) ensureAnonymousAuth().then(setUser).catch((event) => setError(event.message));
  }, []);

  useEffect(() => {
    if (!roomCode) return undefined;
    return watchRoom(roomCode, (value) => {
      setRoom(value);
      if (!value) {
        setScreen("home");
        setRoomCode("");
      }
    });
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode || !user) return undefined;
    return watchPrivateHand(roomCode, user.uid, setPrivateHand);
  }, [roomCode, user]);

  useEffect(() => {
    setHandOrder((current) => {
      const available = new Set(privateHand.map((card) => card.id));
      const retained = current.filter((id) => available.has(id));
      const missing = sortHand(privateHand).map((card) => card.id).filter((id) => !retained.includes(id));
      return [...retained, ...missing];
    });
    setSelected((current) => current.filter((id) => privateHand.some((card) => card.id === id)));
  }, [privateHand]);

  const members = useMemo(
    () => Object.values(room?.members || {}).sort((a,b) => a.seat - b.seat),
    [room],
  );
  const teamCount = Number(room?.rules?.teamCount || rules.teamCount || 2);
  const playersPerTeam = Number(room?.rules?.playersPerTeam || rules.playersPerTeam || 1);
  const teams = useMemo(
    () => Array.from({ length:teamCount }, (_, team) => members.filter((member) => Number(member.team) === team)),
    [members, teamCount],
  );
  const me = room?.members?.[user?.uid];
  const active = members[Number(room?.publicState?.currentPlayerIndex || 0)];
  const isMyTurn = active?.uid === user?.uid;
  const turnPhase = room?.publicState?.turnPhase || "draw";
  const canSelectCards = Boolean(isMyTurn && room?.publicState?.phase === "playing" && turnPhase !== "draw" && !busy);
  const orderedHand = handOrder.map((id) => privateHand.find((card) => card.id === id)).filter(Boolean);
  const selectedCards = orderedHand.filter((card) => selected.includes(card.id));
  const selectedPoints = selectedCards.reduce((sum, card) => sum + cardPoints(card), 0);
  const openingNeed = openingRequirement(Number(room?.publicState?.teamScores?.[me?.team] || 0));
  const teamOpened = Boolean(room?.publicState?.opened?.[me?.team]);
  const teamBoard = room?.publicState?.teamBoards?.[me?.team] || [];
  const existingRanks = teamBoard.map((meld) => meld.rank);
  const selectedNaturals = [...new Set(selectedCards.filter((card) => !isWild(card)).map((card) => card.rank))];
  const allWild = selectedCards.length > 0 && selectedCards.every(isWild);
  const suggestedRank = allWild ? targetRank : (selectedNaturals.length === 1 ? selectedNaturals[0] : "");
  const existingTarget = teamBoard.find((meld) => meld.rank === suggestedRank);
  const combined = existingTarget ? [...(existingTarget.cards || []), ...selectedCards] : selectedCards;
  const naturals = combined.filter((card) => !isWild(card));
  const wilds = combined.filter(isWild);
  const selectionLegal = selectedCards.length > 0
    && !selectedCards.some((card) => card.rank === "3")
    && naturals.length > 0
    && new Set(naturals.map((card) => card.rank)).size === 1
    && wilds.length < naturals.length
    && wilds.length <= Number(room?.rules?.maxWildsPerMeld || 3)
    && (existingTarget || selectedCards.length >= 3);
  const requirementMet = teamOpened || selectedPoints >= openingNeed;
  const messages = useMemo(
    () => Object.entries(room?.messages || {})
      .map(([id, value]) => ({ id, ...value }))
      .sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [room],
  );

  useEffect(() => {
    if (!room || !user || room.hostUid !== user.uid || room.publicState?.phase !== "dealing") return;
    const order = room.publicState.dealOrder || [];
    const index = room.publicState.dealAnimationIndex || 0;
    if (index >= order.length) {
      advanceDealAnimation(roomCode, user.uid, order.length, true);
      return;
    }
    const timer = setTimeout(
      () => advanceDealAnimation(roomCode, user.uid, index + 1, index + 1 >= order.length),
      45,
    );
    return () => clearTimeout(timer);
  }, [room?.publicState?.phase, room?.publicState?.dealAnimationIndex, roomCode, user]);

  useEffect(() => {
    if (!room || !user || room.hostUid !== user.uid || room.status !== "playing" || room.publicState?.phase !== "playing") return;
    const current = members[Number(room.publicState.currentPlayerIndex || 0)];
    if (!current?.isRobot) {
      robotTurnKey.current = "";
      return;
    }
    const key = `${room.handNumber}-${room.publicState.currentPlayerIndex}-${current.uid}-${room.publicState.lastAction}`;
    if (robotTurnKey.current === key) return;
    robotTurnKey.current = key;
    clearTimeout(robotTimer.current);
    robotTimer.current = setTimeout(() => {
      runRobotTurn(roomCode, user.uid).catch((event) => {
        setError(event.message);
        robotTurnKey.current = "";
      });
    }, 900);
    return () => clearTimeout(robotTimer.current);
  }, [room?.status, room?.publicState?.phase, room?.publicState?.currentPlayerIndex, room?.publicState?.lastAction, members, roomCode, user, room?.handNumber]);

  async function act(action, keepSelection = false) {
    setBusy(true);
    setError("");
    try {
      await action();
      if (!keepSelection) {
        setSelected([]);
        setTargetRank("");
      }
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleCard(id) {
    if (!canSelectCards) return;
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function moveCard(source, target) {
    if (!source || !target || source === target) return;
    setHandOrder((current) => {
      const next = [...current];
      const from = next.indexOf(source);
      const to = next.indexOf(target);
      if (from < 0 || to < 0) return current;
      next.splice(from, 1);
      next.splice(to, 0, source);
      return next;
    });
  }

  function setPlayMode(mode) {
    const players = mode === "partners" ? 2 : 1;
    const maxTeams = mode === "partners" ? 3 : 4;
    const teamsValue = Math.min(rules.teamCount, maxTeams);
    const totalPlayers = teamsValue * players;
    setRules({
      ...rules,
      playMode: mode,
      playersPerTeam: players,
      teamCount: teamsValue,
      deckCount: totalPlayers > 4 ? 3 : 2,
      cardsPerPlayer: totalPlayers === 2 ? 15 : 11,
    });
  }

  async function createGame({ versusRobot = false } = {}) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      localStorage.setItem("canastaNickname", nickname);
      localStorage.setItem("canastaAvatar", avatar);
      const selectedRules = versusRobot
        ? { ...rules, playMode:"solo", playersPerTeam:1, teamCount:2, deckCount:2, cardsPerPlayer:15 }
        : rules;
      const code = await createRoom({ user, nickname, avatar, rules:selectedRules, meetLink });
      if (versusRobot) await addRobot(code, user.uid, 1, "standard");
      setRoomCode(code);
      setScreen("lobby");
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinGame() {
    setBusy(true);
    setError("");
    try {
      const code = await joinRoom({ code:joinCode, user, nickname, avatar });
      setRoomCode(code);
      setScreen("lobby");
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage() {
    if (!message.trim() || !me) return;
    const text = message;
    setMessage("");
    await sendMessage(roomCode, me, text);
  }

  if (!firebaseReady) {
    return <main className="setup-page"><section className="config-card"><WifiOff/><h1>Connect Firebase</h1><p>Missing: {firebaseMissing.join(", ")}</p></section></main>;
  }

  if (screen === "home") {
    const maxTeams = rules.playersPerTeam === 2 ? 3 : 4;
    const totalPlayers = rules.teamCount * rules.playersPerTeam;
    return (
      <main className="landing">
        <section className="hero">
          <div className="brand"><span>FC</span><b>Family Canasta</b></div>
          <p className="eyebrow">PLAY TOGETHER, ANYWHERE</p>
          <h1>Solo, partners, people, or robots.</h1>
          <p className="lede">Play head-to-head against one robot, run four individual teams, or create two-person partnerships.</p>
          <div className="trust"><Wifi size={16}/> Firebase connected</div>
        </section>
        <section className="entry-panel">
          <label>Nickname</label>
          <input value={nickname} onChange={(event) => setNickname(event.target.value)}/>
          <label>Avatar</label>
          <div className="avatars">{AVATARS.map((item) => <button className={avatar === item ? "chosen" : ""} onClick={() => setAvatar(item)} key={item}>{item}</button>)}</div>

          <button className="quick-robot" disabled={!user || busy} onClick={() => createGame({ versusRobot:true })}>
            <Bot/> Play against one robot
          </button>

          <details open>
            <summary><Settings size={16}/> Custom game</summary>
            <div className="settings-grid">
              <label>Play style
                <select value={rules.playersPerTeam === 2 ? "partners" : "solo"} onChange={(event) => setPlayMode(event.target.value)}>
                  <option value="solo">Individual teams</option>
                  <option value="partners">Two-person teams</option>
                </select>
              </label>
              <label>Teams
                <select value={rules.teamCount} onChange={(event) => {
                  const count = Number(event.target.value);
                  const players = rules.playersPerTeam;
                  setRules({ ...rules, teamCount:count, deckCount:count * players > 4 ? 3 : 2 });
                }}>
                  {Array.from({ length:maxTeams - 1 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} teams</option>)}
                </select>
              </label>
              <label>Seats<input value={`${totalPlayers} total players`} readOnly/></label>
              <label>Decks
                <select value={rules.deckCount} onChange={(event) => setRules({ ...rules, deckCount:Number(event.target.value) })}>
                  <option value={2}>2 decks</option><option value={3}>3 decks</option>
                </select>
              </label>
              <label>Starting cards
                <select value={rules.cardsPerPlayer} onChange={(event) => setRules({ ...rules, cardsPerPlayer:Number(event.target.value) })}>
                  <option value={11}>11</option><option value={13}>13</option><option value={15}>15</option>
                </select>
              </label>
              <label>Card back
                <select value={rules.cardBack} onChange={(event) => setRules({ ...rules, cardBack:event.target.value })}>
                  {BACKS.map((back) => <option key={back}>{back}</option>)}
                </select>
              </label>
              <label className="wide-setting">Meet link<input value={meetLink} onChange={(event) => setMeetLink(event.target.value)}/></label>
            </div>
          </details>
          <button className="primary" disabled={!user || busy} onClick={() => createGame()}><Plus/> Create custom game</button>
          <div className="divider"><span/>or join<span/></div>
          <div className="join-row"><input maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ROOM CODE"/><button onClick={joinGame}>Join</button></div>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (!room) return <main className="loading">Joining table…</main>;

  if (room.status === "lobby") {
    const required = teamCount * playersPerTeam;
    const ready = members.length === required
      && teams.every((team) => team.length === playersPerTeam)
      && Array.from({ length:teamCount }, (_, team) => room.teamBoardKeepers?.[team]).every(Boolean);
    return (
      <main className="lobby-page">
        <header><div className="brand"><span>FC</span><b>Family Canasta</b></div><div className="code"><small>ROOM</small><b>{roomCode}</b><button onClick={() => navigator.clipboard.writeText(roomCode)}><Copy size={16}/></button></div></header>
        <section className="team-lobby">
          <div className="lobby-title"><p className="eyebrow">{playersPerTeam === 2 ? "PARTNERSHIP GAME" : "INDIVIDUAL TEAMS"}</p><h1>Choose the table</h1><p>{teamCount} teams · {playersPerTeam} player{playersPerTeam === 1 ? "" : "s"} per team</p></div>
          <div className={`team-columns teams-${Math.min(teamCount,3)}`}>
            {Array.from({ length:teamCount }, (_, team) => (
              <section className="team-card" key={team}>
                <div className="team-card-head"><h2>{TEAM_NAMES[team]}</h2><span>{teams[team].length}/{playersPerTeam}</span></div>
                <div className="team-members">
                  {teams[team].map((member) => (
                    <article key={member.uid}>
                      <span className="avatar">{member.avatar}</span>
                      <div><b>{member.nickname}</b><small>{member.isRobot ? "Robot" : "Connected"}</small></div>
                      {member.isHost && <Crown size={16}/>} {member.isRobot && <Bot size={16}/>} 
                      {member.uid === user.uid && <select value={member.team} onChange={(event) => updateMember(roomCode, user.uid, { team:Number(event.target.value) }).catch((failure) => setError(failure.message))}>{Array.from({ length:teamCount }, (_, index) => <option value={index} key={index}>{TEAM_NAMES[index]}</option>)}</select>}
                      {room.hostUid === user.uid && member.isRobot && <button className="icon-button" onClick={() => removeRobot(roomCode, user.uid, member.uid)}><Trash2 size={15}/></button>}
                    </article>
                  ))}
                  {teams[team].length < playersPerTeam && room.hostUid === user.uid && (
                    <button className="add-robot" onClick={() => addRobot(roomCode, user.uid, team, "standard").catch((failure) => setError(failure.message))}><Bot/> Add robot</button>
                  )}
                </div>
                <label className="board-keeper"><LayoutPanelTop/><span>Board shown in front of</span><select value={room.teamBoardKeepers?.[team] || ""} onChange={(event) => setTeamBoardKeeper(roomCode, user.uid, team, event.target.value)} disabled={room.hostUid !== user.uid}><option value="">Choose</option>{teams[team].map((member) => <option value={member.uid} key={member.uid}>{member.nickname}</option>)}</select></label>
              </section>
            ))}
          </div>
          <aside className="lobby-actions">
            <div className="summary"><h3>Game setup</h3><p><span>Format</span><b>{playersPerTeam === 2 ? "Partners" : "Solo"}</b></p><p><span>Teams</span><b>{teamCount}</b></p><p><span>Seats</span><b>{members.length}/{required}</b></p><p><span>Draw</span><b>2 cards</b></p></div>
            {room.meetLink && <a className="meet" href={room.meetLink.startsWith("http") ? room.meetLink : `https://meet.google.com/${room.meetLink}`} target="_blank" rel="noreferrer"><Video/> Meet</a>}
            {room.hostUid === user.uid ? <button className="primary" disabled={!ready} onClick={() => startOnlineGame(roomCode, user.uid).catch((failure) => setError(failure.message))}><Play/> Start game</button> : <p>Waiting for host…</p>}
            {error && <p className="error">{error}</p>}
          </aside>
        </section>
      </main>
    );
  }

  const dealer = members[room.dealerIndex];
  const visibleDealCount = room.publicState?.dealAnimationIndex || 0;
  const buttonLabel = teamOpened ? "Play selected" : "Meld selected";

  return (
    <main className="game-page enhanced-game">
      <header>
        <div className="brand"><span>FC</span><b>Family Canasta</b></div>
        <div className={`turn ${isMyTurn ? "your-turn" : ""}`}>
          {room.publicState?.phase === "dealing" ? "Dealing cards…" : isMyTurn ? `YOUR TURN — ${turnPhase === "draw" ? "DRAW 2 CARDS" : "PLAY OR DISCARD"}` : `${active?.nickname || "Player"}'s turn`}
        </div>
        <div className="code"><small>ROOM</small><b>{roomCode}</b></div>
      </header>

      <section className="table">
        <div className="opponents">
          {members.filter((member) => member.uid !== user.uid).map((member) => (
            <article className={active?.uid === member.uid ? "active-player" : ""} key={member.uid}>
              <span>{member.avatar}</span><b>{member.nickname}{member.isRobot ? " 🤖" : ""}</b>
              <small>{room.publicState?.handCounts?.[member.uid] || 0} cards · {TEAM_NAMES[member.team]}</small>
              {dealer?.uid === member.uid && <em><Crown size={12}/> Dealer</em>}
            </article>
          ))}
        </div>

        <div className="shared-boards">
          {Array.from({ length:teamCount }, (_, team) => {
            const breakdown = scoreTeamBoard(room, team, null);
            const score = Number(room.publicState?.teamScores?.[team] || 0);
            const opened = Boolean(room.publicState?.opened?.[team]);
            return (
              <section key={team} className={`shared-board team-${team}`}>
                <div className="board-title">
                  <LayoutPanelTop size={16}/>
                  <b>Team {TEAM_NAMES[team]} board</b>
                  <small>{opened ? "Meld requirement met" : `Need ${openingRequirement(score)} to open`}</small>
                  <strong>{breakdown.boardCardPoints + breakdown.canastaBonus + breakdown.redThreePoints} pts on board</strong>
                </div>
                <div className="meld-slots">
                  {(room.publicState?.teamBoards?.[team] || []).length === 0 ? <span>No melds yet</span> : (room.publicState.teamBoards[team] || []).map((meld, index) => (
                    <div className="board-meld" key={`${meld.rank}-${index}`}>
                      <b>{meld.rank}</b>
                      <div>{(meld.cards || []).slice(0,10).map((card) => <CardFace card={card} compact key={card.id}/>)}</div>
                      <small>{meld.cards?.length || 0} cards {(meld.cards?.length || 0) >= 7 ? `· ${meld.cards.some(isWild) ? "DIRTY BOOK" : "CLEAN BOOK"}` : ""}</small>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="center">
          <button className="pile-action" disabled={!isMyTurn || turnPhase !== "draw" || busy} onClick={() => act(() => drawFromStock(roomCode, user.uid))}>
            <div className="pile back-card"><span>{room.publicState?.stockCount || 0}</span></div><b>Draw 2 from stock</b>
          </button>
          <div className="dealer-orb"><Shuffle/><small>DEALER</small><b>{dealer?.nickname}</b><span>{room.publicState?.lastAction}</span></div>
          <button className="pile-action" disabled={!isMyTurn || turnPhase !== "draw" || busy || !(room.publicState?.discardPile?.length)} onClick={() => act(() => takeDiscardPile(roomCode, user.uid))}>
            <div className="pile discard-face">{room.publicState?.discardPile?.at(-1) && <CardFace card={room.publicState.discardPile.at(-1)} compact/>}</div><b>Take discard pile</b>
          </button>
        </div>

        <div className={`hand ${isMyTurn ? "active-hand" : ""}`}>
          <div className="identity"><span>{me?.avatar}</span><b>{me?.nickname}</b><small>Team {TEAM_NAMES[me?.team || 0]}</small>{isMyTurn && <strong>YOUR TURN</strong>}</div>
          <div className="selection-advisor">
            <div>
              <b>{selectedCards.length} selected · {selectedPoints} points</b>
              <span>
                {turnPhase === "draw"
                  ? "Draw two cards or take the discard pile first."
                  : !selectedCards.length
                    ? teamOpened ? "Select cards to play. You may make several plays before discarding." : `Opening meld requirement: ${openingNeed} points.`
                    : selectionLegal
                      ? requirementMet ? "Legal play. You may keep playing after this." : `Need ${openingNeed} opening points; selected total is ${selectedPoints}.`
                      : "Choose matching natural ranks. Twos and Jokers are wild cards."}
              </span>
              {allWild && existingRanks.length > 0 && (
                <label className="wild-target">Play wild on
                  <select value={targetRank} onChange={(event) => setTargetRank(event.target.value)}>
                    <option value="">Choose meld</option>{existingRanks.map((rank) => <option key={rank} value={rank}>{rank}s</option>)}
                  </select>
                </label>
              )}
            </div>
            <button disabled={!canSelectCards || !selectionLegal || !requirementMet} onClick={() => act(() => meldSelectedCards(roomCode, user.uid, selected, targetRank || null))}><Hand size={16}/> {buttonLabel}</button>
            <button className="discard-button" disabled={!canSelectCards || selected.length !== 1 || isRedThree(selectedCards[0])} onClick={() => act(() => discardSelectedCard(roomCode, user.uid, selected[0]))}>Discard selected</button>
          </div>

          <div className={`cards ${canSelectCards ? "cards-selectable" : ""}`}>
            <AnimatePresence>
              {orderedHand.map((card, index) => {
                const wasDealt = room.publicState?.phase !== "dealing" || visibleDealCount > index * members.length;
                if (!wasDealt) return null;
                return (
                  <motion.div
                    className={`hand-card-wrap ${selected.includes(card.id) ? "selected-wrap" : ""}`}
                    key={card.id}
                    initial={{ y:-320, opacity:0 }}
                    animate={{ y:0, opacity:1 }}
                    draggable={canSelectCards}
                    onDragStart={(event) => event.dataTransfer.setData("text/card-id", card.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => moveCard(event.dataTransfer.getData("text/card-id"), card.id)}
                  >
                    <CardFace card={card} selected={selected.includes(card.id)} onClick={() => toggleCard(card.id)}/>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <aside className="chat score-chat-sidebar">
        <div className="sidebar-tabs">
          <button className={sidebarTab === "score" ? "active" : ""} onClick={() => setSidebarTab("score")}>Game score</button>
          <button className={sidebarTab === "chat" ? "active" : ""} onClick={() => setSidebarTab("chat")}>Table chat</button>
        </div>
        {sidebarTab === "score" ? (
          <div className="score-sidebar-content">
            <div className="score-target"><small>PLAYING TO</small><b>{Number(room.rules?.targetScore || 5000).toLocaleString()}</b></div>
            {Array.from({ length:teamCount }, (_, team) => <TeamScoreCard room={room} team={team} key={team}/>)}
            <div className="meld-guide">
              <b>Meld requirements</b>
              <span>Below 0: 15</span><span>0–1,499: 50</span><span>1,500–2,999: 90</span><span>3,000+: 120</span>
            </div>
          </div>
        ) : (
          <>
            <div className="messages">{messages.map((item) => <article key={item.id}><span>{item.avatar}</span><div><b>{item.nickname}</b><p>{item.text}</p></div></article>)}</div>
            <div className="compose"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitMessage()} placeholder="Message the table"/><button onClick={submitMessage}><Send size={17}/></button></div>
          </>
        )}
      </aside>

      {error && <div className="game-error" onClick={() => setError("")}>{error}</div>}
    </main>
  );
}
