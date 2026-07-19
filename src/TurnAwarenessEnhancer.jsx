import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { auth, db, firebaseReady } from "./firebase";

export const TURN_REMINDER_SECONDS = 60;
export const TURN_OVERLAY_MS = 5000;

export function remainingTurnSeconds(startedAt, now = Date.now()) {
  if (!Number.isFinite(Number(startedAt))) return TURN_REMINDER_SECONDS;
  const elapsed = Math.max(0, Number(now) - Number(startedAt));
  return Math.max(0, Math.ceil((TURN_REMINDER_SECONDS * 1000 - elapsed) / 1000));
}

export function formatTurnTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function findRoomCode() {
  const code = document.querySelector(".game-page .code b")?.textContent?.trim();
  return code && /^[A-Z0-9]{6}$/.test(code) ? code : "";
}

function orderedPlayers(room) {
  return Object.values(room?.members || {}).sort((left, right) => left.seat - right.seat);
}

export default function TurnAwarenessEnhancer() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [turnStartedAt, setTurnStartedAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(TURN_REMINDER_SECONDS);
  const previousTurnRef = useRef("");

  useEffect(() => {
    const locate = () => setRoomCode(findRoomCode());
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!firebaseReady || !roomCode) {
      setRoom(null);
      return undefined;
    }
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  const players = useMemo(() => orderedPlayers(room), [room]);
  const currentPlayerIndex = Number(room?.publicState?.currentPlayerIndex || 0);
  const activePlayer = players[currentPlayerIndex] || null;
  const me = room?.members?.[auth?.currentUser?.uid] || null;
  const playing = room?.status === "playing" && room?.publicState?.phase === "playing";
  const turnIdentity = `${room?.handNumber || room?.publicState?.handNumber || 0}:${currentPlayerIndex}`;
  const isMyTurn = Boolean(playing && me?.uid && activePlayer?.uid === me.uid);

  useEffect(() => {
    if (!playing || !activePlayer) {
      previousTurnRef.current = "";
      setShowOverlay(false);
      setTurnStartedAt(null);
      setSecondsLeft(TURN_REMINDER_SECONDS);
      return undefined;
    }

    if (previousTurnRef.current === turnIdentity) return undefined;
    previousTurnRef.current = turnIdentity;
    const startedAt = Date.now();
    setTurnStartedAt(startedAt);
    setSecondsLeft(TURN_REMINDER_SECONDS);

    if (!isMyTurn) {
      setShowOverlay(false);
      return undefined;
    }

    setShowOverlay(true);
    const dismiss = () => setShowOverlay(false);
    const timeout = window.setTimeout(dismiss, TURN_OVERLAY_MS);
    window.addEventListener("mousemove", dismiss, { once: true });

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("mousemove", dismiss);
    };
  }, [playing, turnIdentity, activePlayer?.uid, isMyTurn]);

  useEffect(() => {
    if (!playing || turnStartedAt === null) return undefined;
    const tick = () => setSecondsLeft(remainingTurnSeconds(turnStartedAt));
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [playing, turnStartedAt]);

  if (!playing || !activePlayer) return null;

  const urgent = secondsLeft <= 10;
  const expired = secondsLeft === 0;

  return (
    <>
      {showOverlay && isMyTurn && (
        <div className="your-turn-overlay" role="alert" aria-live="assertive">
          <div>
            <span>YOUR TURN</span>
            <strong>{me?.avatar || ""} {me?.nickname || "Player"}</strong>
            <small>Move your mouse to dismiss</small>
          </div>
        </div>
      )}

      <div
        className={`turn-reminder-timer ${urgent ? "urgent" : ""} ${expired ? "expired" : ""}`}
        role="timer"
        aria-live={urgent ? "assertive" : "polite"}
        aria-label={`${activePlayer.nickname}'s turn reminder: ${secondsLeft} seconds remaining`}
      >
        <span>{isMyTurn ? "YOUR TURN" : `${activePlayer.nickname}'S TURN`}</span>
        <strong>{formatTurnTime(secondsLeft)}</strong>
        <small>{expired ? "Please make a play" : "Reminder only"}</small>
      </div>
    </>
  );
}
