import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref } from "firebase/database";
import { auth, db } from "./firebase";

export default function SafeDiscardRule() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [button, setButton] = useState(null);

  useEffect(() => {
    const locate = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
      setButton(document.querySelector(".center .pile-action:last-child"));
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  const safeRank = useMemo(() => {
    const uid = auth?.currentUser?.uid;
    if (!uid || !room) return "";
    const pile = room.publicState?.discardPile || [];
    const top = pile[pile.length - 1];
    const team = room.members?.[uid]?.team;
    if (!top || team === undefined || team === null) return "";
    const meld = (room.publicState?.teamBoards?.[team] || []).find((item) => item.rank === top.rank);
    return (meld?.cards?.length || 0) >= 7 ? top.rank : "";
  }, [room]);

  useEffect(() => {
    if (!button) return undefined;
    const blockSafePickup = (event) => {
      if (!safeRank) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent("canasta-rule-message", {
        detail: `${safeRank}s are already a completed book on your board. This is a safe discard and the pile cannot be picked up.`
      }));
    };
    button.addEventListener("click", blockSafePickup, true);
    if (safeRank) {
      button.setAttribute("aria-disabled", "true");
      button.title = `${safeRank}s are a safe discard because your team already has a completed book.`;
    }
    return () => {
      button.removeEventListener("click", blockSafePickup, true);
      button.removeAttribute("aria-disabled");
      button.removeAttribute("title");
    };
  }, [button, safeRank]);

  return button && safeRank ? createPortal(
    <span className="safe-discard-badge">🔒 SAFE DISCARD — your {safeRank} book blocks pickup</span>,
    button
  ) : null;
}
