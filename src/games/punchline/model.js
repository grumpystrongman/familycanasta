import { cleanPartyText, hostOnly, initialScores, nowPlus, shuffle } from "../../platform/party/partyUtils";

const PROMPTS = [
  "The least reassuring thing to hear from your plumber is ____.",
  "A terrible name for a neighborhood watch group: ____.",
  "The one item nobody wants to see at a yard sale: ____.",
  "The worst thing to discover inside a sofa cushion: ____.",
  "A suspicious new feature on a smart refrigerator: ____.",
  "The real reason your neighbor owns twelve traffic cones: ____.",
  "A bad thing to yell while carrying a birthday cake: ____.",
  "The least useful item in an emergency kit: ____.",
  "The strangest reason to call in sick: ____.",
  "A terrible slogan for a laundromat: ____.",
  "The meeting could have been an email, but the email could have been ____.",
  "A corporate title that should never exist: Vice President of ____.",
  "The worst surprise inside the office supply closet: ____.",
  "A suspicious phrase to hear during your annual review: ____.",
  "The least motivating poster for a break room: ____.",
  "A new mandatory team-building exercise involving ____.",
  "The one thing HR absolutely does not want in the suggestion box: ____.",
  "A terrible name for the company wellness program: ____.",
  "The first sign the new intern may actually be three raccoons: ____.",
  "A calendar invite subject line that causes instant panic: ____.",
  "The flavor nobody asked for in a potato chip: ____.",
  "A restaurant special that should come with legal counsel: ____.",
  "The worst secret ingredient in grandma's casserole: ____.",
  "A suspicious thing for a waiter to whisper before serving dessert: ____.",
  "The food truck nobody should operate out of a hearse: ____.",
  "A terrible name for an artisanal hot sauce: ____.",
  "The least appetizing thing to hear sizzling in a kitchen: ____.",
  "A new cereal mascot that would terrify children: ____.",
  "The one topping that finally ruins pizza for everyone: ____.",
  "A cooking show challenge guaranteed to end badly: ____.",
  "The worst thing your AI assistant could say at 3:00 a.m.: ____.",
  "A feature nobody wants added to their doorbell camera: ____.",
  "The password hint that reveals far too much: ____.",
  "A terrible name for a dating app made by accountants: ____.",
  "The notification that should never appear on a self-driving car: ____.",
  "The weirdest thing your printer could demand before printing: ____.",
  "A smart-home command that definitely summons something: ____.",
  "The app update note that would make you uninstall immediately: ____.",
  "A bad voice command to accidentally send to every device in your house: ____.",
  "The least useful feature on a $3,000 laptop: ____.",
  "A terrible announcement from the pilot just after takeoff: ____.",
  "The least comforting name for a cruise ship: ____.",
  "A vacation package that should cost negative money: ____.",
  "The worst thing to find already sitting in your hotel bathtub: ____.",
  "A suspicious souvenir from a roadside attraction: ____.",
  "A rental-car warning light nobody has ever seen before: ____.",
  "The least romantic destination for a honeymoon: ____.",
  "A TSA question that would make the whole line turn around: ____.",
  "The worst thing your GPS could say in the middle of nowhere: ____.",
  "A terrible name for a budget airline: ____.",
  "The worst sentence to begin a first date with: ____.",
  "A gift that says 'I remembered, technically': ____.",
  "The least convincing excuse for forgetting an anniversary: ____.",
  "A terrible couples costume idea: ____ and ____.",
  "The one phrase guaranteed to start an argument during furniture assembly: ____.",
  "A strange thing to put in a wedding vow: ____.",
  "The worst thing to learn from your partner's family group chat: ____.",
  "A dating profile hobby that raises immediate questions: ____.",
  "The least romantic thing to carve into a tree: ____.",
  "A terrible pet name for someone you love: ____.",
  "The ghost haunting your house is mostly upset about ____.",
  "A terrible final message to find written on a foggy mirror: ____.",
  "The monster under your bed has one surprisingly normal complaint: ____.",
  "A haunted-house attraction that went way too far by adding ____.",
  "The least threatening thing for a vampire to hiss: ____.",
  "The weirdest item to discover in a witch's garage: ____.",
  "A zombie apocalypse survival tip that seems suspiciously specific: ____.",
  "The worst thing to hear your scarecrow say after midnight: ____.",
  "A terrible name for a paranormal investigation company: ____.",
  "The one thing a demon absolutely refuses to possess: ____.",
  "If clouds had customer reviews, one complaint would be ____.",
  "The moon's side hustle is secretly ____.",
  "A terrible law passed by the Kingdom of Ducks: ____.",
  "The first product sold by time travelers at a flea market: ____.",
  "The weirdest reason gravity might take a day off: ____.",
  "A terrible thing for your reflection to do before you do it: ____.",
  "The new national anthem for squirrels is mostly about ____.",
  "A suspicious message hidden inside every fortune cookie: ____.",
  "The universe's customer-service department keeps getting complaints about ____.",
  "A strange object to find at the center of the Earth: ____.",
];

