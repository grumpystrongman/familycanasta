import { useEffect, useMemo, useState } from "react";
import { onDisconnect, ref, update } from "firebase/database";
import { db, ensureAnonymousAuth, firebaseReady } from "../../firebase";
import {
  PARTY_AVATARS,
  applyPartyAction,
  closePartyRoom,
  createPartyRoom,
  joinPartyRoom,
  kickPartyPlayer,
  partyPlayers,
  setPartyReady,
  startPartyGame,
  updatePartySettings,
  watchPartyRoom,
} from "./partyRoomService";

function roomFromUrl() {
  return new URLSearchParams(window.location.search).get("room") || "";
}
function sessionKey(gameId) { return `familyPartySession:${gameId}`; }
function savedSession(gameId) {
  try { return JSON.parse(localStorage.getItem(sessionKey(gameId)) || "null"); }
  catch { return null; }
}
function saveSession(gameId, roomCode, role) {
  localStorage.setItem(sessionKey(gameId), JSON.stringify({ roomCode, role }));
  const next = new URL(window.location.href);
  next.searchParams.set("room", roomCode);
  next.searchParams.set("role", role);
  window.history.replaceState({}, "", next.toString());
}
function clearSession(gameId) { localStorage.removeItem(sessionKey(gameId)); }

export default function usePartyRoom(definition) {
  const initialSession = useMemo(() => savedSession(definition.id), [definition.id]);
  const deepLinkRoom = roomFromUrl();
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(initialSession?.role || (deepLinkRoom ? "join" : "choose"));
  const [nickname, setNickname] = useState(localStorage.getItem("familyPartyNickname") || "");
  const [avatar, setAvatar] = useState(localStorage.getItem("familyPartyAvatar") || PARTY_AVATARS[0]);
  const [joinCode, setJoinCode] = useState(deepLinkRoom || initialSession?.roomCode || "");
  const [roomCode, setRoomCode] = useState(initialSession?.roomCode || "");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseReady) return;
    ensureAnonymousAuth().then(setUser).catch((event) => setError(event.message));
  }, []);

  useEffect(() => {
    if (!roomCode) return undefined;
    return watchPartyRoom(roomCode, (nextRoom) => {
      setRoom(nextRoom);
      if (!nextRoom) {
        clearSession(definition.id);
        setRoomCode("");
        setMode(deepLinkRoom ? "join" : "choose");
      }
    });
  }, [roomCode, definition.id, deepLinkRoom]);

  const players = useMemo(() => partyPlayers(room), [room]);
  const me = user ? room?.members?.[user.uid] || null : null;
  const isHost = Boolean(user && room?.hostUid === user.uid);

  useEffect(() => {
    if (!user || !roomCode || !me) return undefined;
    const memberRef = ref(db, `rooms/${roomCode}/members/${user.uid}`);
    update(memberRef, { connected: true }).catch(() => {});
    onDisconnect(ref(db, `rooms/${roomCode}/members/${user.uid}/connected`)).set(false).catch(() => {});
    return undefined;
  }, [user, roomCode, me?.uid]);

  async function run(operation) {
    setBusy(true);
    setError("");
    try { return await operation(); }
    catch (event) { setError(event.message || String(event)); throw event; }
    finally { setBusy(false); }
  }

  async function host() {
    if (!user) return;
    await run(async () => {
      const code = await createPartyRoom({ user, gameId: definition.id, maxPlayers: definition.maxPlayers, settings: definition.defaultSettings || {} });
      saveSession(definition.id, code, "host");
      setJoinCode(code);
      setRoomCode(code);
      setMode("host");
    }).catch(() => {});
  }

  async function join() {
    if (!user) return;
    await run(async () => {
      localStorage.setItem("familyPartyNickname", nickname.trim());
      localStorage.setItem("familyPartyAvatar", avatar);
      const code = await joinPartyRoom({ code: joinCode, user, nickname, avatar, gameId: definition.id });
      saveSession(definition.id, code, "player");
      setRoomCode(code);
      setMode("player");
    }).catch(() => {});
  }

  function ready(value) {
    if (!roomCode || !user || isHost) return;
    run(() => setPartyReady(roomCode, user.uid, value)).catch(() => {});
  }

  function start() {
    if (!roomCode || !user || !isHost) return;
    run(() => startPartyGame(roomCode, user.uid, definition.createGameState, definition.minPlayers)).catch(() => {});
  }

  function act(action, actorUid = user?.uid) {
    if (!roomCode || !actorUid) return Promise.resolve();
    return run(() => applyPartyAction(roomCode, actorUid, action, definition.reduceGameState)).catch(() => {});
  }

  function setSettings(patch) {
    if (!roomCode || !user || !isHost) return;
    run(() => updatePartySettings(roomCode, user.uid, patch)).catch(() => {});
  }

  function kick(uid) {
    if (!roomCode || !user || !isHost) return;
    run(() => kickPartyPlayer(roomCode, user.uid, uid)).catch(() => {});
  }

  async function close() {
    if (!roomCode || !user || !isHost) return;
    await run(() => closePartyRoom(roomCode, user.uid)).catch(() => {});
    clearSession(definition.id);
    setRoomCode("");
    setRoom(null);
    setMode("choose");
    const next = new URL(window.location.href);
    next.searchParams.delete("room");
    next.searchParams.delete("role");
    window.history.replaceState({}, "", next.toString());
  }

  return {
    firebaseReady,
    user,
    mode,
    setMode,
    nickname,
    setNickname,
    avatar,
    setAvatar,
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
    act,
    setSettings,
    kick,
    close,
  };
}
