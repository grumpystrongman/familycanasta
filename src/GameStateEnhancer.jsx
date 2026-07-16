import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref } from "firebase/database";
import { auth, db } from "./firebase";
import { startOnlineGame } from "./services/roomService";
import { TEAM_NAMES } from "./game/engine";

export default function GameStateEnhancer() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [discardTarget, setDiscardTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const locate = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
      setDiscardTarget(document.querySelector(".center .pile-action:last-child"));
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  async function nextHand() {
    const uid = auth?.currentUser?.uid;
    if (!uid || !roomCode) return;
    setBusy(true);
    setError("");
    try {
      await startOnlineGame(roomCode, uid);
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  const frozen = room?.publicState?.discardFrozen !== false;
  const pickupRule = room?.rules?.discardPickupRule === "modern" ? "modern" : "classic";
  const discardMessage = frozen
    ? "❄ FROZEN — two natural matches required"
    : pickupRule === "modern"
      ? "✓ UNFROZEN — Modern American still requires two natural matches"
      : "✓ UNFROZEN — use a matching board meld; otherwise two matches or one match + wild";
  const indicator = discardTarget ? createPortal(
    <span className={`discard-state-badge ${frozen ? "frozen" : "open"}`}>
      {discardMessage}
    </span>,
    discardTarget,
  ) : null;

  const handOver = room?.publicState?.phase === "handOver";
  const breakdowns = room?.publicState?.roundBreakdowns || {};
  const roundEndReason = room?.publicState?.roundEndReason || "went-out";
  const wentOutName = room?.members?.[room?.publicState?.wentOutUid]?.nickname || "A player";
  const roundTitle = roundEndReason === "last-red-three"
    ? "Stock ended on a red three"
    : roundEndReason === "stock-exhausted"
      ? "Stock exhausted"
      : `${wentOutName} went out`;
  const roundDescription = roundEndReason === "last-red-three"
    ? "The final stock card was a red three with no replacement available. The hand ended immediately; no meld or discard was allowed."
    : roundEndReason === "stock-exhausted"
      ? "No legal continuation remained from the discard pile. Cards left in every hand were deducted, and no going-out bonus was awarded."
      : "The hand ended after the player completed the required canasta and played the last card. Remaining cards have been deducted.";
  const isHost = auth?.currentUser?.uid && room?.hostUid === auth.currentUser.uid;

  return (
    <>
      {indicator}
      {handOver && (
        <div className="round-complete-overlay">
          <section className="round-complete-card">
            <span className="round-kicker">ROUND COMPLETE</span>
            <h2>{roundTitle}</h2>
            <p>{roundDescription}</p>
            <div className="round-team-results">
              {Object.entries(breakdowns).map(([team, score]) => (
                <article key={team}>
                  <div><span>Team</span><b>{TEAM_NAMES[Number(team)] || `Team ${Number(team) + 1}`}</b></div>
                  <strong className={score.roundTotal < 0 ? "negative" : ""}>{score.roundTotal > 0 ? "+" : ""}{score.roundTotal}</strong>
                  <small>Cards {score.boardCardPoints} · Books {score.canastaBonus} · Red 3s {score.redThreePoints} · Out {score.goingOutPoints} · Hands −{score.handPenalty}</small>
                </article>
              ))}
            </div>
            {isHost ? <button disabled={busy} onClick={nextHand}>{busy ? "Dealing…" : "Deal next hand"}</button> : <p>Waiting for the host to deal the next hand.</p>}
            {error && <em>{error}</em>}
          </section>
        </div>
      )}
    </>
  );
}
