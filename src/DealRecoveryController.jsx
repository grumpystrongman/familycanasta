import React, { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref, runTransaction } from "firebase/database";
import { auth, db, firebaseReady } from "./firebase";
import { buildRecoveredDealState } from "./game/dealRecovery";

const DEAL_STALL_TIMEOUT_MS = 2500;
const ROOM_WATCH_SYNC_MS = 500;

function savedRoomCode() {
  return (localStorage.getItem("canastaRoomCode") || "").trim().toUpperCase();
}

export default function DealRecoveryController() {
  useEffect(() => {
    if (!firebaseReady || !auth || !db) return undefined;

    let watchedKey = "";
    let unsubscribeRoom = null;
    let recoveryTimer = null;

    const clearRecoveryTimer = () => {
      if (recoveryTimer) window.clearTimeout(recoveryTimer);
      recoveryTimer = null;
    };

    const stopWatchingRoom = () => {
      clearRecoveryTimer();
      unsubscribeRoom?.();
      unsubscribeRoom = null;
    };

    const recoverRoom = async (code, uid) => {
      if (auth.currentUser?.uid !== uid || savedRoomCode() !== code) return;
      try {
        await runTransaction(
          ref(db, `rooms/${code}/publicState`),
          (current) => buildRecoveredDealState(current) || undefined,
          { applyLocally: false },
        );
      } catch (error) {
        console.error("Could not recover the stalled deal.", error);
      }
    };

    const scheduleRecovery = (room, code, uid) => {
      clearRecoveryTimer();
      const canRecover = room
        && room.status === "playing"
        && room.publicState?.phase === "dealing"
        && room.members?.[uid];
      if (!canRecover) return;

      recoveryTimer = window.setTimeout(
        () => recoverRoom(code, uid),
        DEAL_STALL_TIMEOUT_MS,
      );
    };

    const syncRoomWatch = () => {
      const uid = auth.currentUser?.uid || "";
      const code = savedRoomCode();
      const nextKey = uid && code ? `${uid}:${code}` : "";
      if (nextKey === watchedKey) return;

      stopWatchingRoom();
      watchedKey = nextKey;
      if (!uid || !code) return;

      unsubscribeRoom = onValue(
        ref(db, `rooms/${code}`),
        (snapshot) => scheduleRecovery(snapshot.val(), code, uid),
        (error) => {
          clearRecoveryTimer();
          console.error("Could not watch the room for deal recovery.", error);
        },
      );
    };

    const unsubscribeAuth = onAuthStateChanged(auth, syncRoomWatch);
    const syncTimer = window.setInterval(syncRoomWatch, ROOM_WATCH_SYNC_MS);
    syncRoomWatch();

    return () => {
      unsubscribeAuth();
      window.clearInterval(syncTimer);
      stopWatchingRoom();
    };
  }, []);

  return null;
}