function standardRound(players, round, scores, highlights) {
  const chosen = shuffle(PROMPTS).slice(0, players.length);
  const prompts = Object.fromEntries(chosen.map((text, index) => [`r${round}p${index}`, text]));
  const promptIds = Object.keys(prompts);
  const assignments = {};
  const matchups = [];
  players.forEach((player, index) => {
    const own = promptIds[index];
    const previous = promptIds[(index - 1 + promptIds.length) % promptIds.length];
    assignments[player.uid] = [own, previous];
    matchups.push({ promptId: own, authors: [players[index].uid, players[(index + 1) % players.length].uid] });
  });
  return {
    phase: "answer",
    round,
    prompts,
    assignments,
    matchups,
    submissions: {},
    votes: {},
    matchupIndex: 0,
    result: null,
    scores,
    highlights,
    deadline: nowPlus(50000),
  };
}

function finaleRound(players, scores, highlights) {
  const prompt = shuffle(PROMPTS)[0];
  return {
    phase: "finaleAnswer",
    round: 4,
    finalePrompt: `FINAL CROWD PLEASER — ${prompt}`,
    submissions: {},
    rankings: {},
    scores,
    highlights,
    deadline: nowPlus(50000),
  };
}

export function createPunchlineGameState(players) {
  return standardRound(players, 1, initialScores(players), []);
}

function hasAllAnswers(state, players) {
  return players.every((player) => (state.assignments?.[player.uid] || []).every((promptId) => state.submissions?.[player.uid]?.[promptId]));
}
function currentMatchup(state) { return state.matchups?.[state.matchupIndex] || null; }

function finishVote(state, players) {
  const matchup = currentMatchup(state);
  if (!matchup) return state;
  const counts = Object.fromEntries(matchup.authors.map((uid) => [uid, 0]));
  Object.values(state.votes || {}).forEach((uid) => { if (counts[uid] != null) counts[uid] += 1; });
  const eligible = Math.max(1, players.filter((p) => !matchup.authors.includes(p.uid)).length);
  const nextScores = structuredClone(state.scores);
  matchup.authors.forEach((uid) => {
    const count = counts[uid] || 0;
    const landslide = count === eligible && eligible > 1 ? 250 : 0;
    nextScores[uid].score += count * 100 + landslide;
  });
  const winnerUid = matchup.authors.slice().sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
  const answer = state.submissions?.[winnerUid]?.[matchup.promptId] || "No answer";
  const highlight = { answer, authorUid: winnerUid, votes: counts[winnerUid] || 0, prompt: state.prompts[matchup.promptId] };
  return {
    ...state,
    phase: "result",
    scores: nextScores,
    result: { matchup, counts, eligible },
    highlights: [...(state.highlights || []), highlight],
    deadline: nowPlus(4500),
  };
}

function beginNextMatchupOrRound(state, players) {
  const nextIndex = state.matchupIndex + 1;
  if (nextIndex < state.matchups.length) {
    return { ...state, phase: "vote", matchupIndex: nextIndex, votes: {}, result: null, deadline: nowPlus(22000) };
  }
  if (state.round < 3) return standardRound(players, state.round + 1, state.scores, state.highlights || []);
  return finaleRound(players, state.scores, state.highlights || []);
}

function scoreFinale(state) {
  const nextScores = structuredClone(state.scores);
  const points = [300, 200, 100];
  Object.entries(state.rankings || {}).forEach(([voterUid, ranking]) => {
    (ranking || []).slice(0, 3).forEach((uid, index) => {
      if (uid !== voterUid && nextScores[uid]) nextScores[uid].score += points[index];
    });
  });
  return { ...state, phase: "final", scores: nextScores, deadline: null };
}

