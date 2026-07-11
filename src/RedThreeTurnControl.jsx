import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref } from "firebase/database";
import { auth, db } from "./firebase";
import { layDownRedThrees } from "./game/redThreeActions";
import { isRedThree } from "./game/engine";

export default function RedThreeTurnControl() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [hand, setHand] = useState([]);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const scan = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
      setTarget(document.querySelector(".selection-advisor"));
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!roomCode || !uid || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}/privateHands/${uid}`), (snapshot) => setHand(snapshot.val() || []));
  }, [roomCode]);

  const redThrees = useMemo(() => hand.filter(isRedThree), [hand]);
  const uid = auth?.currentUser?.uid;
  const players = Object.values(room?.members || {}).sort((a, b) => a.seat - b.seat);
  const active = players[Number(room?.publicState?.currentPlayerIndex || 0)];
  const isMyTurn = Boolean(uid && active?.uid === uid && room?.publicState?.phase === "playing");

  async function playRedThrees() {
    setBusy(true);
    setError("");
    try {
      await layDownRedThrees(roomCode, uid);
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  if (!target || !redThrees.length) return null;

  return createPortal(
    <div className={`red-three-turn-control ${isMyTurn ? "ready" : "waiting"}`}>
      <div>
        <b>{redThrees.length} red three{redThrees.length === 1 ? "" : "s"} in your hand</b>
        <span>{isMyTurn ? "Lay them down now and draw one replacement for each red three." : "Red threes can only be laid down on your turn."}</span>
      </div>
      <button type="button" disabled={!isMyTurn || busy} onClick={playRedThrees}>
        {busy ? "Drawing replacements…" : `Lay down ${redThrees.length} red three${redThrees.length === 1 ? "" : "s"}`}
      </button>
      {error && <em>{error}</em>}
    </div>,
    target,
  );
}
