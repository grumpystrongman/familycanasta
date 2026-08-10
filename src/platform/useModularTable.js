import { useEffect, useMemo, useRef, useState } from "react";
import { ensureAnonymousAuth, firebaseReady } from "../firebase";
import {
  addModularRobot,
  applyModularAction,
  createModularRoom,
  joinModularRoom,
  orderedMembers,
  startModularGame,
  watchModularRoom,
} from "./modularRoomService";

export default function useModularTable({
  gameId,
  maxPlayers,
  minimumPlayers,
  rules = {},
  createGameState,
  reduceGameState,
  chooseRobotMove,
  robotDelay = 700,
}) {
  const [user, setUser] = useState(null);
  const [nickname, setNickname] = useState(localStorage.getItem("familyCardNickname") || "Jeff");
  const [avatar, setAvatar] = useState(localStorage.getItem("familyCardAvatar") || "🦊");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const robotKey = useRef("");

  useEffect(() => {
    if (!firebaseReady) return;
    ensureAnonymousAuth().then(setUser).catch((event) => setError(event.message));
  }, []);

  useEffect(() => roomCode ? watchModularRoom(roomCode, setRoom) : undefined, [roomCode]);

  const members = useMemo(() => orderedMembers(room), [room]);

  useEffect(() => {
    if (!room || room.status !== "playing" || typeof chooseRobotMove !== "function") {
      robotKey.current = "";
      return undefined;
    }
    const move = chooseRobotMove(room.gameState, members);
    if (!move?.uid || !move?.action || !members.find((member) => member.uid === move.uid)?.isRobot) {
      robotKey.current = "";
      return undefined;
    }
    const key = move.key || `${room.gameState?.roundNumber || 0}:${room.gameState?.phase}:${move.uid}:${JSON.stringify(move.action)}`;
    if (robotKey.current === key) return undefined;
    robotKey.current = key;
    const timer = window.setTimeout(() => {
      applyModularAction(roomCode, move.uid, move.action, reduceGameState).catch((event) => {
        setError(event.message);
        robotKey.current = "";
      });
    }, robotDelay);
    return () => window.clearTimeout(timer);
  }, [room, roomCode, members, chooseRobotMove, reduceGameState, robotDelay]);

  async function run(operation) {
    setBusy(true);
    setError("");
    try {
      return await operation();
    } catch (event) {
      setError(event.message);
      throw event;
    } finally {
      setBusy(false);
    }
  }

  async function createRoom() {
    await run(async () => {
      localStorage.setItem("familyCardNickname", nickname);
      localStorage.setItem("familyCardAvatar", avatar);
      const code = await createModularRoom({ user, nickname, avatar, gameId, maxPlayers, rules });
      setRoomCode(code);
    }).catch(() => {});
  }

  async function joinRoom() {
    await run(async () => {
      const code = await joinModularRoom({ code: joinCode, user, nickname, avatar, gameId });
      setRoomCode(code);
    }).catch(() => {});
  }

  function addRobot() {
    if (!roomCode || !user) return;
    run(() => addModularRobot(roomCode, user.uid)).catch(() => {});
  }

  function start() {
    if (!roomCode || !user) return;
    run(() => startModularGame(roomCode, user.uid, createGameState, minimumPlayers)).catch(() => {});
  }

  function act(payload, actorUid = user?.uid) {
    if (!roomCode || !actorUid) return;
    run(() => applyModularAction(roomCode, actorUid, payload, reduceGameState)).catch(() => {});
  }

  return {
    user,
    nickname,
    setNickname,
    avatar,
    setAvatar,
    joinCode,
    setJoinCode,
    roomCode,
    room,
    members,
    error,
    busy,
    createRoom,
    joinRoom,
    addRobot,
    start,
    act,
  };
}
