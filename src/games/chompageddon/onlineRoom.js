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
import { recordCompletedRoom } from "../../platform/leaderboardService";

export { chompOnlinePlayers, firstOpenChompSeat } from "./onlineRoomModel.js";
import { chompOnlinePlayers, firstOpenChompSeat } from "./onlineRoomModel.js";

export const CHOMP_ONLINE_MAX_PLAYERS = 4;
export const CHOMP_ONLINE_MIN_PLAYERS = 2;

const GAME_ID = "chompageddon";

function roomCode(random = Math.random) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
}

function cleanNickname(nickname, fallback = "Player") {
  return String(nickname || "").trim().slice(0, 18) || fallback;
}

export async function createChompOnlineRoom({ user, nickname }) {
  if (!user?.uid) throw new Error("Sign-in is still starting. Try again in a moment.");
  const hostName = cleanNickname(nickname, "Host");

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = roomCode();
    const directoryResult = await runTransaction(ref(db, `roomDirectory/${code}`), (current) => {
      if (current) return;
      return { roomCode: code, gameId: GAME_ID, kind: "chompageddon", createdAt: Date.now() };
    });
    if (!directoryResult.committed) continue;

    await set(ref(db, `rooms/${code}`), {
      roomCode: code,
      gameId: GAME_ID,
      kind: "chompageddon",
      schemaVersion: 1,
      hostUid: user.uid,
      status: "lobby",
      maxPlayers: CHOMP_ONLINE_MAX_PLAYERS,
      createdAt: serverTimestamp(),
      gameNumber: 0,
      members: {
        [user.uid]: {
          uid: user.uid,
          nickname: hostName,
          seat: 0,
          connected: true,
          isHost: true,
          ready: true,
          joinedAt: serverTimestamp(),
        },
      },
      inputs: {},
      gameState: {
        phase: "lobby",
        roundId: null,
        snapshot: null,
        message: "Waiting for monsters to join.",
        updatedAt: Date.now(),
      },
    });
    await onDisconnect(ref(db, `rooms/${code}/members/${user.uid}/connected`)).set(false);
    return code;
  }

  throw new Error("Could not create a unique room code. Try again.");
}

export async function joinChompOnlineRoom({ code, user, nickname }) {
  if (!user?.uid) throw new Error("Sign-in is still starting. Try again in a moment.");
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) throw new Error("Enter a room code.");

  const directory = await get(ref(db, `roomDirectory/${normalized}`));
  if (!directory.exists()) throw new Error("Room code not found.");

  const snapshot = await get(ref(db, `rooms/${normalized}`));
  if (!snapshot.exists()) throw new Error("That room has expired.");
  const room = snapshot.val();
  if (room.kind !== "chompageddon" || room.gameId !== GAME_ID) throw new Error("That room belongs to a different game.");

  const existing = room.members?.[user.uid];
  if (!existing && room.status !== "lobby") throw new Error("That Chompageddon has already started.");

  const players = chompOnlinePlayers(room);
  if (!existing && players.length >= Number(room.maxPlayers || CHOMP_ONLINE_MAX_PLAYERS)) throw new Error("That room is full.");

  const cleanName = cleanNickname(nickname, `Player ${players.length + 1}`);
  const duplicate = players.some((player) => player.uid !== user.uid && String(player.nickname).toLowerCase() === cleanName.toLowerCase());
  if (duplicate) throw new Error("Someone in that room already has that name.");

  const seat = existing?.seat ?? firstOpenChompSeat(room);
  if (seat < 0) throw new Error("That room is full.");

  await set(ref(db, `rooms/${normalized}/members/${user.uid}`), {
    uid: user.uid,
    nickname: cleanName,
    seat,
    connected: true,
    isHost: Boolean(existing?.isHost),
    ready: Boolean(existing?.isHost || existing?.ready),
    joinedAt: existing?.joinedAt || serverTimestamp(),
  });
  await onDisconnect(ref(db, `rooms/${normalized}/members/${user.uid}/connected`)).set(false);
  return normalized;
}

export function watchChompOnlineRoom(code, onRoom, onError) {
  return onValue(
    ref(db, `rooms/${code}`),
    (snapshot) => {
      const room = snapshot.val();
      onRoom(room);
      if (room) recordCompletedRoom(room, GAME_ID, code).catch(() => {});
    },
    (error) => onError?.(error)
  );
}

export async function markChompOnlineConnected(code, uid) {
  await update(ref(db, `rooms/${code}/members/${uid}`), { connected: true });
  await onDisconnect(ref(db, `rooms/${code}/members/${uid}/connected`)).set(false);
}

