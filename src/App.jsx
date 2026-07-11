import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot, Copy, Crown, Hand, LayoutPanelTop, MessageCircle, Play, Plus,
  Send, Settings, Shuffle, Trash2, Video, Wifi, WifiOff
} from "lucide-react";
import { ensureAnonymousAuth, firebaseMissing, firebaseReady } from "./firebase";
import {
  addRobot, advanceDealAnimation, createRoom, joinRoom, removeRobot,
  runRobotTurn, sendMessage, setTeamBoardKeeper, startOnlineGame,
  updateMember, watchPrivateHand, watchRoom,
} from "./services/roomService";
import { discardSelectedCard, drawFromStock, meldSelectedCards, takeDiscardPile } from "./game/humanActions";
import {
  cardPoints, DEFAULT_RULES, isRedThree, isWild, openingRequirement,
  sortHand, SUIT_SYMBOLS, TEAM_NAMES,
} from "./game/engine";

const AVATARS = ["🦊","🐻","🦉","🐙","🦁","🐼","🐯","🦄","🐸","🤠"];
const BACKS = ["midnight","emerald","ruby","royal","sunset","linen"];
const PIPS = {
  A:[[50,50]], 2:[[50,22],[50,78]], 3:[[50,20],[50,50],[50,80]],
  4:[[28,25],[72,25],[28,75],[72,75]], 5:[[28,22],[72,22],[50,50],[28,78],[72,78]],
  6:[[28,20],[72,20],[28,50],[72,50],[28,80],[72,80]],
  7:[[28,18],[72,18],[50,35],[28,52],[72,52],[28,82],[72,82]],
  8:[[28,17],[72,17],[50,32],[28,48],[72,48],[50,64],[28,83],[72,83]],
  9:[[28,16],[72,16],[28,36],[72,36],[50,50],[28,64],[72,64],[28,84],[72,84]],
  10:[[28,13],[72,13],[50,27],[28,37],[72,37],[28,63],[72,63],[50,73],[28,87],[72,87]],
};