export function reducePunchlineGameState(state, actor, action, players, settings, hostUid) {
  if (!state || !action?.type) throw new Error("Invalid action.");
  const profanityFilter = settings?.profanityFilter !== false;

  if (action.type === "submitAnswer") {
    if (state.phase !== "answer") throw new Error("Answers are closed.");
    const allowed = state.assignments?.[actor.uid] || [];
    if (!allowed.includes(action.promptId)) throw new Error("That prompt is not assigned to you.");
    if (state.submissions?.[actor.uid]?.[action.promptId]) throw new Error("That answer is already locked.");
    const answer = cleanPartyText(action.answer, profanityFilter);
    if (!answer) throw new Error("Type an answer first.");
    return {
      ...state,
      submissions: {
        ...state.submissions,
        [actor.uid]: { ...(state.submissions?.[actor.uid] || {}), [action.promptId]: answer.slice(0, 90) },
      },
    };
  }

  if (action.type === "vote") {
    if (state.phase !== "vote") throw new Error("Voting is closed.");
    const matchup = currentMatchup(state);
    if (!matchup?.authors.includes(action.choice)) throw new Error("That answer is not in this matchup.");
    if (matchup.authors.includes(actor.uid)) throw new Error("You cannot vote in your own matchup.");
    if (state.votes?.[actor.uid]) throw new Error("Your vote is already locked.");
    return { ...state, votes: { ...state.votes, [actor.uid]: action.choice } };
  }

  if (action.type === "submitFinale") {
    if (state.phase !== "finaleAnswer") throw new Error("Final answers are closed.");
    if (state.submissions?.[actor.uid]) throw new Error("Your final answer is already locked.");
    const answer = cleanPartyText(action.answer, profanityFilter);
    if (!answer) throw new Error("Type an answer first.");
    return { ...state, submissions: { ...state.submissions, [actor.uid]: answer.slice(0, 100) } };
  }

  if (action.type === "rankFinale") {
    if (state.phase !== "finaleVote") throw new Error("Final voting is closed.");
    if (state.rankings?.[actor.uid]) throw new Error("Your ranking is already locked.");
    const ranking = [...new Set(action.ranking || [])].filter((uid) => uid !== actor.uid && state.submissions?.[uid]).slice(0, 3);
    if (!ranking.length) throw new Error("Choose at least one favorite.");
    return { ...state, rankings: { ...state.rankings, [actor.uid]: ranking } };
  }

  if (action.type === "hostAdvance") {
    hostOnly(actor, hostUid);
    if (state.phase === "answer") {
      if (!hasAllAnswers(state, players) && Date.now() < state.deadline && !action.force) throw new Error("Players are still answering.");
      const filled = structuredClone(state.submissions || {});
      players.forEach((player) => (state.assignments[player.uid] || []).forEach((promptId) => {
        filled[player.uid] ||= {};
        filled[player.uid][promptId] ||= "(ran out of time)";
      }));
      return { ...state, submissions: filled, phase: "vote", matchupIndex: 0, votes: {}, deadline: nowPlus(22000) };
    }
    if (state.phase === "vote") {
      const matchup = currentMatchup(state);
      const eligible = players.filter((p) => !matchup.authors.includes(p.uid));
      const allVotes = eligible.every((p) => state.votes?.[p.uid]);
      if (!allVotes && Date.now() < state.deadline && !action.force) throw new Error("Players are still voting.");
      return finishVote(state, players);
    }
    if (state.phase === "result") return beginNextMatchupOrRound(state, players);
    if (state.phase === "finaleAnswer") {
      const all = players.every((p) => state.submissions?.[p.uid]);
      if (!all && Date.now() < state.deadline && !action.force) throw new Error("Players are still answering.");
      const submissions = { ...(state.submissions || {}) };
      players.forEach((p) => { submissions[p.uid] ||= "(ran out of time)"; });
      return { ...state, submissions, phase: "finaleVote", rankings: {}, deadline: nowPlus(28000) };
    }
    if (state.phase === "finaleVote") {
      const all = players.every((p) => state.rankings?.[p.uid]);
      if (!all && Date.now() < state.deadline && !action.force) throw new Error("Players are still ranking answers.");
      return scoreFinale(state);
    }
    throw new Error("There is nothing to advance right now.");
  }

  throw new Error("Unknown Punchline action.");
}

export const punchlineDefinition = {
  id: "punchline",
  name: "Punchline",
  eyebrow: "Write it. Vote it. Regret it.",
  description: "Fast comedy prompts, anonymous head-to-head voting, and a crowd-pleaser finale.",
  minPlayers: 3,
  maxPlayers: 12,
  introVideo: "/media/punchline-intro.mp4",
  music: "punchline",
  defaultSettings: { profanityFilter: true, spice: "cleaner" },
  createGameState: createPunchlineGameState,
  reduceGameState: reducePunchlineGameState,
};

export { PROMPTS as PUNCHLINE_PROMPTS };