export async function setChompOnlineReady(code, uid, ready) {
  await update(ref(db, `rooms/${code}/members/${uid}`), { ready: Boolean(ready), connected: true });
}

export async function startChompOnlineRound({ code, hostUid, snapshot, requireReady = true }) {
  let reason = "The round could not start.";
  const roundId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room) { reason = "Room not found."; return; }
    if (room.hostUid !== hostUid) { reason = "Only the room host can start Chompageddon."; return; }
    if (room.status !== "lobby" && room.status !== "finished") { reason = "A round is already running."; return; }
    const players = chompOnlinePlayers(room);
    if (players.length < CHOMP_ONLINE_MIN_PLAYERS) { reason = `Add at least ${CHOMP_ONLINE_MIN_PLAYERS} players.`; return; }
    if (requireReady && room.status === "lobby") {
      const notReady = players.filter((player) => !player.ready || player.connected === false);
      if (notReady.length) { reason = `${notReady.length} player${notReady.length === 1 ? " is" : "s are"} not ready.`; return; }
    }

    return {
      ...room,
      status: "playing",
      gameNumber: Number(room.gameNumber || 0) + 1,
      startedAt: Date.now(),
      gameState: {
        phase: "playing",
        roundId,
        snapshot,
        message: "BALLZ RELEASED. CHOMP!",
        updatedAt: Date.now(),
      },
    };
  }, { applyLocally: false });

  if (!result.committed) throw new Error(reason);
  return result.snapshot.val()?.gameState;
}

export async function submitChompOnlineInput(code, uid) {
  const inputRef = ref(db, `rooms/${code}/inputs/${uid}`);
  const result = await runTransaction(inputRef, (current) => ({
    seq: Number(current?.seq || 0) + 1,
    at: Date.now(),
  }));
  if (!result.committed) throw new Error("That chomp did not make it to the arena.");
  return result.snapshot.val();
}

export async function publishChompOnlineSnapshot(code, snapshot, message, finished = false) {
  const updates = {
    status: finished ? "finished" : "playing",
    "gameState/phase": finished ? "finished" : "playing",
    "gameState/snapshot": snapshot,
    "gameState/message": message || "CHOMP!",
    "gameState/updatedAt": Date.now(),
  };

  if (finished) {
    const roomSnapshot = await get(ref(db, `rooms/${code}`));
    const room = roomSnapshot.val();
    const players = chompOnlinePlayers(room);
    const scores = Object.fromEntries(players.map((player) => [
      player.uid,
      Number(snapshot?.chompers?.[Number(player.seat)]?.score || 0),
    ]));
    const best = players.length ? Math.max(...players.map((player) => scores[player.uid])) : 0;
    updates["gameState/scores"] = scores;
    updates["gameState/winnerUids"] = players.filter((player) => scores[player.uid] === best).map((player) => player.uid);
    updates["gameState/completedAt"] = Date.now();
  }

  await update(ref(db, `rooms/${code}`), updates);
}

export async function resetChompOnlineLobby(code, hostUid) {
  let reason = "The room could not return to the lobby.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room) { reason = "Room not found."; return; }
    if (room.hostUid !== hostUid) { reason = "Only the room host can reset the lobby."; return; }
    const members = Object.fromEntries(Object.entries(room.members || {}).map(([uid, member]) => [uid, {
      ...member,
      ready: uid === hostUid,
      connected: member.connected !== false,
    }]));
    return {
      ...room,
      status: "lobby",
      startedAt: null,
      members,
      gameState: {
        phase: "lobby",
        roundId: null,
        snapshot: null,
        message: "Rematch lobby. Everybody ready up.",
        updatedAt: Date.now(),
      },
    };
  }, { applyLocally: false });
  if (!result.committed) throw new Error(reason);
  return result.snapshot.val();
}

export async function leaveChompOnlineRoom(code, uid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  const room = snapshot.val();
  if (!room) return;
  if (room.hostUid === uid) throw new Error("The host must close the room for everyone.");
  if (room.inputs?.[uid]) await remove(ref(db, `rooms/${code}/inputs/${uid}`));
  if (room.members?.[uid]) await remove(ref(db, `rooms/${code}/members/${uid}`));
}

export async function closeChompOnlineRoom(code, hostUid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) return;
  if (snapshot.val()?.hostUid !== hostUid) throw new Error("Only the host can close this room.");
  await Promise.all([
    remove(ref(db, `rooms/${code}`)),
    remove(ref(db, `roomDirectory/${code}`)),
  ]);
}
