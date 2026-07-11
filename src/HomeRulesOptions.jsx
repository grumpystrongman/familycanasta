import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref, update } from "firebase/database";
import { auth, db } from "./firebase";

const STORAGE_KEY = "canastaUnprotectedRedThreesPenalty";

export default function HomeRulesOptions() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [settingsTarget, setSettingsTarget] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);

  useEffect(() => {
    const locate = () => {
      setSettingsTarget(document.querySelector(".settings-grid"));
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!uid || !roomCode || !room || room.hostUid !== uid || room.status !== "lobby") return;
    if (Boolean(room.rules?.unprotectedRedThreesPenalty) === enabled) return;
    update(ref(db, `rooms/${roomCode}/rules`), {
      unprotectedRedThreesPenalty: enabled,
      unprotectedRedThreePenalty: 200,
      freezeOnBlackThree: false,
    }).catch(() => {});
  }, [enabled, roomCode, room]);

  if (!settingsTarget) return null;

  return createPortal(
    <label className="home-rule-toggle wide-setting">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => setEnabled(event.target.checked)}
      />
      <span>
        <b>Unprotected red threes count against you</b>
        <small>When selected, a team with red threes but no clean or dirty canasta scores −200 per red three at the end of the hand.</small>
      </span>
    </label>,
    settingsTarget,
  );
}
