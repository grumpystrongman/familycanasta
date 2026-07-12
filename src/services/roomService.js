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
import {
  DEFAULT_RULES,
  dealHand,
  nextDealer,
  randomDealer,
  teamRecord,
  teamSeatTargets,
} from "../game/engine";
import { executeRobotTurn } from "../game/botEngine";

const avatars = ["🦊","🐻","🦉","🐙","🦁","🐼","🐯","🦄","🐸","🤠"];
const robotNames = ["Ruby", "Milo", "Hazel", "Otto", "Cleo", "Finn", "Ada", "Baxter"];

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function getTeamCount(room) {
  const totalPlayers = getTotalPlayers(room);
  return Math.min(3, Math.max(2, Math.min(totalPlayers, Number(room.rules?.teamCount || 2))));
}

function getTotalPlayers(room) {
  const legacy = Number(room.rules?.teamCount || 2) * Number(room.rules?.playersPerTeam || 1);
  return Math.min(6, Math.max(2, Number(room.rules?.totalPlayers || legacy || 2)));
}

function getTeamCapacities(room) {
  return teamSeatTargets(getTotalPlayers(room), getTeamCount(room));
}

function chooseOpenTeam(members, capacities) {
  const counts = capacities.map(
    (_, team) => members.filter((member) => Number(member.team) === team).length,
  );
  const valid = counts
    .map((count, team) => ({ count, team, capacity: capacities[team] }))
    .filter(({ count, capacity }) => count < capacity);
  if (!valid.length) return 0;
  valid.sort((a, b) => (a.count / a.capacity) - (b.count / b.capacity) || a.count - b.count || a.team - b.team);
  return valid[0].team;
}

function normalizeRules(rules) {
  const legacyPlayers = Number(rules.teamCount || 2) * Number(rules.playersPerTeam || 1);
  const totalPlayers = Math.min(6, Math.max(2, Number(rules.totalPlayers || legacyPlayers || 2)));
  const teamCount = Math.min(3, Math.max(2, Math.min(totalPlayers, Number(rules.teamCount || 2))));
  const capacities = teamSeatTargets(totalPlayers, teamCount);
  return {
    ...DEFAULT_RULES,
    ...rules,
    playMode: "flexible",
    totalPlayers,
    teamCount,
    playersPerTeam: Math.max(...capacities),
    deckCount: totalPlayers > 4 ? Math.max(3, Number(rules.deckCount || 3)) : Number(rules.deckCount || 2),
    cardsPerPlayer: Number(rules.cardsPerPlayer || (totalPlayers === 2 ? 15 : 11)),
  };
}

export async function createRoom({ user, nickname, avatar, rules = DEFAULT_RULES, meetLink = "" }) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = roomCode();
    const directoryResult = await runTransaction(ref(db, `roomDirectory/${code}`), (current) => {
      if (current) return;
      return { roomCode: code, createdAt: Date.now() };
    });
    if (!directoryResult.committed) continue;

    const normalizedRules = normalizeRules(rules);
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
  const totalPlayers = getTotalPlayers(room);
  const capacities = getTeamCapacities(room);
  if (!existing && existingMembers.length >= totalPlayers) throw new Error("All seats are filled.");

  const seat = existing?.seat ?? existingMembers.length;
  const team = existing?.team ?? chooseOpenTeam(existingMembers, capacities);
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
  if (!room.teamBoardKeepers?.[team]) {
    await set(ref(db, `rooms/${normalized}/teamBoardKeepers/${team}`), user.uid);
  }
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
  const capacities = getTeamCapacities(room);
  const totalPlayers = getTotalPlayers(room);
  if (team < 0 || team >= teamCount) throw new Error("That team does not exist.");
  const members = Object.values(room.members || {});
  if (members.length >= totalPlayers) throw new Error("All seats are filled.");
  if (members.filter((member) => Number(member.team) === Number(team)).length >= capacities[team]) {
    throw new Error("That team is already full.");
  }

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
    const replacement = Object.values(room.members).find((member) => member.uid !== robotUid && Number(member.team) === Number(team));
    updates[`teamBoardKeepers/${team}`] = replacement?.uid || "";
  }
  await update(ref(db, `rooms/${code}`), updates);
}

