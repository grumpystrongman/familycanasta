import { useEffect, useMemo, useState } from "react";
import { ensureAnonymousAuth, firebaseReady } from "../../firebase";
import {
  chompOnlinePlayers,
  closeChompOnlineRoom,
  createChompOnlineRoom,
  joinChompOnlineRoom,
  leaveChompOnlineRoom,
  markChompOnlineConnected,
  publishChompOnlineSnapshot,
  resetChompOnlineLobby,
  setChompOnlineReady,
  startChompOnlineRound,
  submitChompOnlineInput,
  watchChompOnlineRoom,
} from "./onlineRoom";

function initialUrlState() {
  if (typeof window === "undefined") return { room: "", role: "" };
  const params = new URLSearchParams(window.location.search);
  return { room: params.get("room") || "", role: params.get("role") || "" };
}

function rememberRoom(code, role) {
  const next = new URL(window.location.href);
  next.searchParams.set("room", code);
  next.searchParams.set("role", role);
  window.history.replaceState({}, "", next.toString());
}

function clearRoomFromUrl() {
  const next = new URL(window.location.href);
  next.searchParams.delete("room");
  next.searchParams.delete("role");
  window.history.replaceState({}, "", next.toString());
}

export default function useChompOnlineRoom() {
  const initial = useMemo(initialUrlState, []);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(initial.role ? "room" : initial.room ? "join" : "choose");
  const [nickname, setNickname] = useState(() => localStorage.getItem("chompOnlineNickname") || "");
  const [joinCode, setJoinCode] = useState(initial.room);
  const [roomCode, setRoomCode] = useState(initial.role ? initial.room : "");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseReady) return;
    ensureAnonymousAuth().then(setUser).catch((event) => setError(event.message || String(event)));
  }, []);

  useEffect(() => {
    if (!roomCode || !user) return undefined;
    return watchChompOnlineRoom(
      roomCode,
      (nextRoom) => {
        setRoom(nextRoom);
        if (!nextRoom) {
          setError("That Chompageddon room has ended.");
          setRoomCode("");
          setMode("choose");
          clearRoomFromUrl();
        }
      },
      (event) => setError(event.message || String(event))
    );
  }, [roomCode, user?.uid]);

  const players = useMemo(() => chompOnlinePlayers(room), [room]);
  const me = user ? room?.members?.[user.uid] || null : null;
  const isHost = Boolean(user && room?.hostUid === user.uid);

  useEffect(() => {
    if (!roomCode || !user || !me) return;
    markChompOnlineConnected(roomCode, user.uid).catch(() => {});
  }, [roomCode, user?.uid, me?.uid]);

  async function run(operation) {
    setBusy(true);
    setError("");
    try { return await operation(); }
    catch (event) { setError(event.message || String(event)); return null; }
    finally { setBusy(false); }
  }

  async function host() {
    if (!user) return null;
    const code = await run(() => createChompOnlineRoom({ user, nickname }));
    if (!code) return null;
    localStorage.setItem("chompOnlineNickname", nickname.trim());
    rememberRoom(code, "host");
    setJoinCode(code);
    setRoomCode(code);
    setMode("room");
    return code;
  }

  async function join() {
    if (!user) return null;
    const code = await run(() => joinChompOnlineRoom({ code: joinCode, user, nickname }));
    if (!code) return null;
    localStorage.setItem("chompOnlineNickname", nickname.trim());
    rememberRoom(code, "player");
    setJoinCode(code);
    setRoomCode(code);
    setMode("room");
    return code;
  }

  async function ready(value) {
    if (!roomCode || !user || isHost) return null;
    return run(() => setChompOnlineReady(roomCode, user.uid, value));
  }

  async function start(snapshot, { rematch = false } = {}) {
    if (!roomCode || !user || !isHost) return null;
    return run(() => startChompOnlineRound({
      code: roomCode,
      hostUid: user.uid,
      snapshot,
      requireReady: !rematch,
    }));
  }

  function chomp() {
    if (!roomCode || !user || !me || room?.status !== "playing") return Promise.resolve(null);
    return submitChompOnlineInput(roomCode, user.uid).catch((event) => {
      setError(event.message || String(event));
      return null;
    });
  }

  function publish(snapshot, message, finished = false) {
    if (!roomCode || !isHost) return Promise.resolve();
    return publishChompOnlineSnapshot(roomCode, snapshot, message, finished).catch((event) => {
      setError(event.message || String(event));
    });
  }

  async function lobby() {
    if (!roomCode || !user || !isHost) return null;
    return run(() => resetChompOnlineLobby(roomCode, user.uid));
  }

  function resetLocal() {
    setRoomCode("");
    setRoom(null);
    setMode("choose");
    setJoinCode("");
    clearRoomFromUrl();
  }

  async function leave() {
    if (!roomCode || !user) { resetLocal(); return; }
    if (isHost) await run(() => closeChompOnlineRoom(roomCode, user.uid));
    else await run(() => leaveChompOnlineRoom(roomCode, user.uid));
    resetLocal();
  }

  return {
    firebaseReady,
    user,
    mode,
    setMode,
    nickname,
    setNickname,
    joinCode,
    setJoinCode,
    roomCode,
    room,
    players,
    me,
    isHost,
    error,
    busy,
    host,
    join,
    ready,
    start,
    chomp,
    publish,
    lobby,
    leave,
  };
}
