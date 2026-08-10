import { hostOnly, initialScores, nowPlus, shuffle } from "../../platform/party/partyUtils";

const PAIRS = [
  ["cat", "raccoon"], ["dog", "wolf"], ["rabbit", "kangaroo"], ["cow", "moose"], ["duck", "goose"],
  ["shark", "dolphin"], ["robot", "astronaut"], ["wizard", "scientist"], ["pirate", "viking"], ["ghost", "bedsheet"],
  ["cupcake", "hamburger"], ["cactus", "pineapple"], ["castle", "haunted house"], ["bicycle", "motorcycle"], ["dragon", "dinosaur"],
];
const SCENARIOS = [
  { line: "trying to look innocent", twist: "Give it a tiny suspicious briefcase", suspectTwist: "Give it a giant bouquet of flowers" },
  { line: "caught doing something embarrassing", twist: "Add one witness in the corner", suspectTwist: "Add a getaway vehicle" },
  { line: "dressed for the world's worst vacation", twist: "Add terrible weather", suspectTwist: "Add an absurd luxury item" },
];

export const DOODLE_CASES = PAIRS.flatMap(([common, suspect]) => SCENARIOS.map((scenario, index) => ({
  id: `${common}-${index}`,
  common: `Draw a ${common} ${scenario.line}.`,
  suspect: `Draw a ${suspect} ${scenario.line}.`,
  base: `Draw a ${common} ${scenario.line}.`,
  twistCommon: scenario.twist,
  twistSuspect: scenario.suspectTwist,
})));

function chooseSuspects(players) {
  const count = players.length >= 8 ? 2 : 1;
  return shuffle(players).slice(0, count).map((p) => p.uid);
}

function caseState(players, round, scores, usedCases = []) {
  const candidates = DOODLE_CASES.filter((item) => !usedCases.includes(item.id));
  const selected = shuffle(candidates)[0] || DOODLE_CASES[round % DOODLE_CASES.length];
  const suspectUids = chooseSuspects(players);
  const commonOptions = shuffle([selected.common, ...DOODLE_CASES.filter((item) => item.id !== selected.id).slice(0, 8).map((item) => item.common)]).slice(0, 3);
  if (!commonOptions.includes(selected.common)) commonOptions[0] = selected.common;
  return {
    phase: round === 4 ? "finalBase" : "draw",
    round,
    case: selected,
    suspectUids,
    scores,
    usedCases: [...usedCases, selected.id],
    drawings: {},
    beforeDrawings: {},
    votes: {},
    suspectGuesses: {},
    commonOptions: shuffle(commonOptions),
    deadline: nowPlus(round === 4 ? 22000 : 36000),
  };
}

export function createDoodleAlibiState(players) {
  return caseState(players, 1, initialScores(players, { correctVotes: 0, escapes: 0 }), []);
}

function normalizeStrokes(strokes) {
  if (!Array.isArray(strokes)) return [];
  return strokes.slice(0, 300).map((stroke) => ({
    color: String(stroke?.color || "#ffffff").slice(0, 12),
    width: Math.max(1, Math.min(18, Number(stroke?.width || 4))),
    points: Array.isArray(stroke?.points) ? stroke.points.slice(0, 500).map((point) => [
      Math.max(0, Math.min(1, Number(point?.[0] || 0))),
      Math.max(0, Math.min(1, Number(point?.[1] || 0))),
    ]) : [],
  }));
}

function allDrawn(state, players, key = "drawings") { return players.every((p) => state[key]?.[p.uid]); }

function scoreCase(state, players) {
  const scores = structuredClone(state.scores);
  const suspects = new Set(state.suspectUids);
  const voteCounts = Object.fromEntries(state.suspectUids.map((uid) => [uid, 0]));
  Object.entries(state.votes || {}).forEach(([voterUid, targetUid]) => {
    if (suspects.has(targetUid)) {
      scores[voterUid].score += 200;
      scores[voterUid].correctVotes += 1;
      voteCounts[targetUid] = (voteCounts[targetUid] || 0) + 1;
    }
  });
  state.suspectUids.forEach((uid) => {
    const eligible = Math.max(1, players.length - 1);
    const escapedVotes = eligible - (voteCounts[uid] || 0);
    scores[uid].score += escapedVotes * 100;
    if ((voteCounts[uid] || 0) <= Math.floor(eligible / 3)) scores[uid].escapes += 1;
    if (state.suspectGuesses?.[uid] === state.case.common) scores[uid].score += 250;
  });
  return { ...state, phase: "result", scores, voteCounts, deadline: nowPlus(5200) };
}

