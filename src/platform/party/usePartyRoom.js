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
const AUTH_PENDING_USER = Object.freeze({ uid: "" });

function roomFromUrl() {
  return new URLSearchParams(window.location.search).get("room") || "";
}
function sessionKey(gameId) { return `familyPartySession:${gameId}`; }
function savedSession(gameId) {
  try {
    const saved = JSON.parse(localStorage.getItem(sessionKey(gameId)) || "null");
    // Sessions written before the lifecycle fix had no age metadata and are the
    // exact entries that could resurrect an already-finished room forever.
    if (saved && !saved.savedAt) {
      localStorage.removeItem(sessionKey(gameId));
      return null;
    }
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
  // The entry screen only needs a truthy value to allow Host/Join taps. Keep a
  // lightweight pending marker here so a slow mobile auth restore does not make
  // a fully completed join form look permanently disabled. Every operation that
  // needs a Firebase uid still calls requireUser() before touching room state.
  const [user, setUser] = useState(firebaseReady ? AUTH_PENDING_USER : null);
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

  async function requireUser() {
    if (user?.uid) return user;
    const nextUser = await ensureAnonymousAuth();
    setUser(nextUser);
    return nextUser;
  }

  useEffect(() => {
    if (!roomCode || !user?.uid) return undefined;
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
  const me = user?.uid ? room?.members?.[user.uid] || null : null;
  const isHost = Boolean(user?.uid && room?.hostUid === user.uid);

  useEffect(() => {
    if (!user?.uid || !roomCode || !me) return undefined;
    const memberRef = ref(db, `rooms/${roomCode}/members/${user.uid}`);
    update(memberRef, { connected: true }).catch(() => {});
    onDisconnect(ref(db, `rooms/${roomCode}/members/${user.uid}/connected`)).set(false).catch(() => {});
    return undefined;
  }, [user?.uid, roomCode, me?.uid]);

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
    await run(async () => {
      const currentUser = await requireUser();
      const code = await createPartyRoom({ user: currentUser, gameId: definition.id, maxPlayers: definition.maxPlayers, settings: definition.defaultSettings || {} });
      saveSession(definition.id, code, "host");
      setJoinCode(code);
      setRoomCode(code);
      setMode("host");
    }).catch(() => {});
  }

  async function join() {
    await run(async () => {
      const currentUser = await requireUser();
      localStorage.setItem("familyPartyNickname", nickname.trim());
      localStorage.setItem("familyPartyAvatar", avatar);
      const code = await joinPartyRoom({ code: joinCode, user: currentUser, nickname, avatar, gameId: definition.id });
      saveSession(definition.id, code, "player");
      setRoomCode(code);
      setMode("player");
    }).catch(() => {});
  }

  function ready(value) {
    if (!roomCode || !user?.uid || isHost) return;
    run(() => setPartyReady(roomCode, user.uid, value)).catch(() => {});
  }

  function start() {
    if (!roomCode || !user?.uid || !isHost) return;
    run(() => startPartyGame(roomCode, user.uid, definition.createGameState, definition.minPlayers)).catch(() => {});
  }

  function replay() {
    if (!roomCode || !user?.uid || !isHost) return;
    run(() => resetPartyRoomToLobby(roomCode, user.uid)).catch(() => {});
  }

  function act(action, actorUid = user?.uid) {
    if (!roomCode || !actorUid) return Promise.resolve();
    return run(() => applyPartyAction(roomCode, actorUid, action, definition.reduceGameState)).catch(() => {});
  }

  function setSettings(patch) {
    if (!roomCode || !user?.uid || !isHost) return;
    run(() => updatePartySettings(roomCode, user.uid, patch)).catch(() => {});
  }

  function kick(uid) {
    if (!roomCode || !user?.uid || !isHost) return;
    run(() => kickPartyPlayer(roomCode, user.uid, uid)).catch(() => {});
  }

  async function leave() {
    if (roomCode && user?.uid && !isHost) await run(() => leavePartyRoom(roomCode, user.uid)).catch(() => {});
    resetLocal();
  }

  async function close() {
    if (!roomCode || !user?.uid || !isHost) return;
    await run(() => closePartyRoom(roomCode, user.uid)).catch(() => {});
    resetLocal();
  }

  async function gameRoom() {
    if (roomCode && user?.uid) {
      if (isHost) await run(() => closePartyRoom(roomCode, user.uid)).catch(() => {});
      else await run(() => leavePartyRoom(roomCode, user.uid)).catch(() => {});
    }
    resetLocal({ removeGame: true });
    window.location.assign(window.location.pathname);
  }

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__familyPartyLifecycle = {
      roomCode,
      isHost,
      status: room?.status || "",
      phase: room?.gameState?.phase || "",
      busy,
      replay,
      leave,
      close,
      gameRoom,
    };
    window.dispatchEvent(new CustomEvent("family-party-lifecycle"));
    return () => {
      if (window.__familyPartyLifecycle?.roomCode === roomCode) delete window.__familyPartyLifecycle;
    };
  }, [roomCode, isHost, room?.status, room?.gameState?.phase, busy]);

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