export async function setTeamBoardKeeper(code, hostUid, team, memberUid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) throw new Error("Room not found.");
  const room = snapshot.val();
  if (room.hostUid !== hostUid) throw new Error("Only the host can choose the board keeper.");
  if (Number(room.members?.[memberUid]?.team) !== Number(team)) throw new Error("The board keeper must be on that team.");
  await set(ref(db, `rooms/${code}/teamBoardKeepers/${team}`), memberUid);
}

export function watchRoom(code, callback) {
  return onValue(ref(db, `rooms/${code}`), (snapshot) => callback(snapshot.val()));
}

export function watchPrivateHand(code, uid, callback) {
  return onValue(ref(db, `rooms/${code}/privateHands/${uid}`), (snapshot) => callback(snapshot.val() || []));
}

export async function reconnectMember(code, uid) {
  const memberRef = ref(db, `rooms/${code}/members/${uid}`);
  const snapshot = await get(memberRef);
  if (!snapshot.exists()) return false;
  const member = snapshot.val();
  if (member.connected === false) {
    await update(memberRef, { connected: true, rejoinedAt: serverTimestamp() });
    await set(push(ref(db, `rooms/${code}/messages`)), {
      uid: "system",
      nickname: "Game",
      avatar: "↻",
      text: `${member.nickname || "A player"} rejoined the table.`,
      scope: "system",
      createdAt: serverTimestamp(),
    });
  }
  await onDisconnect(ref(db, `rooms/${code}/members/${uid}/connected`)).set(false);
  return true;
}

export async function updateMember(code, uid, patch) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  const room = snapshot.val();
  if (!room || room.status !== "lobby") throw new Error("Teams cannot be changed after the game starts.");
  if (patch.team !== undefined) {
    const team = Number(patch.team);
    const teamCount = getTeamCount(room);
    const capacities = getTeamCapacities(room);
    if (team < 0 || team >= teamCount) throw new Error("That team does not exist.");
    const occupied = Object.values(room.members || {}).filter(
      (member) => member.uid !== uid && Number(member.team) === team,
    ).length;
    if (occupied >= capacities[team]) throw new Error("That team is already full.");
  }
  await update(ref(db, `rooms/${code}/members/${uid}`), patch);
}

export async function leaveRoom(code, uid) {
  const snapshot = await get(ref(db, `rooms/${code}/members/${uid}`));
  const member = snapshot.val();
  if (member) {
    await set(push(ref(db, `rooms/${code}/messages`)), {
      uid: "system",
      nickname: "Game",
      avatar: "!",
      text: `${member.nickname || "A player"} left the table.`,
      scope: "system",
      createdAt: serverTimestamp(),
    });
  }
  await remove(ref(db, `rooms/${code}/members/${uid}`));
}

export async function sendMessage(code, member, text, scope = "table") {
  const value = text.trim();
  if (!value) return;
  const normalizedScope = scope === "team" ? "team" : "table";
  await set(push(ref(db, `rooms/${code}/messages`)), {
    uid: member.uid,
    nickname: member.nickname,
    avatar: member.avatar,
    text: value.slice(0, 500),
    scope: normalizedScope,
    team: normalizedScope === "team" ? Number(member.team) : null,
    createdAt: serverTimestamp(),
  });
}

export async function startOnlineGame(code, uid) {
  const snapshot = await get(ref(db, `rooms/${code}`));
  if (!snapshot.exists()) throw new Error("Room not found.");
  const room = snapshot.val();
  if (room.hostUid !== uid) throw new Error("Only the host can start the game.");

  const teamCount = getTeamCount(room);
  const capacities = getTeamCapacities(room);
  const players = Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
  const requiredPlayers = getTotalPlayers(room);
  if (players.length !== requiredPlayers) {
    throw new Error(`This format needs exactly ${requiredPlayers} players. Add people or robots.`);
  }
  for (let team = 0; team < teamCount; team += 1) {
    if (players.filter((player) => Number(player.team) === team).length !== capacities[team]) {
      throw new Error(`Team ${team + 1} needs exactly ${capacities[team]} player${capacities[team] === 1 ? "" : "s"}.`);
    }
    if (!room.teamBoardKeepers?.[team]) throw new Error("Choose a board keeper for every team.");
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
    const next = executeRobotTurn(room);
    if (next?.publicState) {
      next.publicState.turnDrawnUid = null;
      next.publicState.lastDiscardedUid = active.uid;
    }
    return next;
  }, { applyLocally: false });
  return result.committed;
}
