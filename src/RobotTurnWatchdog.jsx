import React, { useEffect } from "react";
import { onValue, ref, runTransaction } from "firebase/database";
import { auth, db, firebaseReady } from "./firebase";
import { executeRobotTurn } from "./game/botEngine";

const ROBOT_POLL_MS = 1400;

function currentRoomCode() {
  const value = document.querySelector(".game-page .code b")?.textContent?.trim() || "";
  return /^[A-Z0-9]{6}$/.test(value) ? value : "";
}

function activePlayer(room) {
  const players = Object.values(room?.members || {}).sort((left, right) => left.seat - right.seat);
  return players[Number(room?.publicState?.currentPlayerIndex || 0)] || null;
}

export default function RobotTurnWatchdog() {
  useEffect(() => {
    if (!firebaseReady || !db) return undefined;

    let roomCode = "";
    let latestRoom = null;
    let unsubscribeRoom = null;
    let transactionRunning = false;

    const attachRoom = () => {
      const nextCode = currentRoomCode();
      if (!nextCode || nextCode === roomCode) return;
      unsubscribeRoom?.();
      roomCode = nextCode;
      unsubscribeRoom = onValue(ref(db, `rooms/${roomCode}`), (snapshot) => {
        latestRoom = snapshot.val();
      });
    };

    const runRobotIfNeeded = async () => {
      attachRoom();
      const uid = auth?.currentUser?.uid;
      const member = latestRoom?.members?.[uid];
      if (!roomCode || !uid || !member || member.isRobot || transactionRunning) return;
      if (latestRoom?.status !== "playing" || latestRoom?.publicState?.phase !== "playing") return;
      if (!activePlayer(latestRoom)?.isRobot) return;

      transactionRunning = true;
      try {
        await runTransaction(ref(db, `rooms/${roomCode}`), (room) => {
          if (!room || room.status !== "playing" || room.publicState?.phase !== "playing") return room;
          const caller = room.members?.[uid];
          if (!caller || caller.isRobot) return room;
          if (!activePlayer(room)?.isRobot) return room;
          return executeRobotTurn(room);
        }, { applyLocally: false });
      } catch (error) {
        console.error("Robot turn watchdog could not complete the turn.", error);
      } finally {
        transactionRunning = false;
      }
    };

    attachRoom();
    const interval = window.setInterval(runRobotIfNeeded, ROBOT_POLL_MS);
    void runRobotIfNeeded();

    return () => {
      window.clearInterval(interval);
      unsubscribeRoom?.();
    };
  }, []);

  return null;
}
