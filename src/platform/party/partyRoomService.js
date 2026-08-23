import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { db } from "../../firebase";
import { recordCompletedRoom } from "../leaderboardService";

export const PARTY_AVATARS = ["🦊", "🐻", "🦉", "🐙", "🦁", "🐼", "🐯", "🦄", "🐸", "🤠", "🦝", "🦇"];

export function newPartyRoomCode(random = Math.random) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
}

export function partyPlayers(room) {
  return Object.values(room?.members || {})
    .filter((member) => !member.displayOnly)
    .sort((a, b) => Number(a.seat) - Number(b.seat));
}

export async function createPartyRoom({ user, gameId, maxPlayers = 12, settings = {} }) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = newPartyRoomCode();
    const directoryResult = await runTransaction(ref(db, `roomDirectory/${code}`), (current) => {
      if (current) return;
      return { roomCode: code, gameId, kind: "party", createdAt: Date.now() };
    });
    if (!directoryResult.committed) continue;

    await set(ref(db, `rooms/${code}`), {
      roomCode: code,
      gameId,
      kind: "party",
      schemaVersion: 2,
      hostUid: user.uid,
      status: "lobby",
      maxPlayers,
      settings,
      createdAt: serverTimestamp(),
      gameNumber: 0,
      members: {
        [user.uid]: {
          uid: user.uid,
          nickname: "TV",
          avatar: "📺",
          seat: -1,
          connected: true,
          isHost: true,
          displayOnly: true,
          ready: true,
          joinedAt: serverTimestamp(),
        },
      },
      gameState: { phase: "lobby", message: "Waiting for phones to join." },
    });
    await onDisconnect(ref(db, `rooms/${code}/members/${user.uid}/connected`)).set(false);
    return code;
  }
  throw new Error("Could not create a unique room code. Try again.");
}

export async function joinPartyRoom({ code, user, nickname, avatar, gameId }) {
  const normalized = code.trim().toUpperCase();
  const directory = await get(ref(db, `roomDirectory/${normalized}`));
  if (!directory.exists()) throw new Error("Room code not found.");

  const snapshot = await get(ref(db, `rooms/${normalized}`));
  if (!snapshot.exists()) throw new Error("That room has expired.");
  const room = snapshot.val();
  if (room.kind !== "party" || room.gameId !== gameId) throw new Error("That room belongs to a different game.");

  const existing = room.members?.[user.uid];
  if (!existing && room.status !== "lobby") throw new Error("That show has already started.");
  const players = partyPlayers(room);
  if (!existing && players.length >= Number(room.maxPlayers || 12)) throw new Error("That room is full.");

  const cleanName = nickname.trim().slice(0, 18) || `Player ${players.length + 1}`;
  const duplicate = players.some((player) => player.uid !== user.uid && player.nickname.toLowerCase() === cleanName.toLowerCase());
  if (duplicate) throw new Error("Someone in that room already has that name.");

  const seat = existing?.seat ?? players.length;
  await set(ref(db, `rooms/${normalized}/members/${user.uid}`), {
    uid: user.uid,
    nickname: cleanName,
    avatar: avatar || PARTY_AVATARS[seat % PARTY_AVATARS.length],
    seat,
    connected: true,
    isHost: false,
    displayOnly: false,
    ready: existing?.ready || false,
    joinedAt: existing?.joinedAt || serverTimestamp(),
  });
  await onDisconnect(ref(db, `rooms/${normalized}/members/${user.uid}/connected`)).set(false);
  return normalized;
}

export function watchPartyRoom(code, callback) {
  return onValue(ref(db, `rooms/${code}`), (snapshot) => {
    const room = snapshot.val();
    callback(room);
    if (room) recordCompletedRoom(room, room.gameId || "", code).catch(() => {});
  });
}

export async function setPartyReady(code, uid, ready) {
  await update(ref(db, `rooms/${code}/members/${uid}`), { ready: Boolean(ready), connected: true });
}

export async function startPartyGame(code, hostUid, createGameState, minimumPlayers) {
  let reason = "The game could not start.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room) { reason = "Room not found."; return; }
    if (room.hostUid !== hostUid) { reason = "Only the TV host can start the show."; return; }
    if (room.status !== "lobby") { reason = "The show already started."; return; }
    const players = partyPlayers(room);
    if (players.length < minimumPlayers) { reason = `Add at least ${minimumPlayers} players.`; return; }
    const notReady = players.filter((player) => !player.ready);
    if (notReady.length) { reason = `${notReady.length} player${notReady.length === 1 ? " is" : "s are"} not ready.`; return; }
    return {
      ...room,
      status: "playing",
      gameNumber: Number(room.gameNumber || 0) + 1,
      startedAt: Date.now(),
      gameState: createGameState(players, room.settings || {}),
    };
  }, { applyLocally: false });
  if (!result.committed) throw new Error(reason);
  return result.snapshot.val()?.gameState;
}

export async function resetPartyRoomToLobby(code, hostUid) {
  let reason = "The room could not be reset.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room) { reason = "Room not found."; return; }
    if (room.hostUid !== hostUid) { reason = "Only the TV host can start a rematch."; return; }
    const members = Object.fromEntries(Object.entries(room.members || {}).map(([uid, member]) => [uid, {
      ...member,
      ready: Boolean(member.displayOnly),
      connected: member.connected !== false,
    }]));
    return {
      ...room,
      status: "lobby",
      startedAt: null,
      rematchAt: Date.now(),
      members,
      gameState: { phase: "lobby", message: "Rematch ready. Everyone tap Ready on a phone." },
    };
  }, { applyLocally: false });
  if (!result.committed) throw new Error(reason);
  return result.snapshot.val();
}

export async function applyPartyAction(code, actorUid, action, reduceGameState) {
  let actionError = null;
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room || room.status !== "playing" || !room.members?.[actorUid]) return;
    try {
      const actor = room.members[actorUid];
      const next = reduceGameState(room.gameState, actor, action, partyPlayers(room), room.settings || {}, room.hostUid);
      actionError = null;
      return { ...room, gameState: next };
    } catch (error) {
      actionError = error;
      return;
    }
  }, { applyLocally: false });
  if (actionError) throw actionError;
  if (!result.committed) throw new Error("That action was not accepted. The round may have moved on.");
  return result.snapshot.val()?.gameState;
}

export async function updatePartySettings(code, hostUid, settingsPatch) {
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room || room.hostUid !== hostUid || room.status !== "lobby") return;
    return { ...room, settings: { ...(room.settings || {}), ...(settingsPatch || {}) } };
  });
  if (!result.committed) throw new Error("Settings can only be changed by the TV host before the game starts.");
}

export async function kickPartyPlayer(code, hostUid, uid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  const room = snapshot.val();
  if (!room || room.hostUid !== hostUid) throw new Error("Only the TV host can remove a player.");
  if (uid === hostUid) throw new Error("The TV host cannot remove itself.");
  await remove(ref(db, `rooms/${code}/members/${uid}`));
}

export async function leavePartyRoom(code, uid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  const room = snapshot.val();
  if (!room) return;
  if (room.hostUid === uid) throw new Error("The TV host must end the room for everyone.");
  if (room.members?.[uid]) await remove(ref(db, `rooms/${code}/members/${uid}`));
}

export async function closePartyRoom(code, hostUid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (snapshot.val()?.hostUid !== hostUid) throw new Error("Only the TV host can close the room.");
  await Promise.all([
    remove(ref(db, `rooms/${code}`)),
    remove(ref(db, `roomDirectory/${code}`)),
  ]);
}
