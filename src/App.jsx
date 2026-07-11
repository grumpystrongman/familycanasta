import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Crown, MessageCircle, Play, Plus, Send, Settings,
  Shuffle, Video, Wifi, WifiOff
} from "lucide-react";
import { ensureAnonymousAuth, firebaseMissing, firebaseReady } from "./firebase";
import {
  advanceDealAnimation,
  createRoom,
  joinRoom,
  sendMessage,
  startOnlineGame,
  updateMember,
  watchPrivateHand,
  watchRoom,
} from "./services/roomService";
import { DEFAULT_RULES } from "./game/engine";

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
  const [rules, setRules] = useState({ ...DEFAULT_RULES, cardBack: "midnight" });
  const [meetLink, setMeetLink] = useState("");

  useEffect(() => {
    if (!firebaseReady) return;
    ensureAnonymousAuth().then(setUser).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    const stopRoom = watchRoom(roomCode, (value) => {
      setRoom(value);
      if (!value) {
        setScreen("home");
        setRoomCode("");
      }
    });
    return stopRoom;
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

  async function createGame() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      localStorage.setItem("canastaNickname", nickname);
      localStorage.setItem("canastaAvatar", avatar);
      const code = await createRoom({ user, nickname, avatar, rules, meetLink });
      setRoomCode(code);
      setScreen("lobby");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinGame() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      localStorage.setItem("canastaNickname", nickname);
      localStorage.setItem("canastaAvatar", avatar);
      const code = await joinRoom({ code: joinCode, user, nickname, avatar });
      setRoomCode(code);
      setScreen("lobby");
    } catch (e) {
      setError(e.message);
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
    return (
      <main className="setup-page">
        <section className="config-card">
          <WifiOff size={42} />
          <p className="eyebrow">ONE-TIME SETUP</p>
          <h1>Connect your Firebase web app.</h1>
          <p>The project is already wired for <strong>family-canasta-ce7d2</strong>. Add the missing web-app values to a local <code>.env</code> file.</p>
          <div className="missing">{firebaseMissing.map((key) => <span key={key}>{key}</span>)}</div>
          <ol>
            <li>In Firebase, open Project settings → General.</li>
            <li>Under “Your apps,” add a Web app using the <strong>&lt;/&gt;</strong> button.</li>
            <li>Copy the Firebase configuration values into <code>.env</code>.</li>
            <li>Enable Authentication → Anonymous and create Realtime Database.</li>
          </ol>
        </section>
      </main>
    );
  }

  if (screen === "home") {
    return (
      <main className="landing">
        <section className="hero">
          <div className="brand"><span>FC</span><b>Family Canasta</b></div>
          <p className="eyebrow">PLAY TOGETHER, ANYWHERE</p>
          <h1>The family card table, online.</h1>
          <p className="lede">Create a private Canasta room, share the six-character code, and play from computers or phones.</p>
          <div className="trust"><Wifi size={16}/> Firebase connected</div>
        </section>

        <section className="entry-panel">
          <label>Nickname</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
          <label>Avatar</label>
          <div className="avatars">{AVATARS.map((item) => <button className={avatar === item ? "chosen" : ""} onClick={() => setAvatar(item)} key={item}>{item}</button>)}</div>

          <details>
            <summary><Settings size={16}/> Game setup</summary>
            <div className="settings-grid">
              <label>Decks<select value={rules.deckCount} onChange={(e) => setRules({ ...rules, deckCount: Number(e.target.value) })}><option value={2}>2 decks</option><option value={3}>3 decks</option></select></label>
              <label>Starting cards<select value={rules.cardsPerPlayer} onChange={(e) => setRules({ ...rules, cardsPerPlayer: Number(e.target.value) })}><option value={11}>11</option><option value={13}>13</option><option value={15}>15</option></select></label>
              <label>Card back<select value={rules.cardBack} onChange={(e) => setRules({ ...rules, cardBack: e.target.value })}>{BACKS.map((b) => <option key={b}>{b}</option>)}</select></label>
              <label>Meet link<input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} placeholder="abc-defg-hij"/></label>
            </div>
          </details>

          <button className="primary" disabled={!user || busy} onClick={createGame}><Plus/> Create a room</button>
          <div className="divider"><span/>or join<span/></div>
          <div className="join-row"><input maxLength={6} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ROOM CODE"/><button disabled={!user || busy} onClick={joinGame}>Join</button></div>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (!room) return <main className="loading">Joining table…</main>;

  if (room.status === "lobby") {
    return (
      <main className="lobby-page">
        <header><div className="brand"><span>FC</span><b>Family Canasta</b></div><div className="code"><small>ROOM</small><b>{roomCode}</b><button onClick={() => navigator.clipboard.writeText(roomCode)}><Copy size={16}/></button></div></header>
        <section className="lobby-grid">
          <div>
            <p className="eyebrow">PRIVATE TABLE</p>
            <h1>Players at the table</h1>
            <div className="member-list">
              {members.map((member) => (
                <article key={member.uid}>
                  <span className="avatar">{member.avatar}</span>
                  <div><b>{member.nickname}</b><small>{member.connected ? "Connected" : "Reconnecting"} · Team {member.team === 0 ? "North" : "South"}</small></div>
                  {member.isHost && <Crown size={17}/>} 
                  {member.uid === user.uid && <select value={member.team} onChange={(e) => updateMember(roomCode, user.uid, { team: Number(e.target.value) })}><option value={0}>North</option><option value={1}>South</option></select>}
                </article>
              ))}
            </div>
          </div>
          <aside>
            <div className="summary">
              <h3>Table setup</h3>
              <p><span>Decks</span><b>{room.rules.deckCount}</b></p>
              <p><span>Starting hand</span><b>{room.rules.cardsPerPlayer}</b></p>
              <p><span>Target</span><b>{room.rules.targetScore.toLocaleString()}</b></p>
              <p><span>First dealer</span><b>Random</b></p>
            </div>
            {room.meetLink && <a className="meet" href={room.meetLink.startsWith("http") ? room.meetLink : `https://meet.google.com/${room.meetLink}`} target="_blank" rel="noreferrer"><Video size={17}/> Join Google Meet</a>}
            {room.hostUid === user.uid
              ? <button className="primary" onClick={() => startOnlineGame(roomCode, user.uid)} disabled={members.length < 2}><Play/> Choose dealer and deal</button>
              : <p className="waiting">Waiting for the host to begin…</p>}
          </aside>
        </section>
      </main>
    );
  }

  const dealer = members[room.dealerIndex];
  const active = members[room.publicState?.currentPlayerIndex || 0];
  const visibleDealCount = room.publicState?.dealAnimationIndex || 0;

  return (
    <main className="game-page">
      <header>
        <div className="brand"><span>FC</span><b>Family Canasta</b></div>
        <div className="turn">
          {room.publicState?.phase === "dealing"
            ? "Dealing cards…"
            : `${active?.nickname || "Player"}'s turn`}
        </div>
        <div className="code"><small>ROOM</small><b>{roomCode}</b></div>
      </header>

      <section className="table">
        <div className="opponents">
          {members.filter((m) => m.uid !== user.uid).map((member) => (
            <article key={member.uid}>
              <span>{member.avatar}</span>
              <b>{member.nickname}</b>
              <small>{room.publicState?.handCounts?.[member.uid] || 0} cards</small>
              {dealer?.uid === member.uid && <em><Crown size={12}/> Dealer</em>}
            </article>
          ))}
        </div>

        <div className="center">
          <div className="pile back-card"><span>{room.publicState?.stockCount || 0}</span></div>
          <div className="dealer-orb"><Shuffle/><small>DEALER</small><b>{dealer?.nickname}</b></div>
          <div className="pile discard-card"><b>{room.publicState?.discardPile?.at(-1)?.rank || "—"}</b><span>{room.publicState?.discardPile?.at(-1)?.suit || ""}</span></div>
        </div>

        <div className="hand">
          <div className="identity"><span>{me?.avatar}</span><b>{me?.nickname}</b>{dealer?.uid === user.uid && <em>Dealer</em>}</div>
          <div className="cards">
            <AnimatePresence>
              {privateHand.map((card, index) => {
                const wasDealt = room.publicState?.phase !== "dealing" || visibleDealCount > index * members.length;
                return wasDealt ? (
                  <motion.button
                    key={card.id}
                    initial={{ y: -320, x: 0, opacity: 0, rotate: 12 }}
                    animate={{ y: 0, x: 0, opacity: 1, rotate: (index - privateHand.length / 2) * 0.8 }}
                    transition={{ duration: 0.28, type: "spring" }}
                    className={card.color === "red" ? "playing-card red" : "playing-card"}
                  >
                    <b>{card.rank}</b><span>{card.suit}</span>
                  </motion.button>
                ) : null;
              })}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <aside className="chat">
        <h3><MessageCircle size={17}/> Table chat</h3>
        <div className="messages">{messages.map((m) => <article key={m.id}><span>{m.avatar}</span><div><b>{m.nickname}</b><p>{m.text}</p></div></article>)}</div>
        <div className="compose"><input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitMessage()} placeholder="Message the table"/><button onClick={submitMessage}><Send size={17}/></button></div>
      </aside>
    </main>
  );
}

export default App;
