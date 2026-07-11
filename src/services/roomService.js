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
import { DEFAULT_RULES, dealHand, nextDealer, randomDealer, teamRecord } from "../game/engine";
import { executeRobotTurn } from "../game/botEngine";

const avatars = ["🦊","🐻","🦉","🐙","🦁","🐼","🐯","🦄","🐸","🤠"];
const robotNames = ["Ruby", "Milo", "Hazel", "Otto", "Cleo", "Finn", "Ada", "Baxter"];

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function getTeamCount(room) {
  return Math.min(3, Math.max(2, Number(room.rules?.teamCount || 2)));
}

function chooseOpenTeam(members, teamCount) {
  const counts = Array.from({ length: teamCount }, (_, team) => members.filter((member) => member.team === team).length);
  const minimum = Math.min(...counts);
  return counts.findIndex((count) => count === minimum);
}

export async function createRoom({ user, nickname, avatar, rules = DEFAULT_RULES, meetLink = "" }) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = roomCode();
    const directoryResult = await runTransaction(ref(db, `roomDirectory/${code}`), (current) => {
      if (current) return;
      return { roomCode: code, createdAt: Date.now() };
    });
    if (!directoryResult.committed) continue;

    const teamCount = Math.min(3, Math.max(2, Number(rules.teamCount || 2)));
    const normalizedRules = {
      ...DEFAULT_RULES,
      ...rules,
      teamCount,
      playersPerTeam: 2,
      deckCount: teamCount === 3 ? Math.max(3, Number(rules.deckCount || 3)) : Number(rules.deckCount || 2),
    };
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
      rules: normalizedRules,
      meetLink,
      dealerIndex: null,
      handNumber: 0,
      teamBoardKeepers: { 0: user.uid },
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
  if (room.status !== "lobby" && !room.members?.[user.uid]) throw new Error("This game has already started.");

  const existingMembers = Object.values(room.members || {});
  const existing = room.members?.[user.uid];
  const teamCount = getTeamCount(room);
  const maxPlayers = teamCount * 2;
  if (!existing && existingMembers.length >= maxPlayers) throw new Error("All team seats are filled.");

  const seat = existing?.seat ?? existingMembers.length;
  const team = existing?.team ?? chooseOpenTeam(existingMembers, teamCount);
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
  if (!room.teamBoardKeepers?.[team]) await set(ref(db, `rooms/${normalized}/teamBoardKeepers/${team}`), user.uid);
  await onDisconnect(ref(db, `rooms/${normalized}/members/${user.uid}/connected`)).set(false);
  return normalized;
}

export async function addRobot(code, hostUid, team, difficulty = "standard") {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) throw new Error("Room not found.");
  const room = snapshot.val();
  if (room.hostUid !== hostUid) throw new Error("Only the host can add robots.");
  if (room.status !== "lobby") throw new Error("Robots can only be changed before the game starts.");

  const teamCount = getTeamCount(room);
  if (team < 0 || team >= teamCount) throw new Error("That team does not exist.");
  const members = Object.values(room.members || {});
  if (members.length >= teamCount * 2) throw new Error("All team seats are filled.");
  if (members.filter((member) => member.team === team).length >= 2) throw new Error("That team already has two players.");

  const robotNumber = members.filter((member) => member.isRobot).length;
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
    const replacement = Object.values(room.members).find((member) => member.uid !== robotUid && member.team === team);
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
  const snapshot = await get(ref(db, `rooms/${code}`));
  const room = snapshot.val();
  if (!room || room.status !== "lobby") throw new Error("Teams cannot be changed after the game starts.");
  if (patch.team !== undefined) {
    const team = Number(patch.team);
    if (team < 0 || team >= getTeamCount(room)) throw new Error("That team does not exist.");
    const occupied = Object.values(room.members || {}).filter((member) => member.uid !== uid && member.team === team).length;
    if (occupied >= 2) throw new Error("That team already has two players.");
  }
  await update(ref(db, `rooms/${code}/members/${uid}`), patch);
}

export async function leaveRoom(code, uid) {
  await remove(ref(db, `rooms/${code}/members/${uid}`));
}

export async function sendMessage(code, member, text) {
  const value = text.trim();
  if (!value) return;
  await set(push(ref(db, `rooms/${code}/messages`)), {
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

  const teamCount = getTeamCount(room);
  const players = Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
  if (players.length !== teamCount * 2) throw new Error(`This format needs exactly ${teamCount * 2} seats. Add people or robots.`);
  for (let team = 0; team < teamCount; team += 1) {
    if (players.filter((player) => player.team === team).length !== 2) throw new Error("Every team must have exactly two players.");
    if (!room.teamBoardKeepers?.[team]) throw new Error("Choose one board keeper for every team.");
  }

  const dealerIndex = room.dealerIndex == null
    ? randomDealer(players.map((player) => player.uid))
    : nextDealer(room.dealerIndex, players.length);
  const scores = room.publicState?.teamScores || Array.from({ length: teamCount }, () => 0);
  const dealt = dealHand({ players, rules: room.rules || DEFAULT_RULES, dealerIndex, existingScores: scores });

  await update(ref(db, `rooms/${code}`), {
    status: "playing",
    dealerIndex,
    handNumber: (room.handNumber || 0) + 1,
    publicState: {
      ...dealt.publicState,
      handNumber: (room.handNumber || 0) + 1,
      teamBoards: teamRecord(teamCount, () => []),
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

export async function runRobotTurn(code, hostUid) {
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room || room.hostUid !== hostUid || room.status !== "playing" || room.publicState?.phase !== "playing") return room;
    const players = Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
    const active = players[Number(room.publicState.currentPlayerIndex || 0)];
    if (!active?.isRobot) return room;
    return executeRobotTurn(room);
  }, { applyLocally: false });
  return result.committed;
}