function CardFace({ card, selected, onClick, draggable, onDragStart, onDrop, compact = false }) {
  const suit = SUIT_SYMBOLS[card.suit] || "★";
  const face = ["J","Q","K"].includes(card.rank);
  const joker = card.rank === "JOKER";
  return (
    <motion.button
      type="button"
      className={`real-card ${card.color === "red" ? "red" : "black"} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      whileTap={{ scale: 0.98 }}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <span className="card-corner top"><b>{joker ? "JK" : card.rank}</b><i>{suit}</i></span>
      {joker ? <div className="joker-art"><span>★</span><b>JOKER</b></div>
        : face ? <div className="court-art"><span>{suit}</span><b>{card.rank}</b><span>{suit}</span></div>
        : <div className="pip-field">{(PIPS[card.rank] || [[50,50]]).map(([x,y], index)=><span key={index} style={{left:`${x}%`,top:`${y}%`}}>{suit}</span>)}</div>}
      <span className="card-corner bottom"><b>{joker ? "JK" : card.rank}</b><i>{suit}</i></span>
    </motion.button>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("home");
  const [nickname, setNickname] = useState(localStorage.getItem("canastaNickname") || "Jeff");
  const [avatar, setAvatar] = useState(localStorage.getItem("canastaAvatar") || "🦊");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [privateHand, setPrivateHand] = useState([]);
  const [selected, setSelected] = useState([]);
  const [handOrder, setHandOrder] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState({ ...DEFAULT_RULES, cardBack: "midnight" });
  const [meetLink, setMeetLink] = useState("");
  const robotTimer = useRef(null);
  const robotTurnKey = useRef("");

  useEffect(() => { if (firebaseReady) ensureAnonymousAuth().then(setUser).catch((e)=>setError(e.message)); }, []);
  useEffect(() => roomCode ? watchRoom(roomCode, (value)=>{ setRoom(value); if (!value) { setScreen("home"); setRoomCode(""); } }) : undefined, [roomCode]);
  useEffect(() => roomCode && user ? watchPrivateHand(roomCode, user.uid, setPrivateHand) : undefined, [roomCode,user]);
  useEffect(() => {
    setHandOrder((current) => {
      const available = new Set(privateHand.map((card)=>card.id));
      const retained = current.filter((id)=>available.has(id));
      const missing = sortHand(privateHand).map((card)=>card.id).filter((id)=>!retained.includes(id));
      return [...retained,...missing];
    });
    setSelected((current)=>current.filter((id)=>privateHand.some((card)=>card.id===id)));
  }, [privateHand]);

  const members = useMemo(()=>Object.values(room?.members||{}).sort((a,b)=>a.seat-b.seat),[room]);
  const teamCount = Number(room?.rules?.teamCount || rules.teamCount || 2);
  const teams = useMemo(()=>Array.from({length:teamCount},(_,team)=>members.filter((member)=>member.team===team)),[members,teamCount]);
  const me = room?.members?.[user?.uid];
  const active = members[Number(room?.publicState?.currentPlayerIndex||0)];
  const isMyTurn = active?.uid === user?.uid;
  const turnPhase = room?.publicState?.turnPhase || "draw";
  const orderedHand = handOrder.map((id)=>privateHand.find((card)=>card.id===id)).filter(Boolean);
  const selectedCards = orderedHand.filter((card)=>selected.includes(card.id));
  const selectedPoints = selectedCards.reduce((sum,card)=>sum+cardPoints(card),0);
  const openingNeed = openingRequirement(Number(room?.publicState?.teamScores?.[me?.team]||0));
  const teamOpened = Boolean(room?.publicState?.opened?.[me?.team]);
  const messages = useMemo(()=>Object.entries(room?.messages||{}).map(([id,value])=>({id,...value})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)),[room]);

  useEffect(() => {
    if (!room || !user || room.hostUid!==user.uid || room.publicState?.phase!=="dealing") return;
    const order=room.publicState.dealOrder||[]; const index=room.publicState.dealAnimationIndex||0;
    if(index>=order.length){advanceDealAnimation(roomCode,user.uid,order.length,true);return;}
    const timer=setTimeout(()=>advanceDealAnimation(roomCode,user.uid,index+1,index+1>=order.length),45);
    return()=>clearTimeout(timer);
  },[room?.publicState?.phase,room?.publicState?.dealAnimationIndex,roomCode,user]);

  useEffect(() => {
    if (!room || !user || room.hostUid!==user.uid || room.status!=="playing" || room.publicState?.phase!=="playing") return;
    const current=members[Number(room.publicState.currentPlayerIndex||0)];
    if(!current?.isRobot){robotTurnKey.current="";return;}
    const key=`${room.handNumber}-${room.publicState.currentPlayerIndex}-${current.uid}-${room.publicState.lastAction}`;
    if(robotTurnKey.current===key)return; robotTurnKey.current=key;
    clearTimeout(robotTimer.current);
    robotTimer.current=setTimeout(()=>runRobotTurn(roomCode,user.uid).catch((e)=>{setError(e.message);robotTurnKey.current="";}),900);
    return()=>clearTimeout(robotTimer.current);
  },[room?.status,room?.publicState?.phase,room?.publicState?.currentPlayerIndex,room?.publicState?.lastAction,members,roomCode,user,room?.handNumber]);

  async function createGame(){setBusy(true);setError("");try{localStorage.setItem("canastaNickname",nickname);localStorage.setItem("canastaAvatar",avatar);const code=await createRoom({user,nickname,avatar,rules,meetLink});setRoomCode(code);setScreen("lobby");}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function joinGame(){setBusy(true);setError("");try{const code=await joinRoom({code:joinCode,user,nickname,avatar});setRoomCode(code);setScreen("lobby");}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function act(action){setBusy(true);setError("");try{await action();setSelected([]);}catch(e){setError(e.message);}finally{setBusy(false);}}
  function toggleCard(id){if(!isMyTurn||turnPhase!=="play")return;setSelected((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);}
  function moveCard(sourceId,targetId){setHandOrder((current)=>{const next=[...current];const from=next.indexOf(sourceId),to=next.indexOf(targetId);if(from<0||to<0)return current;next.splice(from,1);next.splice(to,0,sourceId);return next;});}
  async function submitMessage(){if(!message.trim()||!me)return;const text=message;setMessage("");await sendMessage(roomCode,me,text);}

  if(!firebaseReady)return <main className="setup-page"><section className="config-card"><WifiOff size={42}/><h1>Connect Firebase</h1><p>Missing: {firebaseMissing.join(", ")}</p></section></main>;
  if(screen==="home")return <main className="landing"><section className="hero"><div className="brand"><span>FC</span><b>Family Canasta</b></div><p className="eyebrow">PLAY TOGETHER, ANYWHERE</p><h1>Partners at the table. People or robots.</h1><p className="lede">Choose two or three teams of two. Every hand, meld, red three, and turn stays synchronized.</p><div className="trust"><Wifi size={16}/> Firebase connected</div></section><section className="entry-panel"><label>Nickname</label><input value={nickname} onChange={(e)=>setNickname(e.target.value)}/><label>Avatar</label><div className="avatars">{AVATARS.map((item)=><button className={avatar===item?"chosen":""} onClick={()=>setAvatar(item)} key={item}>{item}</button>)}</div><details open><summary><Settings size={16}/> Game setup</summary><div className="settings-grid"><label>Teams<select value={rules.teamCount} onChange={(e)=>setRules({...rules,teamCount:Number(e.target.value),deckCount:Number(e.target.value)===3?3:rules.deckCount})}><option value={2}>2 teams · 4 players</option><option value={3}>3 teams · 6 players</option></select></label><label>Decks<select value={rules.deckCount} onChange={(e)=>setRules({...rules,deckCount:Number(e.target.value)})}><option value={2} disabled={rules.teamCount===3}>2 decks</option><option value={3}>3 decks</option></select></label><label>Starting cards<select value={rules.cardsPerPlayer} onChange={(e)=>setRules({...rules,cardsPerPlayer:Number(e.target.value)})}><option value={11}>11</option><option value={13}>13</option><option value={15}>15</option></select></label><label>Card back<select value={rules.cardBack} onChange={(e)=>setRules({...rules,cardBack:e.target.value})}>{BACKS.map((back)=><option key={back}>{back}</option>)}</select></label><label className="wide-setting">Meet link<input value={meetLink} onChange={(e)=>setMeetLink(e.target.value)} placeholder="abc-defg-hij"/></label></div></details><button className="primary" disabled={!user||busy} onClick={createGame}><Plus/> Create a team game</button><div className="divider"><span/>or join<span/></div><div className="join-row"><input maxLength={6} value={joinCode} onChange={(e)=>setJoinCode(e.target.value.toUpperCase())} placeholder="ROOM CODE"/><button onClick={joinGame}>Join</button></div>{error&&<p className="error">{error}</p>}</section></main>;
  if(!room)return <main className="loading">Joining table…</main>;

  if(room.status==="lobby"){
    const required=teamCount*2; const ready=members.length===required&&teams.every((team)=>team.length===2)&&Array.from({length:teamCount},(_,team)=>room.teamBoardKeepers?.[team]).every(Boolean);
    return <main className="lobby-page"><header><div className="brand"><span>FC</span><b>Family Canasta</b></div><div className="code"><small>ROOM</small><b>{roomCode}</b><button onClick={()=>navigator.clipboard.writeText(roomCode)}><Copy size={16}/></button></div></header><section className="team-lobby"><div className="lobby-title"><p className="eyebrow">TWO-PERSON TEAMS</p><h1>Choose the partnerships</h1><p>{teamCount} teams, two seats each. Add robots to any empty seat.</p></div><div className={`team-columns teams-${teamCount}`}>{Array.from({length:teamCount},(_,team)=><section className="team-card" key={team}><div className="team-card-head"><div><small>TEAM</small><h2>{TEAM_NAMES[team]}</h2></div><span>{teams[team].length}/2</span></div><div className="team-members">{teams[team].map((member)=><article key={member.uid}><span className="avatar">{member.avatar}</span><div><b>{member.nickname}</b><small>{member.isRobot?"Autonomous robot":member.connected?"Connected":"Reconnecting"}</small></div>{member.isHost&&<Crown size={16}/>} {member.isRobot&&<Bot size={16}/>} {member.uid===user.uid&&<select value={member.team} onChange={(e)=>updateMember(roomCode,user.uid,{team:Number(e.target.value)}).catch((e)=>setError(e.message))}>{Array.from({length:teamCount},(_,option)=><option value={option} key={option}>{TEAM_NAMES[option]}</option>)}</select>}{room.hostUid===user.uid&&member.isRobot&&<button className="icon-button" onClick={()=>removeRobot(roomCode,user.uid,member.uid)}><Trash2 size={15}/></button>}</article>)}{teams[team].length<2&&room.hostUid===user.uid&&<button className="add-robot" onClick={()=>addRobot(roomCode,user.uid,team,"standard").catch((e)=>setError(e.message))}><Bot size={18}/> Add robot</button>}</div><label className="board-keeper"><LayoutPanelTop size={17}/><span>Board keeper</span><select value={room.teamBoardKeepers?.[team]||""} onChange={(e)=>setTeamBoardKeeper(roomCode,user.uid,team,e.target.value)} disabled={room.hostUid!==user.uid}><option value="">Choose player</option>{teams[team].map((member)=><option key={member.uid} value={member.uid}>{member.nickname}</option>)}</select></label></section>)}</div><aside className="lobby-actions"><div className="summary"><h3>Game setup</h3><p><span>Format</span><b>{teamCount} teams of 2</b></p><p><span>Seats</span><b>{members.length}/{required}</b></p><p><span>Decks</span><b>{room.rules.deckCount}</b></p></div>{room.meetLink&&<a className="meet" href={room.meetLink.startsWith("http")?room.meetLink:`https://meet.google.com/${room.meetLink}`} target="_blank" rel="noreferrer"><Video size={17}/> Google Meet</a>}{room.hostUid===user.uid?<button className="primary" disabled={!ready} onClick={()=>startOnlineGame(roomCode,user.uid).catch((e)=>setError(e.message))}><Play/> Start game</button>:<p className="waiting">Waiting for host…</p>}{error&&<p className="error">{error}</p>}</aside></section></main>;
  }

  const dealer=members[room.dealerIndex]; const visibleDealCount=room.publicState?.dealAnimationIndex||0;
  const selectedNaturals=[...new Set(selectedCards.filter((card)=>!isWild(card)).map((card)=>card.rank))];
  const selectionLegal=selectedCards.length>=3&&selectedNaturals.length===1&&!selectedCards.some((card)=>card.rank==="3")&&selectedCards.filter(isWild).length<selectedCards.filter((card)=>!isWild(card)).length;
  const requirementMet=teamOpened||selectedPoints>=openingNeed;
  return <main className="game-page"><header><div className="brand"><span>FC</span><b>Family Canasta</b></div><div className={`turn ${isMyTurn?"your-turn":""}`}>{room.publicState?.phase==="dealing"?"Dealing cards…":isMyTurn?`YOUR TURN — ${turnPhase==="draw"?"DRAW A CARD":"MELD OR DISCARD"}`:`${active?.nickname||"Player"}'s turn`}</div><div className="code"><small>ROOM</small><b>{roomCode}</b></div></header><section className="table"><div className="opponents">{members.filter((member)=>member.uid!==user.uid).map((member)=><article className={active?.uid===member.uid?"active-player":""} key={member.uid}><span>{member.avatar}</span><b>{member.nickname}{member.isRobot?" 🤖":""}</b><small>{room.publicState?.handCounts?.[member.uid]||0} cards · {TEAM_NAMES[member.team]}</small>{dealer?.uid===member.uid&&<em><Crown size={12}/> Dealer</em>}</article>)}</div><div className="shared-boards">{Array.from({length:teamCount},(_,team)=><section key={team} className={`shared-board team-${team}`}><div><LayoutPanelTop size={16}/><b>Team {TEAM_NAMES[team]} board</b><small>{(room.publicState?.redThrees&&Object.entries(room.publicState.redThrees).filter(([uid])=>room.members?.[uid]?.team===team).reduce((sum,[,cards])=>sum+(cards?.length||0),0))||0} red threes</small></div><div className="meld-slots">{(room.publicState?.teamBoards?.[team]||[]).length===0?<span>No melds yet</span>:(room.publicState.teamBoards[team]||[]).map((meld,index)=><div className="board-meld" key={`${meld.rank}-${index}`}><b>{meld.rank}</b><div>{(meld.cards||[]).slice(0,8).map((card)=><CardFace card={card} compact key={card.id}/>)}</div><small>{meld.cards?.length||0} cards {meld.cards?.length>=7?"· CANASTA":""}</small></div>)}</div></section>)}</div><div className="center"><button className="pile-action" disabled={!isMyTurn||turnPhase!=="draw"||busy} onClick={()=>act(()=>drawFromStock(roomCode,user.uid))}><div className="pile back-card"><span>{room.publicState?.stockCount||0}</span></div><b>Draw from stock</b></button><div className="dealer-orb"><Shuffle/><small>DEALER</small><b>{dealer?.nickname}</b><span>{room.publicState?.lastAction}</span></div><button className="pile-action" disabled={!isMyTurn||turnPhase!=="draw"||busy||!(room.publicState?.discardPile?.length)} onClick={()=>act(()=>takeDiscardPile(roomCode,user.uid))}><div className="pile discard-face">{room.publicState?.discardPile?.at(-1)&&<CardFace card={room.publicState.discardPile.at(-1)} compact/>}</div><b>Take discard pile</b></button></div><div className={`hand ${isMyTurn?"active-hand":""}`}><div className="identity"><span>{me?.avatar}</span><b>{me?.nickname}</b><small>Team {TEAM_NAMES[me?.team||0]}</small>{isMyTurn&&<strong>YOUR TURN</strong>}</div><div className="selection-advisor"><div><b>{selectedCards.length} selected · {selectedPoints} points</b><span>{turnPhase==="draw"?"Draw from the stock or take the pile first.":!selectedCards.length?"Select matching ranks. Twos and Jokers are wild.":selectionLegal?(requirementMet?"Legal meld. Play it or choose one card to discard.":`Need ${openingNeed} opening points; selected total is ${selectedPoints}.`):"Natural cards must share one rank, with fewer wilds than naturals."}</span></div><button disabled={!isMyTurn||turnPhase!=="play"||!selectionLegal||!requirementMet||busy} onClick={()=>act(()=>meldSelectedCards(roomCode,user.uid,selected))}><Hand size={16}/> Meld selected</button><button className="discard-button" disabled={!isMyTurn||turnPhase!=="play"||selected.length!==1||busy||isRedThree(selectedCards[0])} onClick={()=>act(()=>discardSelectedCard(roomCode,user.uid,selected[0]))}>Discard selected</button></div><div className="cards"><AnimatePresence>{orderedHand.map((card,index)=>{const wasDealt=room.publicState?.phase!=="dealing"||visibleDealCount>index*members.length;return wasDealt?<motion.div className="hand-card-wrap" key={card.id} initial={{y:-320,opacity:0}} animate={{y:0,opacity:1}}><CardFace card={card} selected={selected.includes(card.id)} onClick={()=>toggleCard(card.id)} draggable onDragStart={(event)=>event.dataTransfer.setData("text/card-id",card.id)} onDrop={(event)=>moveCard(event.dataTransfer.getData("text/card-id"),card.id)}/></motion.div>:null;})}</AnimatePresence></div></div></section><aside className="chat"><h3><MessageCircle size={17}/> Table chat</h3><div className="messages">{messages.map((item)=><article key={item.id}><span>{item.avatar}</span><div><b>{item.nickname}</b><p>{item.text}</p></div></article>)}</div><div className="compose"><input value={message} onChange={(e)=>setMessage(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&submitMessage()} placeholder="Message the table"/><button onClick={submitMessage}><Send size={17}/></button></div></aside>{error&&<div className="game-error" onClick={()=>setError("")}>{error}</div>}</main>;
}

export default App;
