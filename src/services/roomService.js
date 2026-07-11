import {
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
const robotNames = ["Ruby", "Milo", "Hazel", "Otto", "Cleo", "Finn"];

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
      isRobot: false,
    };

    await set(ref(db, `rooms/${code}`), {
      roomCode: code,
      hostUid: user.uid,
      status: "lobby",
      createdAt: serverTimestamp(),
      rules: { ...rules, teamMode: true, playersPerTeam: 2 },
      meetLink,
      dealerIndex: null,
      handNumber: 0,
      teamBoardKeepers: { 0: user.uid, 1: "" },
      members: { [user.uid]: member },
      publicState: { phase: "lobby", lastAction: "Waiting for players." },
    });
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
  if (!existing && existingMembers.length >= 4) throw new Error("This team game already has four seats filled.");

  const teamCounts = [0, 1].map((team) => existingMembers.filter((m) => m.team === team).length);
  const team = existing?.team ?? (teamCounts[0] <= teamCounts[1] ? 0 : 1);
  const member = {
    uid: user.uid,
    nickname: nickname || `Player ${seat + 1}`,
    avatar: avatar || avatars[seat % avatars.length],
    team,
    seat,
    connected: true,
    joinedAt: existing?.joinedAt || serverTimestamp(),
    isHost: room.hostUid === user.uid,
    isRobot: false,
  };

  await set(ref(db, `rooms/${normalized}/members/${user.uid}`), member);
  const keeper = room.teamBoardKeepers?.[team];
  if (!keeper) await set(ref(db, `rooms/${normalized}/teamBoardKeepers/${team}`), user.uid);
  await onDisconnect(ref(db, `rooms/${normalized}/members/${user.uid}/connected`)).set(false);
  return normalized;
}

export async function addRobot(code, hostUid, team, difficulty = "standard") {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) throw new Error("Room not found.");
  const room = snapshot.val();
  if (room.hostUid !== hostUid) throw new Error("Only the host can add robots.");
  const members = Object.values(room.members || {});
  if (members.length >= 4) throw new Error("All four seats are filled.");
  if (members.filter((m) => m.team === team).length >= 2) throw new Error("That team already has two players.");

  const robotNumber = members.filter((m) => m.isRobot).length;
  const uid = `robot-${Date.now()}-${robotNumber}`;
  const robot = {
    uid,
    nickname: robotNames[robotNumber % robotNames.length],
    avatar: avatars[(robotNumber + 4) % avatars.length],
    team,
    seat: members.length,
    connected: true,
    joinedAt: Date.now(),
    isHost: false,
    isRobot: true,
    difficulty,
  };
  const updates = { [`members/${uid}`]: robot };
  if (!room.teamBoardKeepers?.[team]) updates[`teamBoardKeepers/${team}`] = uid;
  await update(ref(db, `rooms/${code}`), updates);
  return uid;
}

export async function removeRobot(code, hostUid, robotUid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) return;
  const room = snapshot.val();
  if (room.hostUid !== hostUid) throw new Error("Only the host can remove robots.");
  if (!room.members?.[robotUid]?.isRobot) throw new Error("That seat is not a robot.");
  const team = room.members[robotUid].team;
  const updates = { [`members/${robotUid}`]: null };
  if (room.teamBoardKeepers?.[team] === robotUid) {
    const replacement = Object.values(room.members).find((m) => m.uid !== robotUid && m.team === team);
    updates[`teamBoardKeepers/${team}`] = replacement?.uid || "";
  }
  await update(ref(db, `rooms/${code}`), updates);
}

export async function setTeamBoardKeeper(code, hostUid, team, memberUid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) throw new Error("Room not found.");
  const room = snapshot.val();
  if (room.hostUid !== hostUid) throw new Error("Only the host can choose the board keeper.");
  if (room.members?.[memberUid]?.team !== team) throw new Error("The board keeper must be on that team.");
  await set(ref(db, `rooms/${code}/teamBoardKeepers/${team}`), memberUid);
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
  if (players.length !== 4) throw new Error("A team game needs exactly four seats. Add people or robots.");
  const team0 = players.filter((p) => p.team === 0);
  const team1 = players.filter((p) => p.team === 1);
  if (team0.length !== 2 || team1.length !== 2) throw new Error("Each team must have exactly two players.");
  if (!room.teamBoardKeepers?.[0] || !room.teamBoardKeepers?.[1]) throw new Error("Choose one board keeper for each team.");

  const dealerIndex = room.dealerIndex == null
    ? randomDealer(players.map((p) => p.uid))
    : nextDealer(room.dealerIndex, players.length);
  const dealt = dealHand({
    players,
    rules: room.rules || DEFAULT_RULES,
    dealerIndex,
    existingScores: room.publicState?.teamScores || [0, 0],
  });

  await update(ref(db, `rooms/${code}`), {
    status: "playing",
    dealerIndex,
    handNumber: (room.handNumber || 0) + 1,
    publicState: {
      ...dealt.publicState,
      handNumber: (room.handNumber || 0) + 1,
      teamBoards: { 0: [], 1: [] },
      boardKeepers: room.teamBoardKeepers,
    },
    stock: dealt.stock,
    privateHands: dealt.privateHands,
  });
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