export function reduceDoodleAlibiState(state, actor, action, players, _settings, hostUid) {
  if (!state || !action?.type) throw new Error("Invalid action.");

  if (action.type === "submitDrawing") {
    if (!["draw", "finalBase", "finalTwist"].includes(state.phase)) throw new Error("Drawing time is over.");
    const key = state.phase === "finalBase" ? "beforeDrawings" : "drawings";
    if (state[key]?.[actor.uid]) throw new Error("Your drawing is already locked.");
    const strokes = normalizeStrokes(action.strokes);
    if (!strokes.length) throw new Error("Draw something first.");
    return { ...state, [key]: { ...state[key], [actor.uid]: strokes } };
  }

  if (action.type === "voteSuspect") {
    if (state.phase !== "vote") throw new Error("Voting is closed.");
    if (state.votes?.[actor.uid]) throw new Error("Your vote is locked.");
    if (action.targetUid === actor.uid) throw new Error("You cannot accuse your own drawing.");
    if (!players.some((p) => p.uid === action.targetUid)) throw new Error("That drawing is not available.");
    return { ...state, votes: { ...state.votes, [actor.uid]: action.targetUid } };
  }

  if (action.type === "guessCommon") {
    if (state.phase !== "suspectGuess" || !state.suspectUids.includes(actor.uid)) throw new Error("Only suspects get this guess.");
    if (state.suspectGuesses?.[actor.uid]) throw new Error("Your guess is locked.");
    if (!state.commonOptions.includes(action.guess)) throw new Error("Choose one of the prompt options.");
    return { ...state, suspectGuesses: { ...state.suspectGuesses, [actor.uid]: action.guess } };
  }

  if (action.type === "hostAdvance") {
    hostOnly(actor, hostUid);
    if (state.phase === "draw") {
      if (!allDrawn(state, players) && Date.now() < state.deadline && !action.force) throw new Error("Artists are still drawing.");
      return { ...state, phase: "gallery", deadline: nowPlus(7000) };
    }
    if (state.phase === "finalBase") {
      if (!allDrawn(state, players, "beforeDrawings") && Date.now() < state.deadline && !action.force) throw new Error("Artists are still drawing the base image.");
      return { ...state, phase: "finalTwist", drawings: {}, deadline: nowPlus(17000) };
    }
    if (state.phase === "finalTwist") {
      if (!allDrawn(state, players) && Date.now() < state.deadline && !action.force) throw new Error("Artists are still adding the twist.");
      return { ...state, phase: "gallery", deadline: nowPlus(8000) };
    }
    if (state.phase === "gallery") return { ...state, phase: "vote", votes: {}, deadline: nowPlus(26000) };
    if (state.phase === "vote") {
      const all = players.every((p) => state.votes?.[p.uid]);
      if (!all && Date.now() < state.deadline && !action.force) throw new Error("Detectives are still voting.");
      return { ...state, phase: "suspectGuess", suspectGuesses: {}, deadline: nowPlus(14000) };
    }
    if (state.phase === "suspectGuess") {
      const all = state.suspectUids.every((uid) => state.suspectGuesses?.[uid]);
      if (!all && Date.now() < state.deadline && !action.force) throw new Error("Suspects are still guessing the common prompt.");
      return scoreCase(state, players);
    }
    if (state.phase === "result") {
      if (state.round >= 4) return { ...state, phase: "final", deadline: null };
      return caseState(players, state.round + 1, state.scores, state.usedCases);
    }
    throw new Error("There is nothing to advance right now.");
  }

  throw new Error("Unknown Doodle Alibi action.");
}

export const doodleAlibiDefinition = {
  id: "doodlealibi",
  name: "Doodle Alibi",
  eyebrow: "Draw. Accuse. Get away with it.",
  description: "A phone-drawing social deduction game where one or two artists receive a subtly different assignment.",
  minPlayers: 4,
  maxPlayers: 12,
  introVideo: "/media/doodle-alibi-intro.mp4",
  music: "doodlealibi",
  defaultSettings: {},
  createGameState: createDoodleAlibiState,
  reduceGameState: reduceDoodleAlibiState,
};
