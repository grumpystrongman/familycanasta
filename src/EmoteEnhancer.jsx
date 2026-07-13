import React, { useEffect, useMemo, useState } from "react";
import { onValue, push, ref, serverTimestamp, set } from "firebase/database";
import { auth, db, firebaseReady } from "./firebase";

const EMOTES = [
  { id: "dirty-bird", label: "Dirty Bird", icon: "🐦", caption: "Dirty Bird!" },
  { id: "impressive", label: "Impressive", icon: "👏", caption: "Impressive!" },
  { id: "dang", label: "Dang", icon: "😮", caption: "Dang!" },
  { id: "good-play", label: "Good Play", icon: "🎯", caption: "Good play!" },
  { id: "table-flip", label: "Grandma Evelyn's Table Flip", icon: "👵", caption: "Evelyn's Table Flip!" },
];

const EMOTE_PREFIX = "[[EMOTE:";
const EMOTE_SUFFIX = "]]";
const ACTIVE_LIFETIME_MS = 6500;

function findRoomCode() {
  const code = document.querySelector(".game-page .code b")?.textContent?.trim();
  return code && /^[A-Z0-9]{6}$/.test(code) ? code : "";
}

function createNonce() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(36)).join("-");
}

function enhanceChatMessages() {
  document.querySelectorAll(".score-chat-sidebar .messages article p").forEach((node) => {
    const match = node.textContent?.match(/^\[\[EMOTE:([a-z-]+)\]\]$/);
    if (!match || node.dataset.emoteEnhanced === "true") return;
    const emote = EMOTES.find((item) => item.id === match[1]);
    if (!emote) return;

    const icon = document.createElement("span");
    icon.className = "chat-emote-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = emote.icon;

    const caption = document.createElement("strong");
    caption.textContent = emote.caption;

    node.dataset.emoteEnhanced = "true";
    node.classList.add("chat-emote-message", `emote-${emote.id}`);
    node.replaceChildren(icon, caption);
  });
}

function EmoteArtwork({ emoteId, compact = false }) {
  if (emoteId === "dirty-bird") {
    return <span className={`emote-art dirty-bird ${compact ? "compact" : ""}`}><i>♪</i><b>🐦</b><i>♫</i></span>;
  }
  if (emoteId === "impressive") {
    return <span className={`emote-art impressive ${compact ? "compact" : ""}`}><i>✨</i><b>👏</b><i>✨</i></span>;
  }
  if (emoteId === "dang") {
    return <span className={`emote-art dang ${compact ? "compact" : ""}`}><b>😮</b><i>💧</i></span>;
  }
  if (emoteId === "good-play") {
    return <span className={`emote-art good-play ${compact ? "compact" : ""}`}><b>👉</b><i>GOOD PLAY!</i><em>✨</em></span>;
  }
  return (
    <span className={`emote-art table-flip ${compact ? "compact" : ""}`}>
      <b className="evelyn">👵</b>
      <i className="flip-table">🃏</i>
      <em className="flying-dishes">☕ 🍽️ 🥄</em>
      <strong>WHAM!</strong>
    </span>
  );
}

function EmoteButton({ emote, onSend, compact = false }) {
  return (
    <button
      type="button"
      className={`canasta-emote-button ${emote.id === "table-flip" ? "legendary" : ""}`}
      onClick={() => onSend(emote)}
      title={emote.label}
      aria-label={`Send ${emote.label} emote`}
    >
      <EmoteArtwork emoteId={emote.id} compact={compact} />
      {!compact && <span>{emote.id === "table-flip" ? "Evelyn Flip" : emote.label}</span>}
    </button>
  );
}

export default function EmoteEnhancer() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [activeEmote, setActiveEmote] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setRoomCode(findRoomCode());
      setChatOpen(Boolean(document.querySelector(".score-chat-sidebar .sidebar-tabs button.active:nth-child(2)")));
      enhanceChatMessages();
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    const timer = window.setInterval(refresh, 1000);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!firebaseReady || !roomCode) {
      setRoom(null);
      setActiveEmote(null);
      return undefined;
    }
    const unsubscribeRoom = onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
    const unsubscribeEmote = onValue(ref(db, `rooms/${roomCode}/activeEmote`), (snapshot) => {
      const value = snapshot.val();
      if (!value || Date.now() - Number(value.createdAt || 0) > ACTIVE_LIFETIME_MS) {
        setActiveEmote(null);
        return;
      }
      setActiveEmote(value);
      window.setTimeout(() => setActiveEmote((current) => current?.nonce === value.nonce ? null : current), 3600);
    });
    return () => {
      unsubscribeRoom();
      unsubscribeEmote();
    };
  }, [roomCode]);

  const me = useMemo(() => room?.members?.[auth?.currentUser?.uid] || null, [room]);

  async function sendEmote(emote) {
    if (!roomCode || !me) return;
    const payload = {
      id: emote.id,
      uid: me.uid,
      nickname: me.nickname,
      avatar: me.avatar,
      nonce: createNonce(),
      createdAt: Date.now(),
    };
    await Promise.all([
      set(ref(db, `rooms/${roomCode}/activeEmote`), payload),
      set(push(ref(db, `rooms/${roomCode}/messages`)), {
        uid: me.uid,
        nickname: me.nickname,
        avatar: me.avatar,
        text: `${EMOTE_PREFIX}${emote.id}${EMOTE_SUFFIX}`,
        createdAt: serverTimestamp(),
      }),
    ]);
  }

  if (!roomCode || !me) return null;

  const activeDefinition = activeEmote && EMOTES.find((item) => item.id === activeEmote.id);

  return (
    <>
      {activeDefinition && (
        <div className={`canasta-emote-stage emote-${activeDefinition.id}`} key={activeEmote.nonce} role="status" aria-live="polite">
          <div className="emote-sender">{activeEmote.avatar} {activeEmote.nickname}</div>
          <EmoteArtwork emoteId={activeDefinition.id} />
          <div className="emote-caption">{activeDefinition.caption}</div>
        </div>
      )}

      <section className={`canasta-emote-dock ${collapsed ? "collapsed" : ""}`} aria-label="Table emotes">
        <button className="emote-dock-toggle" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Open emotes" : "Collapse emotes"}>
          {collapsed ? "🙂" : "×"}
        </button>
        {!collapsed && EMOTES.map((emote) => <EmoteButton key={emote.id} emote={emote} onSend={sendEmote} />)}
      </section>

      {chatOpen && (
        <section className="canasta-chat-emotes" aria-label="Chat emotes">
          <span>Send an emote</span>
          <div>{EMOTES.map((emote) => <EmoteButton key={emote.id} emote={emote} onSend={sendEmote} compact />)}</div>
        </section>
      )}
    </>
  );
}
