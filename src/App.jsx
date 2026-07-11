import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Copy, Crown, LayoutPanelTop, MessageCircle, Play, Plus,
  Send, Settings, Shuffle, Trash2, Video, Wifi, WifiOff
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
import { DEFAULT_RULES, TEAM_NAMES } from "./game/engine";

const AVATARS = ["🦊","🐻","🦉","🐙","🦁","🐼","🐯","🦄","🐸","🤠"];
const BACKS = ["midnight","emerald","ruby","royal","sunset","linen"];

function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("home");
  const [nickname, setNickname] = useState(localStorage.getItem("canastaNickname") || "Jeff");
  const [avatar, setAvatar] = useState(localStorage.getItem("canastaAvatar") || "🦊");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [privateHand, setPrivateHand] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState({ ...DEFAULT_RULES, cardBack: "midnight", teamMode: true });
  const [meetLink, setMeetLink] = useState("");
  const robotTimer = useRef(null);
  const robotTurnKey = useRef("");

  useEffect(() => {
    if (!firebaseReady) return;
    ensureAnonymousAuth().then(setUser).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    return watchRoom(roomCode, (value) => {
      setRoom(value);
      if (!value) {
        setScreen("home");
        setRoomCode("");
      }
    });
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode || !user) return;
    return watchPrivateHand(roomCode, user.uid, setPrivateHand);
  }, [roomCode, user]);

  useEffect(() => {
    if (!room || !user || room.hostUid !== user.uid) return;
    if (room.publicState?.phase !== "dealing") return;
    const order = room.publicState.dealOrder || [];
    const index = room.publicState.dealAnimationIndex || 0;
    if (index >= order.length) {
      advanceDealAnimation(roomCode, user.uid, order.length, true);
      return;
    }
    const timer = setTimeout(() => {
      advanceDealAnimation(roomCode, user.uid, index + 1, index + 1 >= order.length);
    }, 55);
    return () => clearTimeout(timer);
  }, [room?.publicState?.phase, room?.publicState?.dealAnimationIndex, roomCode, user]);

  const members = useMemo(
    () => Object.values(room?.members || {}).sort((a, b) => a.seat - b.seat),
    [room]
  );
  const teamCount = Number(room?.rules?.teamCount || rules.teamCount || 2);
  const teams = useMemo(
    () => Array.from({ length: teamCount }, (_, team) => members.filter((member) => member.team === team)),
    [members, teamCount]
  );
  const me = room?.members?.[user?.uid];
  const messages = useMemo(
    () => Object.entries(room?.messages || {})
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [room]
  );

  useEffect(() => {
    if (!room || !user || room.hostUid !== user.uid || room.status !== "playing" || room.publicState?.phase !== "playing") return;
    const active = members[Number(room.publicState?.currentPlayerIndex || 0)];
    if (!active?.isRobot) {
      robotTurnKey.current = "";
      return;
    }
    const key = `${room.handNumber}-${room.publicState.currentPlayerIndex}-${active.uid}-${room.publicState.lastAction}`;
    if (robotTurnKey.current === key) return;
    robotTurnKey.current = key;
    clearTimeout(robotTimer.current);
    robotTimer.current = setTimeout(async () => {
      try {
        await runRobotTurn(roomCode, user.uid);
      } catch (e) {
        setError(`Robot turn failed: ${e.message}`);
        robotTurnKey.current = "";
      }
    }, active.difficulty === "fast" ? 450 : active.difficulty === "careful" ? 1500 : 900);
    return () => clearTimeout(robotTimer.current);
  }, [room?.status, room?.publicState?.phase, room?.publicState?.currentPlayerIndex, room?.publicState?.lastAction, members, roomCode, user, room?.handNumber]);

  function changeTeamCount(value) {
    const count = Number(value);
    setRules((current) => ({
      ...current,
      teamCount: count,
      deckCount: count === 3 ? 3 : Math.min(current.deckCount, 3),
    }));
  }

  async function createGame() {
    if (!user) return;
    setBusy(true); setError("");
    try {
      localStorage.setItem("canastaNickname", nickname);
      localStorage.setItem("canastaAvatar", avatar);
      const code = await createRoom({ user, nickname, avatar, rules, meetLink });
      setRoomCode(code); setScreen("lobby");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function joinGame() {
    if (!user) return;
    setBusy(true); setError("");
    try {
      localStorage.setItem("canastaNickname", nickname);
      localStorage.setItem("canastaAvatar", avatar);
      const code = await joinRoom({ code: joinCode, user, nickname, avatar });
      setRoomCode(code); setScreen("lobby");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submitMessage() {
    if (!message.trim() || !me) return;
    const text = message; setMessage("");
    await sendMessage(roomCode, me, text);
  }

  async function handleAddRobot(team, difficulty = "standard") {
    setError("");
    try { await addRobot(roomCode, user.uid, team, difficulty); }
    catch (e) { setError(e.message); }
  }

  async function handleTeamChange(team) {
    setError("");
    try { await updateMember(roomCode, user.uid, { team: Number(team) }); }
    catch (e) { setError(e.message); }
  }

  async function handleStart() {
    setError("");
    try { await startOnlineGame(roomCode, user.uid); }
    catch (e) { setError(e.message); }
  }

  if (!firebaseReady) {
    return <main className="setup-page"><section className="config-card"><WifiOff size={42}/><p className="eyebrow">ONE-TIME SETUP</p><h1>Connect your Firebase web app.</h1><p>Missing: {firebaseMissing.join(", ")}</p></section></main>;
  }

  if (screen === "home") {
    return (
      <main className="landing">
        <section className="hero">
          <div className="brand"><span>FC</span><b>Family Canasta</b></div>
          <p className="eyebrow">PLAY TOGETHER, ANYWHERE</p>
          <h1>Partners at the table. People or robots.</h1>
          <p className="lede">Choose two or three teams of two. Fill any open seat with an autonomous robot that draws, melds, and discards on its own.</p>
          <div className="trust"><Wifi size={16}/> Firebase connected</div>
        </section>
        <section className="entry-panel">
          <label>Nickname</label><input value={nickname} onChange={(e) => setNickname(e.target.value)}/>
          <label>Avatar</label><div className="avatars">{AVATARS.map((item) => <button className={avatar===item?"chosen":""} onClick={()=>setAvatar(item)} key={item}>{item}</button>)}</div>
          <details open><summary><Settings size={16}/> Game setup</summary><div className="settings-grid">
            <label>Teams<select value={rules.teamCount} onChange={(e)=>changeTeamCount(e.target.value)}><option value={2}>2 teams · 4 players</option><option value={3}>3 teams · 6 players</option></select></label>
            <label>Decks<select value={rules.deckCount} onChange={(e)=>setRules({...rules,deckCount:Number(e.target.value)})}><option value={2} disabled={rules.teamCount===3}>2 decks</option><option value={3}>3 decks</option></select></label>
            <label>Starting cards<select value={rules.cardsPerPlayer} onChange={(e)=>setRules({...rules,cardsPerPlayer:Number(e.target.value)})}><option value={11}>11</option><option value={13}>13</option><option value={15}>15</option></select></label>
            <label>Card back<select value={rules.cardBack} onChange={(e)=>setRules({...rules,cardBack:e.target.value})}>{BACKS.map((back)=><option key={back}>{back}</option>)}</select></label>
            <label className="wide-setting">Meet link<input value={meetLink} onChange={(e)=>setMeetLink(e.target.value)} placeholder="abc-defg-hij"/></label>
          </div></details>
          <button className="primary" disabled={!user||busy} onClick={createGame}><Plus/> Create a team game</button>
          <div className="divider"><span/>or join<span/></div>
          <div className="join-row"><input maxLength={6} value={joinCode} onChange={(e)=>setJoinCode(e.target.value.toUpperCase())} placeholder="ROOM CODE"/><button disabled={!user||busy} onClick={joinGame}>Join</button></div>
          {error&&<p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (!room) return <main className="loading">Joining table…</main>;

  if (room.status === "lobby") {
    const requiredSeats = teamCount * 2;
    const ready = members.length === requiredSeats && teams.every((team) => team.length === 2) && Array.from({ length: teamCount }, (_, team) => room.teamBoardKeepers?.[team]).every(Boolean);
    return (
      <main className="lobby-page">
        <header><div className="brand"><span>FC</span><b>Family Canasta</b></div><div className="code"><small>ROOM</small><b>{roomCode}</b><button onClick={()=>navigator.clipboard.writeText(roomCode)}><Copy size={16}/></button></div></header>
        <section className="team-lobby">
          <div className="lobby-title"><p className="eyebrow">TWO-PERSON TEAMS</p><h1>Choose the partnerships</h1><p>This room uses {teamCount} teams and needs {requiredSeats} total seats. Empty seats can be filled by robots.</p></div>
          <div className={`team-columns teams-${teamCount}`}>
            {Array.from({ length: teamCount }, (_, team)=><section className="team-card" key={team}>
              <div className="team-card-head"><div><small>TEAM</small><h2>{TEAM_NAMES[team]}</h2></div><span>{teams[team].length}/2 seats</span></div>
              <div className="team-members">
                {teams[team].map((member)=><article key={member.uid}>
                  <span className="avatar">{member.avatar}</span>
                  <div><b>{member.nickname}</b><small>{member.isRobot?`Robot · ${member.difficulty}`:member.connected?"Connected":"Reconnecting"}</small></div>
                  {member.isHost&&<Crown size={16}/>} {member.isRobot&&<Bot size={16}/>} 
                  {member.uid===user.uid&&<select value={member.team} onChange={(e)=>handleTeamChange(e.target.value)}>{Array.from({ length: teamCount },(_,option)=><option value={option} key={option}>{TEAM_NAMES[option]}</option>)}</select>}
                  {room.hostUid===user.uid&&member.isRobot&&<button className="icon-button" onClick={()=>removeRobot(roomCode,user.uid,member.uid)}><Trash2 size={15}/></button>}
                </article>)}
                {teams[team].length<2&&room.hostUid===user.uid&&<div className="robot-add-row"><button className="add-robot" onClick={()=>handleAddRobot(team,"standard")}><Bot size={18}/> Add robot</button><select defaultValue="standard" onChange={(e)=>{const button=e.currentTarget.previousElementSibling;button.onclick=()=>handleAddRobot(team,e.target.value);}}><option value="fast">Fast</option><option value="standard">Standard</option><option value="careful">Careful</option></select></div>}
              </div>
              <label className="board-keeper"><LayoutPanelTop size={17}/><span>Shared board is displayed in front of</span><select value={room.teamBoardKeepers?.[team]||""} onChange={(e)=>setTeamBoardKeeper(roomCode,user.uid,team,e.target.value)} disabled={room.hostUid!==user.uid}><option value="">Choose player</option>{teams[team].map((member)=><option key={member.uid} value={member.uid}>{member.nickname}</option>)}</select></label>
            </section>)}
          </div>
          <aside className="lobby-actions">
            <div className="summary"><h3>Game setup</h3><p><span>Format</span><b>{teamCount} teams of 2</b></p><p><span>Players</span><b>{members.length}/{requiredSeats}</b></p><p><span>Decks</span><b>{room.rules.deckCount}</b></p><p><span>First dealer</span><b>Random</b></p><p><span>Robot turns</span><b>Automatic</b></p></div>
            {room.meetLink&&<a className="meet" href={room.meetLink.startsWith("http")?room.meetLink:`https://meet.google.com/${room.meetLink}`} target="_blank" rel="noreferrer"><Video size={17}/> Join Google Meet</a>}
            {room.hostUid===user.uid?<button className="primary" onClick={handleStart} disabled={!ready}><Play/> Start {teamCount}-team game</button>:<p className="waiting">Waiting for the host to begin…</p>}
            {error&&<p className="error">{error}</p>}
          </aside>
        </section>
      </main>
    );
  }

  const dealer = members[room.dealerIndex];
  const active = members[Number(room.publicState?.currentPlayerIndex || 0)];
  const visibleDealCount = room.publicState?.dealAnimationIndex || 0;
  const keeperName = (team) => members.find((member)=>member.uid===room.publicState?.boardKeepers?.[team])?.nickname || "Team board";

  return (
    <main className="game-page">
      <header><div className="brand"><span>FC</span><b>Family Canasta</b></div><div className="turn">{room.publicState?.phase==="dealing"?"Dealing cards…":room.publicState?.phase==="handOver"?room.publicState.lastAction:active?.isRobot?`${active.nickname} is thinking…`:`${active?.nickname||"Player"}'s turn`}</div><div className="code"><small>ROOM</small><b>{roomCode}</b></div></header>
      <section className="table">
        <div className="opponents">{members.filter((member)=>member.uid!==user.uid).map((member)=><article className={active?.uid===member.uid?"active-player":""} key={member.uid}><span>{member.avatar}</span><b>{member.nickname}{member.isRobot?" 🤖":""}</b><small>{room.publicState?.handCounts?.[member.uid]||0} cards · {TEAM_NAMES[member.team]}</small>{dealer?.uid===member.uid&&<em><Crown size={12}/> Dealer</em>}</article>)}</div>
        <div className={`shared-boards boards-${teamCount}`}>{Array.from({ length: teamCount },(_,team)=><section key={team} className={`shared-board team-${team}`}><div><LayoutPanelTop size={16}/><b>Team {TEAM_NAMES[team]} board</b><small>in front of {keeperName(team)}</small></div><div className="meld-slots">{(room.publicState?.teamBoards?.[team]||[]).length===0?<span>No melds played yet</span>:room.publicState.teamBoards[team].map((meld,index)=><span className={meld.cards?.length>=7?"canasta":""} key={`${meld.rank}-${index}`}>{meld.rank} × {meld.cards?.length||0}{meld.cards?.length>=7?" · CANASTA":""}</span>)}</div></section>)}</div>
        <div className="center"><div className="pile back-card"><span>{room.publicState?.stockCount||0}</span></div><div className="dealer-orb"><Shuffle/><small>DEALER</small><b>{dealer?.nickname}</b><p>{room.publicState?.lastAction}</p></div><div className="pile discard-card"><b>{room.publicState?.discardPile?.at(-1)?.rank||"—"}</b><span>{room.publicState?.discardPile?.at(-1)?.suit||""}</span></div></div>
        <div className="hand"><div className="identity"><span>{me?.avatar}</span><b>{me?.nickname}</b><small>Team {TEAM_NAMES[me?.team||0]}</small>{dealer?.uid===user.uid&&<em>Dealer</em>}</div><div className="cards"><AnimatePresence>{privateHand.map((card,index)=>{const wasDealt=room.publicState?.phase!=="dealing"||visibleDealCount>index*members.length;return wasDealt?<motion.button key={card.id} initial={{y:-320,opacity:0,rotate:12}} animate={{y:0,opacity:1,rotate:(index-privateHand.length/2)*0.8}} transition={{duration:.28,type:"spring"}} className={card.color==="red"?"playing-card red":"playing-card"}><b>{card.rank}</b><span>{card.suit}</span></motion.button>:null;})}</AnimatePresence></div></div>
      </section>
      <aside className="chat"><h3><MessageCircle size={17}/> Table chat</h3><div className="messages">{messages.map((chat)=><article key={chat.id}><span>{chat.avatar}</span><div><b>{chat.nickname}</b><p>{chat.text}</p></div></article>)}</div><div className="compose"><input value={message} onChange={(e)=>setMessage(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&submitMessage()} placeholder="Message the table"/><button onClick={submitMessage}><Send size={17}/></button></div></aside>
    </main>
  );
}

export default App;
