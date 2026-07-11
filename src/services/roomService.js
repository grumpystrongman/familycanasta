
import {
  child,
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { db } from "../firebase";
import { DEFAULT_RULES, dealHand, nextDealer, randomDealer } from "../game/engine";

const avatars = ["🦊","🐻","🦉","🐙","🦁","🐼","🐯","🦄","🐸","🤠"];

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export async function createRoom({ user, nickname, avatar, rules = DEFAULT_RULES, meetLink = "" }) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = roomCode();
    const directoryRef = ref(db, `roomDirectory/${code}`);
    const directoryResult = await runTransaction(directoryRef, (current) => {
      if (current) return;
      return { roomCode: code, createdAt: Date.now() };
    });

    if (!directoryResult.committed) continue;

    const member = {
      uid: user.uid,
      nickname: nickname || "Host",
      avatar: avatar || avatars[0],
      team: 0,
      seat: 0,
      connected: true,
      joinedAt: serverTimestamp(),
      isHost: true,
    };

    const room = {
      roomCode: code,
      hostUid: user.uid,
      status: "lobby",
      createdAt: serverTimestamp(),
      rules,
      meetLink,
      dealerIndex: null,
      handNumber: 0,
      members: { [user.uid]: member },
      publicState: {
        phase: "lobby",
        lastAction: "Waiting for players.",
      },
    };

    await set(ref(db, `rooms/${code}`), room);
    await onDisconnect(ref(db, `rooms/${code}/members/${user.uid}/connected`)).set(false);
    return code;
  }

  throw new Error("Could not create a unique room code.");
}

export async function joinRoom({ code, user, nickname, avatar }) {
  const normalized = code.trim().toUpperCase();
  const directory = await get(ref(db, `roomDirectory/${normalized}`));
  if (!directory.exists()) throw new Error("Room code not found.");

  const roomSnapshot = await get(ref(db, `rooms/${normalized}`));
  if (!roomSnapshot.exists()) throw new Error("The room has expired.");

  const room = roomSnapshot.val();
  const existingMembers = Object.values(room.members || {});
  const existing = room.members?.[user.uid];
  const seat = existing?.seat ?? existingMembers.length;

  if (!existing && existingMembers.length >= 6) {
    throw new Error("This room is full.");
  }

  const team = existing?.team ?? (seat % 2);
  const member = {
    uid: user.uid,
    nickname: nickname || `Player ${seat + 1}`,
    avatar: avatar || avatars[seat % avatars.length],
    team,
    seat,
    connected: true,
    joinedAt: existing?.joinedAt || serverTimestamp(),
    isHost: room.hostUid === user.uid,
  };

  await set(ref(db, `rooms/${normalized}/members/${user.uid}`), member);
  await onDisconnect(ref(db, `rooms/${normalized}/members/${user.uid}/connected`)).set(false);
  return normalized;
}

export function watchRoom(code, callback) {
  return onValue(ref(db, `rooms/${code}`), (snapshot) => callback(snapshot.val()));
}

export function watchPrivateHand(code, uid, callback) {
  return onValue(ref(db, `rooms/${code}/privateHands/${uid}`), (snapshot) => callback(snapshot.val() || []));
}

export async function updateMember(code, uid, patch) {
  await update(ref(db, `rooms/${code}/members/${uid}`), patch);
}

export async function leaveRoom(code, uid) {
  await remove(ref(db, `rooms/${code}/members/${uid}`));
}

export async function sendMessage(code, member, text) {
  const value = text.trim();
  if (!value) return;

  const messageRef = push(ref(db, `rooms/${code}/messages`));
  await set(messageRef, {
    uid: member.uid,
    nickname: member.nickname,
    avatar: member.avatar,
    text: value.slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

export async function startOnlineGame(code, uid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) throw new Error("Room not found.");

  const room = snapshot.val();
  if (room.hostUid !== uid) throw new Error("Only the host can start the game.");

  const players = Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
  if (players.length < 2) throw new Error("At least two players are required.");

  const dealerIndex = room.dealerIndex == null
    ? randomDealer(players.map((p) => p.uid))
    : nextDealer(room.dealerIndex, players.length);

  const dealt = dealHand({
    players,
    rules: room.rules || DEFAULT_RULES,
    dealerIndex,
    existingScores: room.publicState?.teamScores || [0, 0],
  });

  const updates = {
    status: "playing",
    dealerIndex,
    handNumber: (room.handNumber || 0) + 1,
    publicState: {
      ...dealt.publicState,
      handNumber: (room.handNumber || 0) + 1,
    },
    stock: dealt.stock,
    privateHands: dealt.privateHands,
  };

  await update(ref(db, `rooms/${code}`), updates);
}

export async function advanceDealAnimation(code, uid, index, final = false) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) return;
  const room = snapshot.val();
  if (room.hostUid !== uid) return;

  await update(ref(db, `rooms/${code}/publicState`), {
    dealAnimationIndex: index,
    phase: final ? "playing" : "dealing",
    lastAction: final ? "The first turn is ready." : "Dealing cards.",
  });
}
