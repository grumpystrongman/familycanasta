import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref } from "firebase/database";
import { db } from "./firebase";
import { SUIT_SYMBOLS, TEAM_NAMES } from "./game/engine";

function RedThreeCard({ card }) {
  const suit = SUIT_SYMBOLS[card.suit] || "♦";
  return (
    <div className="red-three-card" aria-label={`3 ${suit}`}>
      <span className="red-three-corner top"><b>3</b><i>{suit}</i></span>
      <strong>{suit}</strong>
      <span className="red-three-corner bottom"><b>3</b><i>{suit}</i></span>
    </div>
  );
}

export default function RedThreeBoard() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [boardTargets, setBoardTargets] = useState([]);

  useEffect(() => {
    const scan = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
      setBoardTargets([...document.querySelectorAll(".shared-board")]);
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

  const redThreesByTeam = useMemo(() => {
    const result = {};
    for (const [uid, cards] of Object.entries(room?.publicState?.redThrees || {})) {
      const team = Number(room?.members?.[uid]?.team);
      if (!Number.isFinite(team)) continue;
      result[team] ||= [];
      result[team].push(...(cards || []).filter((card) => card.rank === "3" && (card.suit === "H" || card.suit === "D")));
    }
    return result;
  }, [room]);

  return (
    <>
      {boardTargets.map((target, team) => {
        const cards = redThreesByTeam[team] || [];
        if (!cards.length) return null;
        return createPortal(
          <section className="red-three-board-rack">
            <div className="red-three-board-title">
              <b>Red threes</b>
              <span>{cards.length} × 100 = {cards.length * 100} points</span>
            </div>
            <div className="red-three-board-cards">
              {cards.map((card, index) => <RedThreeCard key={`${card.id}-${index}`} card={card}/>) }
            </div>
            <small>These are bonus cards and do not count toward the opening meld.</small>
          </section>,
          target,
          `red-threes-${TEAM_NAMES[team] || team}`,
        );
      })}
    </>
  );
}
