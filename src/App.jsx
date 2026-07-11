import React, { useEffect, useMemo, useState } from "react";
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
  sendMessage,
  setTeamBoardKeeper,
  startOnlineGame,
  updateMember,
  watchPrivateHand,
  watchRoom,
} from "./services/roomService";
import { DEFAULT_RULES } from "./game/engine";

const AVATARS = ["🦊","🐻","🦉","🐙","🦁","🐼","🐯","🦄","🐸","🤠"];
const BACKS = ["midnight","emerald","ruby","royal","sunset","linen"];
const TEAM_NAMES = ["North", "South"];

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
  const me = room?.members?.[user?.uid];
  const messages = useMemo(
    () => Object.entries(room?.messages || {})
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [room]
  );
  const teams = [0, 1].map((team) => members.filter((member) => member.team === team));

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

  async function handleAddRobot(team) {
    setError("");
    try { await addRobot(roomCode, user.uid, team, "standard"); }
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
          <p className="lede">Build two teams of two, choose who keeps each team’s shared board, and play from computers or phones.</p>
          <div className="trust"><Wifi size={16}/> Firebase connected</div>
        </section>
        <section className="entry-panel">
          <label>Nickname</label><input value={nickname} onChange={(e) => setNickname(e.target.value)}/>
          <label>Avatar</label><div className="avatars">{AVATARS.map((item) => <button className={avatar===item?"chosen":""} onClick={()=>setAvatar(item)} key={item}>{item}</button>)}</div>
          <details><summary><Settings size={16}/> Game setup</summary><div className="settings-grid">
            <label>Decks<select value={rules.deckCount} onChange={(e)=>setRules({...rules,deckCount:Number(e.target.value)})}><option value={2}>2 decks</option><option value={3}>3 decks</option></select></label>
            <label>Starting cards<select value={rules.cardsPerPlayer} onChange={(e)=>setRules({...rules,cardsPerPlayer:Number(e.target.value)})}><option value={11}>11</option><option value={13}>13</option><option value={15}>15</option></select></label>
            <label>Card back<select value={rules.cardBack} onChange={(e)=>setRules({...rules,cardBack:e.target.value})}>{BACKS.map((b)=><option key={b}>{b}</option>)}</select></label>
            <label>Meet link<input value={meetLink} onChange={(e)=>setMeetLink(e.target.value)} placeholder="abc-defg-hij"/></label>
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
    return (
      <main className="lobby-page">
        <header><div className="brand"><span>FC</span><b>Family Canasta</b></div><div className="code"><small>ROOM</small><b>{roomCode}</b><button onClick={()=>navigator.clipboard.writeText(roomCode)}><Copy size={16}/></button></div></header>
        <section className="team-lobby">
          <div className="lobby-title"><p className="eyebrow">TWO-PERSON TEAMS</p><h1>Choose the partnerships</h1><p>Each team needs exactly two seats. Empty seats can be filled by robots.</p></div>
          <div className="team-columns">
            {[0,1].map((team)=><section className="team-card" key={team}>
              <div className="team-card-head"><div><small>TEAM</small><h2>{TEAM_NAMES[team]}</h2></div><span>{teams[team].length}/2 seats</span></div>
              <div className="team-members">
                {teams[team].map((member)=><article key={member.uid}>
                  <span className="avatar">{member.avatar}</span>
                  <div><b>{member.nickname}</b><small>{member.isRobot?`Robot · ${member.difficulty}`:member.connected?"Connected":"Reconnecting"}</small></div>
                  {member.isHost&&<Crown size={16}/>} {member.isRobot&&<Bot size={16}/>} 
                  {member.uid===user.uid&&<select value={member.team} onChange={(e)=>updateMember(roomCode,user.uid,{team:Number(e.target.value)})}><option value={0}>North</option><option value={1}>South</option></select>}
                  {room.hostUid===user.uid&&member.isRobot&&<button className="icon-button" onClick={()=>removeRobot(roomCode,user.uid,member.uid)}><Trash2 size={15}/></button>}
                </article>)}
                {teams[team].length<2&&room.hostUid===user.uid&&<button className="add-robot" onClick={()=>handleAddRobot(team)}><Bot size={18}/> Add robot partner</button>}
              </div>
              <label className="board-keeper"><LayoutPanelTop size={17}/><span>Shared board is displayed in front of</span><select value={room.teamBoardKeepers?.[team]||""} onChange={(e)=>setTeamBoardKeeper(roomCode,user.uid,team,e.target.value)} disabled={room.hostUid!==user.uid}><option value="">Choose player</option>{teams[team].map((member)=><option key={member.uid} value={member.uid}>{member.nickname}</option>)}</select></label>
            </section>)}
          </div>
          <aside className="lobby-actions">
            <div className="summary"><h3>Game setup</h3><p><span>Format</span><b>2 vs 2</b></p><p><span>Decks</span><b>{room.rules.deckCount}</b></p><p><span>First dealer</span><b>Random</b></p><p><span>Team boards</span><b>Shared</b></p></div>
            {room.meetLink&&<a className="meet" href={room.meetLink.startsWith("http")?room.meetLink:`https://meet.google.com/${room.meetLink}`} target="_blank" rel="noreferrer"><Video size={17}/> Join Google Meet</a>}
            {room.hostUid===user.uid?<button className="primary" onClick={handleStart} disabled={members.length!==4}><Play/> Start team game</button>:<p className="waiting">Waiting for the host to begin…</p>}
            {error&&<p className="error">{error}</p>}
          </aside>
        </section>
      </main>
    );
  }

  const dealer = members[room.dealerIndex];
  const active = members[room.publicState?.currentPlayerIndex || 0];
  const visibleDealCount = room.publicState?.dealAnimationIndex || 0;
  const keeperName = (team) => members.find((m)=>m.uid===room.publicState?.boardKeepers?.[team])?.nickname || "Team board";

  return (
    <main className="game-page">
      <header><div className="brand"><span>FC</span><b>Family Canasta</b></div><div className="turn">{room.publicState?.phase==="dealing"?"Dealing cards…":`${active?.nickname||"Player"}'s turn`}</div><div className="code"><small>ROOM</small><b>{roomCode}</b></div></header>
      <section className="table">
        <div className="opponents">{members.filter((m)=>m.uid!==user.uid).map((member)=><article key={member.uid}><span>{member.avatar}</span><b>{member.nickname}{member.isRobot?" 🤖":""}</b><small>{room.publicState?.handCounts?.[member.uid]||0} cards · {TEAM_NAMES[member.team]}</small>{dealer?.uid===member.uid&&<em><Crown size={12}/> Dealer</em>}</article>)}</div>
        <div className="shared-boards">{[0,1].map((team)=><section key={team} className={`shared-board team-${team}`}><div><LayoutPanelTop size={16}/><b>Team {TEAM_NAMES[team]} board</b><small>in front of {keeperName(team)}</small></div><div className="meld-slots">{(room.publicState?.teamBoards?.[team]||[]).length===0?<span>No melds played yet</span>:room.publicState.teamBoards[team].map((meld,index)=><span key={index}>{meld.rank} × {meld.cards?.length||0}</span>)}</div></section>)}</div>
        <div className="center"><div className="pile back-card"><span>{room.publicState?.stockCount||0}</span></div><div className="dealer-orb"><Shuffle/><small>DEALER</small><b>{dealer?.nickname}</b></div><div className="pile discard-card"><b>{room.publicState?.discardPile?.at(-1)?.rank||"—"}</b><span>{room.publicState?.discardPile?.at(-1)?.suit||""}</span></div></div>
        <div className="hand"><div className="identity"><span>{me?.avatar}</span><b>{me?.nickname}</b><small>Team {TEAM_NAMES[me?.team||0]}</small>{dealer?.uid===user.uid&&<em>Dealer</em>}</div><div className="cards"><AnimatePresence>{privateHand.map((card,index)=>{const wasDealt=room.publicState?.phase!=="dealing"||visibleDealCount>index*members.length;return wasDealt?<motion.button key={card.id} initial={{y:-320,opacity:0,rotate:12}} animate={{y:0,opacity:1,rotate:(index-privateHand.length/2)*0.8}} transition={{duration:.28,type:"spring"}} className={card.color==="red"?"playing-card red":"playing-card"}><b>{card.rank}</b><span>{card.suit}</span></motion.button>:null;})}</AnimatePresence></div></div>
      </section>
      <aside className="chat"><h3><MessageCircle size={17}/> Table chat</h3><div className="messages">{messages.map((m)=><article key={m.id}><span>{m.avatar}</span><div><b>{m.nickname}</b><p>{m.text}</p></div></article>)}</div><div className="compose"><input value={message} onChange={(e)=>setMessage(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&submitMessage()} placeholder="Message the table"/><button onClick={submitMessage}><Send size={17}/></button></div></aside>
    </main>
  );
}

export default App;
