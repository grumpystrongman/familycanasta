import {
  get,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { db } from "../firebase";
import { recordCompletedRoom } from "./leaderboardService";

const AVATARS = ["🦊", "🐻", "🦉", "🐙", "🦁", "🐼", "🐯", "🦄", "🐸", "🤠"];
const ROBOT_NAMES = ["Ruby", "Milo", "Hazel", "Otto", "Cleo", "Finn"];

function newRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function orderedMembers(room) {
  return Object.values(room?.members || {}).sort((a, b) => Number(a.seat) - Number(b.seat));
}

export async function createModularRoom({ user, nickname, avatar, gameId, maxPlayers, rules = {} }) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newRoomCode();
    const directoryResult = await runTransaction(ref(db, `roomDirectory/${code}`), (current) => {
      if (current) return;
      return { roomCode: code, gameId, createdAt: Date.now() };
    });
    if (!directoryResult.committed) continue;

    const member = {
      uid: user.uid,
      nickname: nickname.trim() || "Host",
      avatar: avatar || AVATARS[0],
      seat: 0,
      connected: true,
      isHost: true,
      isRobot: false,
      joinedAt: serverTimestamp(),
    };

    await set(ref(db, `rooms/${code}`), {
      roomCode: code,
      gameId,
      schemaVersion: 1,
      hostUid: user.uid,
      status: "lobby",
      maxPlayers,
      rules,
      createdAt: serverTimestamp(),
      gameNumber: 0,
      members: { [user.uid]: member },
      gameState: { phase: "lobby", message: "Waiting for players." },
    });
    await onDisconnect(ref(db, `rooms/${code}/members/${user.uid}/connected`)).set(false);
    return code;
  }
  throw new Error("Could not create a unique room code.");
}

export async function joinModularRoom({ code, user, nickname, avatar, gameId }) {
  const normalized = code.trim().toUpperCase();
  const directory = await get(ref(db, `roomDirectory/${normalized}`));
  if (!directory.exists()) throw new Error("Room code not found.");

  const snapshot = await get(ref(db, `rooms/${normalized}`));
  if (!snapshot.exists()) throw new Error("The room has expired.");
  const room = snapshot.val();
  if (room.gameId !== gameId) throw new Error(`That code belongs to ${room.gameId || "another game"}.`);
  if (room.status !== "lobby" && !room.members?.[user.uid]) throw new Error("This game has already started.");

  const members = orderedMembers(room);
  const existing = room.members?.[user.uid];
  if (!existing && members.length >= Number(room.maxPlayers || 4)) throw new Error("All seats are filled.");

  const seat = existing?.seat ?? members.length;
  await set(ref(db, `rooms/${normalized}/members/${user.uid}`), {
    uid: user.uid,
    nickname: nickname.trim() || `Player ${seat + 1}`,
    avatar: avatar || AVATARS[seat % AVATARS.length],
    seat,
    connected: true,
    isHost: room.hostUid === user.uid,
    isRobot: false,
    joinedAt: existing?.joinedAt || serverTimestamp(),
  });
  await onDisconnect(ref(db, `rooms/${normalized}/members/${user.uid}/connected`)).set(false);
  return normalized;
}

export async function addModularRobot(code, hostUid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) throw new Error("Room not found.");
  const room = snapshot.val();
  if (room.hostUid !== hostUid) throw new Error("Only the host can add robots.");
  if (room.status !== "lobby") throw new Error("Robots can only be added in the lobby.");
  const members = orderedMembers(room);
  if (members.length >= Number(room.maxPlayers || 4)) throw new Error("All seats are filled.");

  const robotIndex = members.filter((member) => member.isRobot).length;
  const uid = `robot-${Date.now()}-${robotIndex}`;
  await set(ref(db, `rooms/${code}/members/${uid}`), {
    uid,
    nickname: ROBOT_NAMES[robotIndex % ROBOT_NAMES.length],
    avatar: AVATARS[(robotIndex + 3) % AVATARS.length],
    seat: members.length,
    connected: true,
    isHost: false,
    isRobot: true,
    joinedAt: Date.now(),
  });
}

export function watchModularRoom(code, callback) {
  return onValue(ref(db, `rooms/${code}`), (snapshot) => {
    const room = snapshot.val();
    callback(room);
    if (room) recordCompletedRoom(room, room.gameId || "", code).catch(() => {});
  });
}

export async function startModularGame(code, hostUid, createGameState, minimumPlayers = 2) {
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room) return room;
    if (room.hostUid !== hostUid) return room;
    if (room.status !== "lobby") return room;
    const members = orderedMembers(room);
    if (members.length < minimumPlayers) return room;
    return {
      ...room,
      status: "playing",
      gameNumber: Number(room.gameNumber || 0) + 1,
      startedAt: Date.now(),
      gameState: createGameState(members, room.rules || {}),
    };
  }, { applyLocally: false });
  if (!result.committed || result.snapshot.val()?.status !== "playing") {
    throw new Error(`Add at least ${minimumPlayers} players or robots before starting.`);
  }
}

export async function applyModularAction(code, actorUid, action, reduceGameState) {
  let actionError = null;
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room || room.status !== "playing" || !room.members?.[actorUid]) return room;
    try {
      const nextState = reduceGameState(room.gameState, actorUid, action, orderedMembers(room), room.rules || {});
      actionError = null;
      return { ...room, gameState: nextState };
    } catch (error) {
      actionError = error;
      return;
    }
  }, { applyLocally: false });
  if (actionError) throw actionError;
  if (!result.committed) throw new Error("That move was not accepted. Refresh the table and try again.");
  return result.snapshot.val()?.gameState;
}

export async function patchModularRoom(code, patch) {
  await update(ref(db, `rooms/${code}`), patch);
}

export const MODULAR_AVATARS = AVATARS;
