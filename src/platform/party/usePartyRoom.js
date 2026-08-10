import { useEffect, useMemo, useState } from "react";
import { ensureAnonymousAuth, firebaseReady } from "../../firebase";
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

export default function usePartyRoom(definition) {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(roomFromUrl() ? "join" : "choose");
  const [nickname, setNickname] = useState(localStorage.getItem("familyPartyNickname") || "");
  const [avatar, setAvatar] = useState(localStorage.getItem("familyPartyAvatar") || PARTY_AVATARS[0]);
  const [joinCode, setJoinCode] = useState(roomFromUrl());
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseReady) return;
    ensureAnonymousAuth().then(setUser).catch((event) => setError(event.message));
  }, []);

  useEffect(() => roomCode ? watchPartyRoom(roomCode, setRoom) : undefined, [roomCode]);

  const players = useMemo(() => partyPlayers(room), [room]);
  const me = user ? room?.members?.[user.uid] || null : null;
  const isHost = Boolean(user && room?.hostUid === user.uid);

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
    setRoomCode("");
    setRoom(null);
    setMode("choose");
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
