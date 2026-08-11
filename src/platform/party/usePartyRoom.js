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
  leavePartyRoom,
  partyPlayers,
  resetPartyRoomToLobby,
  setPartyReady,
  startPartyGame,
  updatePartySettings,
  watchPartyRoom,
} from "./partyRoomService";

const SESSION_MAX_AGE = 12 * 60 * 60 * 1000;

function roomFromUrl() {
  return new URLSearchParams(window.location.search).get("room") || "";
}
function sessionKey(gameId) { return `familyPartySession:${gameId}`; }
function savedSession(gameId) {
  try {
    const saved = JSON.parse(localStorage.getItem(sessionKey(gameId)) || "null");
    if (saved?.savedAt && Date.now() - saved.savedAt > SESSION_MAX_AGE) {
      localStorage.removeItem(sessionKey(gameId));
      return null;
    }
    return saved;
  } catch { return null; }
}
function saveSession(gameId, roomCode, role) {
  localStorage.setItem(sessionKey(gameId), JSON.stringify({ roomCode, role, savedAt: Date.now() }));
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
    if (!roomCode || !user) return undefined;
    return watchPartyRoom(roomCode, (nextRoom) => {
      setRoom(nextRoom);
      if (!nextRoom) {
        clearSession(definition.id);
        setRoomCode("");
        setMode(deepLinkRoom ? "join" : "choose");
      }
    });
  }, [roomCode, user?.uid, definition.id, deepLinkRoom]);

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

  function resetLocal({ removeGame = false } = {}) {
    clearSession(definition.id);
    setRoomCode("");
    setRoom(null);
    setMode("choose");
    setJoinCode("");
    const next = new URL(window.location.href);
    next.searchParams.delete("room");
    next.searchParams.delete("role");
    if (removeGame) next.searchParams.delete("game");
    window.history.replaceState({}, "", next.toString());
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

  function replay() {
    if (!roomCode || !user || !isHost) return;
    run(() => resetPartyRoomToLobby(roomCode, user.uid)).catch(() => {});
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

  async function leave() {
    if (roomCode && user && !isHost) await run(() => leavePartyRoom(roomCode, user.uid)).catch(() => {});
    resetLocal();
  }

  async function close() {
    if (!roomCode || !user || !isHost) return;
    await run(() => closePartyRoom(roomCode, user.uid)).catch(() => {});
    resetLocal();
  }

  async function gameRoom() {
    if (roomCode && user) {
      if (isHost) await run(() => closePartyRoom(roomCode, user.uid)).catch(() => {});
      else await run(() => leavePartyRoom(roomCode, user.uid)).catch(() => {});
    }
    resetLocal({ removeGame: true });
    window.location.assign(window.location.pathname);
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
    replay,
    act,
    setSettings,
    kick,
    leave,
    close,
    gameRoom,
  };
}
