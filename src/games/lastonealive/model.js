import { clamp, hostOnly, nowPlus, shuffle } from "../../platform/party/partyUtils";

const TRIVIA = [
  { q: "Which planet has the shortest day in our solar system?", a: ["Earth", "Jupiter", "Mars", "Venus"], c: 1 },
  { q: "What is the largest organ of the human body?", a: ["Liver", "Lungs", "Skin", "Brain"], c: 2 },
  { q: "Which element has the chemical symbol Fe?", a: ["Iron", "Fluorine", "Francium", "Fermium"], c: 0 },
  { q: "How many bones are in the typical adult human body?", a: ["186", "206", "226", "246"], c: 1 },
  { q: "What gas makes up most of Earth's atmosphere?", a: ["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"], c: 2 },
  { q: "Which animal has three hearts?", a: ["Octopus", "Dolphin", "Penguin", "Crocodile"], c: 0 },
  { q: "What is the hardest natural substance?", a: ["Quartz", "Diamond", "Granite", "Titanium"], c: 1 },
  { q: "Which part of a cell contains most genetic material?", a: ["Cell wall", "Nucleus", "Ribosome", "Cytoplasm"], c: 1 },
  { q: "Sound travels fastest through which state of matter?", a: ["Gas", "Liquid", "Solid", "Vacuum"], c: 2 },
  { q: "What is the closest star to Earth?", a: ["Sirius", "Proxima Centauri", "The Sun", "Betelgeuse"], c: 2 },
  { q: "Which ancient civilization built Machu Picchu?", a: ["Maya", "Aztec", "Inca", "Olmec"], c: 2 },
  { q: "The Magna Carta was sealed in which century?", a: ["11th", "13th", "15th", "17th"], c: 1 },
  { q: "Who was the first person to walk on the Moon?", a: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Alan Shepard"], c: 2 },
  { q: "Which empire built a road network centered on Rome?", a: ["Roman", "Ottoman", "Mali", "Mughal"], c: 0 },
  { q: "The Rosetta Stone helped scholars decipher which script?", a: ["Cuneiform", "Egyptian hieroglyphs", "Runes", "Sanskrit"], c: 1 },
  { q: "Which city was buried by Mount Vesuvius in AD 79?", a: ["Pompeii", "Sparta", "Carthage", "Delphi"], c: 0 },
  { q: "Which country gifted the Statue of Liberty to the United States?", a: ["Spain", "France", "Italy", "Canada"], c: 1 },
  { q: "The Renaissance began most strongly in which present-day country?", a: ["Italy", "Germany", "Portugal", "Norway"], c: 0 },
  { q: "Whose expedition completed the first circumnavigation of Earth?", a: ["Columbus", "Magellan", "Cook", "Drake"], c: 1 },
  { q: "What writing material was made from reeds in ancient Egypt?", a: ["Vellum", "Papyrus", "Parchment", "Slate"], c: 1 },
  { q: "Which film genre traditionally features detectives, shadows, and moral ambiguity?", a: ["Film noir", "Musical", "Western", "Slapstick"], c: 0 },
  { q: "How many notes are in a standard major scale before the octave repeats?", a: ["5", "7", "8", "12"], c: 1 },
  { q: "Which instrument normally has 88 keys?", a: ["Accordion", "Piano", "Harpsichord", "Organ"], c: 1 },
  { q: "What does CGI stand for in filmmaking?", a: ["Computer-Generated Imagery", "Cinema Graphic Interface", "Color Grade Index", "Camera Geometry Integration"], c: 0 },
  { q: "Which Shakespeare play features Rosencrantz and Guildenstern?", a: ["Macbeth", "Hamlet", "Othello", "King Lear"], c: 1 },
  { q: "A standard six-string guitar is usually tuned to how many distinct letter-name pitches?", a: ["4", "5", "6", "7"], c: 1 },
  { q: "What is a story set before the events of an existing story called?", a: ["Sequel", "Prequel", "Remix", "Coda"], c: 1 },
  { q: "Which art movement is associated with Claude Monet?", a: ["Cubism", "Impressionism", "Surrealism", "Pop Art"], c: 1 },
  { q: "What is the highest female classical singing voice?", a: ["Alto", "Tenor", "Soprano", "Baritone"], c: 2 },
  { q: "Which fictional detective lives at 221B Baker Street?", a: ["Poirot", "Sherlock Holmes", "Sam Spade", "Nero Wolfe"], c: 1 },
  { q: "What is the capital of New Zealand?", a: ["Auckland", "Christchurch", "Wellington", "Hamilton"], c: 2 },
  { q: "Which river runs through Paris?", a: ["Rhine", "Danube", "Seine", "Thames"], c: 2 },
  { q: "Which country contains the city of Marrakech?", a: ["Morocco", "Egypt", "Jordan", "Tunisia"], c: 0 },
  { q: "Mount Kilimanjaro is in which country?", a: ["Kenya", "Tanzania", "Uganda", "Ethiopia"], c: 1 },
  { q: "Which ocean is the deepest?", a: ["Atlantic", "Indian", "Arctic", "Pacific"], c: 3 },
  { q: "Which U.S. state is made up entirely of islands?", a: ["Florida", "Hawaii", "Alaska", "Rhode Island"], c: 1 },
  { q: "What is the largest country by land area?", a: ["Canada", "China", "Russia", "United States"], c: 2 },
  { q: "Which desert covers much of northern Africa?", a: ["Gobi", "Sahara", "Kalahari", "Atacama"], c: 1 },
  { q: "Which city is divided by the Danube into Buda and Pest?", a: ["Prague", "Budapest", "Vienna", "Belgrade"], c: 1 },
  { q: "Which continent has the most countries?", a: ["Asia", "Africa", "Europe", "South America"], c: 1 },
  { q: "What household ingredient is sodium bicarbonate?", a: ["Table salt", "Baking soda", "Cornstarch", "Vinegar"], c: 1 },
  { q: "Which direction does a standard screw usually turn to tighten?", a: ["Counterclockwise", "Clockwise", "Either", "It depends on gravity"], c: 1 },
  { q: "What does SPF on sunscreen primarily refer to?", a: ["Water resistance", "UVB protection factor", "Shelf life", "Skin moisture"], c: 1 },
  { q: "Which kitchen tool separates liquid from solids through holes?", a: ["Whisk", "Colander", "Spatula", "Rolling pin"], c: 1 },
  { q: "What is the cap on the end of a shoelace called?", a: ["Aglet", "Ferrule", "Grommet", "Toggle"], c: 0 },
  { q: "Which common battery size is physically larger?", a: ["AAA", "AA", "They are equal", "Depends on brand"], c: 1 },
  { q: "On products labeled nonstick foil, which side is normally the nonstick side?", a: ["Dull side", "Shiny side", "Both", "Neither"], c: 0 },
  { q: "What is the usual purpose of a lint trap in a dryer?", a: ["Cool clothes", "Catch fibers", "Add fragrance", "Measure humidity"], c: 1 },
  { q: "Which unit measures electrical resistance?", a: ["Volt", "Ohm", "Watt", "Ampere-hour"], c: 1 },
  { q: "What is the raised edge between sidewalk and street commonly called?", a: ["Curb", "Lintel", "Baffle", "Sill"], c: 0 },
  { q: "Bananas are botanically classified as what?", a: ["Nuts", "Berries", "Pods", "Drupes"], c: 1 },
  { q: "Which mammal cannot jump?", a: ["Elephant", "Giraffe", "Hippo", "Rhino"], c: 0 },
  { q: "What color is a polar bear's skin beneath its fur?", a: ["White", "Pink", "Black", "Gray"], c: 2 },
  { q: "Which bird can fly backward under its own power?", a: ["Falcon", "Hummingbird", "Owl", "Albatross"], c: 1 },
  { q: "A group of crows is traditionally called a what?", a: ["Parliament", "Murder", "Crash", "Charm"], c: 1 },
  { q: "Which food can remain edible for extremely long periods due to low moisture and acidity?", a: ["Honey", "Bread", "Milk", "Lettuce"], c: 0 },
  { q: "Which animal has blue blood due to copper-based hemocyanin?", a: ["Horseshoe crab", "Sea turtle", "Dolphin", "Jellyfish"], c: 0 },
  { q: "How many sides does a dodecagon have?", a: ["10", "11", "12", "14"], c: 2 },
  { q: "Which letter does not appear in any U.S. state name?", a: ["Q", "X", "Z", "J"], c: 0 },
  { q: "Which common fruit floats because roughly a quarter of its volume is air?", a: ["Apple", "Grape", "Cherry", "Plum"], c: 0 },
];

function makeStats(players) {
  return Object.fromEntries(players.map((p) => [p.uid, { score: 0, hearts: 3, ghost: false, hauntUsed: false }]));
}

function triviaRound(stats, round, used = []) {
  const pool = TRIVIA.map((_, i) => i).filter((i) => !used.includes(i));
  const questionIndex = shuffle(pool)[0] ?? 0;
  return {
    phase: "trivia",
    round,
    stats,
    questionIndex,
    usedQuestions: [...used, questionIndex],
    answers: {},
    wrongUids: [],
    deadline: nowPlus(18000),
  };
}

export function createLastOneAliveState(players) { return triviaRound(makeStats(players), 1, []); }
function ghosts(players, stats) { return players.filter((p) => stats[p.uid]?.ghost); }

function makeMicrogame(type, wrongUids) {
  const base = { phase: "microgame", microType: type, wrongUids, microAnswers: {}, deadline: nowPlus(14000) };
  if (type === "deadButton") return { ...base, curse: Math.floor(Math.random() * 6) };
  if (type === "safeDial") return { ...base, target: 0.2 + Math.random() * 0.6, width: 0.16 };
  if (type === "oddOneOut") return { ...base, odd: Math.floor(Math.random() * 9), symbols: ["▲", "▲", "▲", "▲", "▲", "▲", "▲", "▲", "●"] };
  if (type === "majorityGrave") return base;
  if (type === "memoryMorgue") {
    const icons = ["🕯️", "🗝️", "🦇", "🕸️", "🧪", "🪦", "🦴", "🔔"];
    return { ...base, icons, missing: Math.floor(Math.random() * icons.length) };
  }
  return { ...base, wires: ["STRIPED", "DOTTED", "SOLID", "CHEVRON"], safeWire: Math.floor(Math.random() * 4) };
}

function resolveTrivia(state, players) {
  const question = TRIVIA[state.questionIndex];
  const nextStats = structuredClone(state.stats);
  const wrongUids = [];
  players.forEach((p) => {
    const answer = state.answers?.[p.uid]?.choice;
    if (answer === question.c) nextStats[p.uid].score += 200;
    else wrongUids.push(p.uid);
  });
  return { ...state, phase: "triviaResult", stats: nextStats, wrongUids, correctChoice: question.c, deadline: nowPlus(4200) };
}

function resolveMicrogame(state) {
  const nextStats = structuredClone(state.stats);
  const answers = state.microAnswers || {};
  let losers = [];
  if (state.microType === "deadButton") losers = state.wrongUids.filter((uid) => Number(answers[uid]?.choice) === state.curse || answers[uid] == null);
  else if (state.microType === "safeDial") losers = state.wrongUids.filter((uid) => Math.abs(Number(answers[uid]?.value ?? -9) - state.target) > state.width / 2);
  else if (state.microType === "oddOneOut") losers = state.wrongUids.filter((uid) => Number(answers[uid]?.choice) !== state.odd);
  else if (state.microType === "majorityGrave") {
    const a = state.wrongUids.filter((uid) => answers[uid]?.choice === "A").length;
    const b = state.wrongUids.filter((uid) => answers[uid]?.choice === "B").length;
    if (a !== b) {
      const majority = a > b ? "A" : "B";
      losers = state.wrongUids.filter((uid) => answers[uid]?.choice === majority || !answers[uid]);
    }
  } else if (state.microType === "memoryMorgue") losers = state.wrongUids.filter((uid) => Number(answers[uid]?.choice) !== state.missing);
  else losers = state.wrongUids.filter((uid) => Number(answers[uid]?.choice) !== state.safeWire);

  losers.forEach((uid) => {
    const stat = nextStats[uid];
    stat.hearts = Math.max(0, stat.hearts - 1);
    if (stat.hearts === 0) stat.ghost = true;
  });
  state.wrongUids.filter((uid) => !losers.includes(uid)).forEach((uid) => { nextStats[uid].score += 75; });
  return { ...state, phase: "microResult", stats: nextStats, microLosers: losers, deadline: nowPlus(4200) };
}

function resurrectionState(state, players) {
  const ghostPlayers = ghosts(players, state.stats);
  if (!ghostPlayers.length) return null;
  const available = TRIVIA.map((_, i) => i).filter((i) => !(state.usedQuestions || []).includes(i));
  const questionIndex = shuffle(available)[0] ?? 0;
  return { ...state, phase: "resurrection", resurrectionQuestion: questionIndex, resurrectionAnswers: {}, deadline: nowPlus(15000), usedQuestions: [...(state.usedQuestions || []), questionIndex] };
}

function resolveResurrection(state, players) {
  const q = TRIVIA[state.resurrectionQuestion];
  const eligible = ghosts(players, state.stats)
    .filter((p) => state.resurrectionAnswers?.[p.uid]?.choice === q.c)
    .sort((a, b) => (state.resurrectionAnswers[a.uid]?.at || Infinity) - (state.resurrectionAnswers[b.uid]?.at || Infinity));
  const winner = eligible[0]?.uid || null;
  const stats = structuredClone(state.stats);
  if (winner) { stats[winner].ghost = false; stats[winner].hearts = 1; stats[winner].score += 250; }
  return { ...state, phase: "resurrectionResult", stats, resurrectionWinner: winner, deadline: nowPlus(4200) };
}

function finaleState(state, players) {
  const ordered = [...players].sort((a, b) => (state.stats[b.uid].score + state.stats[b.uid].hearts * 150) - (state.stats[a.uid].score + state.stats[a.uid].hearts * 150));
  const positions = {};
  ordered.forEach((p, index) => { positions[p.uid] = Math.max(0, 3 - index); });
  const questionIndex = shuffle(TRIVIA.map((_, i) => i))[0];
  return { ...state, phase: "finale", finaleStep: 1, positions, finaleQuestion: questionIndex, finaleAnswers: {}, deadline: nowPlus(12000), winnerUid: null };
}

function resolveFinale(state, players) {
  const q = TRIVIA[state.finaleQuestion];
  const positions = { ...state.positions };
  players.forEach((p) => {
    if (state.finaleAnswers?.[p.uid]?.choice === q.c) positions[p.uid] = (positions[p.uid] || 0) + (state.stats[p.uid].ghost ? 3 : 2);
  });
  const winner = players.slice().sort((a, b) => (positions[b.uid] || 0) - (positions[a.uid] || 0))[0];
  if ((positions[winner.uid] || 0) >= 12 || state.finaleStep >= 10) return { ...state, phase: "final", positions, winnerUid: winner.uid, deadline: null };
  const questionIndex = shuffle(TRIVIA.map((_, i) => i).filter((i) => i !== state.finaleQuestion))[0] ?? 0;
  return { ...state, positions, finaleStep: state.finaleStep + 1, finaleQuestion: questionIndex, finaleAnswers: {}, deadline: nowPlus(12000) };
}

const MICRO_TYPES = ["deadButton", "safeDial", "oddOneOut", "majorityGrave", "memoryMorgue", "cutWire"];

export function reduceLastOneAliveState(state, actor, action, players, _settings, hostUid) {
  if (!state || !action?.type) throw new Error("Invalid action.");
  const stats = state.stats || {};

  if (action.type === "answerTrivia") {
    if (state.phase !== "trivia") throw new Error("That question is closed.");
    if (state.answers?.[actor.uid]) throw new Error("Your answer is locked.");
    return { ...state, answers: { ...state.answers, [actor.uid]: { choice: clamp(Number(action.choice), 0, 3), at: Date.now() } } };
  }
  if (action.type === "microAnswer") {
    if (state.phase !== "microgame" || !state.wrongUids?.includes(actor.uid)) throw new Error("You are not in this micro-game.");
    if (state.microAnswers?.[actor.uid]) throw new Error("Your choice is locked.");
    return { ...state, microAnswers: { ...state.microAnswers, [actor.uid]: { ...action.payload, at: Date.now() } } };
  }
  if (action.type === "haunt") {
    if (!stats[actor.uid]?.ghost || stats[actor.uid]?.hauntUsed) throw new Error("Your haunt is unavailable.");
    const target = stats[action.targetUid];
    if (!target || target.ghost) throw new Error("Choose a living player.");
    const next = structuredClone(stats);
    next[actor.uid].hauntUsed = true;
    next[action.targetUid].hauntedRound = state.round;
    return { ...state, stats: next, lastHaunt: { ghostUid: actor.uid, targetUid: action.targetUid } };
  }
  if (action.type === "answerResurrection") {
    if (state.phase !== "resurrection" || !stats[actor.uid]?.ghost) throw new Error("Only ghosts can answer this one.");
    if (state.resurrectionAnswers?.[actor.uid]) throw new Error("Your answer is locked.");
    return { ...state, resurrectionAnswers: { ...state.resurrectionAnswers, [actor.uid]: { choice: Number(action.choice), at: Date.now() } } };
  }
  if (action.type === "answerFinale") {
    if (state.phase !== "finale") throw new Error("The escape question is closed.");
    if (state.finaleAnswers?.[actor.uid]) throw new Error("Your answer is locked.");
    return { ...state, finaleAnswers: { ...state.finaleAnswers, [actor.uid]: { choice: Number(action.choice), at: Date.now() } } };
  }

  if (action.type === "hostAdvance") {
    hostOnly(actor, hostUid);
    if (state.phase === "trivia") {
      const all = players.every((p) => state.answers?.[p.uid]);
      if (!all && Date.now() < state.deadline && !action.force) throw new Error("Players are still answering.");
      return resolveTrivia(state, players);
    }
    if (state.phase === "triviaResult") {
      if (!state.wrongUids?.length) return state.round >= 6 ? finaleState(state, players) : triviaRound(state.stats, state.round + 1, state.usedQuestions);
      return { ...state, ...makeMicrogame(MICRO_TYPES[(state.round - 1) % MICRO_TYPES.length], state.wrongUids) };
    }
    if (state.phase === "microgame") {
      const all = state.wrongUids.every((uid) => state.microAnswers?.[uid]);
      if (!all && Date.now() < state.deadline && !action.force) throw new Error("The doomed are still choosing.");
      return resolveMicrogame(state);
    }
    if (state.phase === "microResult") {
      if (state.round === 4) {
        const resurrection = resurrectionState(state, players);
        if (resurrection) return resurrection;
      }
      return state.round >= 6 ? finaleState(state, players) : triviaRound(state.stats, state.round + 1, state.usedQuestions);
    }
    if (state.phase === "resurrection") {
      const ghostPlayers = ghosts(players, state.stats);
      const all = ghostPlayers.every((p) => state.resurrectionAnswers?.[p.uid]);
      if (!all && Date.now() < state.deadline && !action.force) throw new Error("Ghosts are still answering.");
      return resolveResurrection(state, players);
    }
    if (state.phase === "resurrectionResult") return triviaRound(state.stats, state.round + 1, state.usedQuestions);
    if (state.phase === "finale") {
      const all = players.every((p) => state.finaleAnswers?.[p.uid]);
      if (!all && Date.now() < state.deadline && !action.force) throw new Error("Players are still running for the exit.");
      return resolveFinale(state, players);
    }
    throw new Error("There is nothing to advance right now.");
  }

  throw new Error("Unknown Last One Alive action.");
}

export const lastOneAliveDefinition = {
  id: "lastonealive",
  name: "Last One Alive",
  eyebrow: "Trivia. Traps. Escape.",
  description: "Horror-comedy trivia where wrong answers trigger dangerous little side games and ghosts can still steal the win.",
  minPlayers: 3,
  maxPlayers: 12,
  introVideo: "/media/last-one-alive-intro.mp4",
  music: "lastonealive",
  defaultSettings: {},
  createGameState: createLastOneAliveState,
  reduceGameState: reduceLastOneAliveState,
};

export { TRIVIA as LAST_ONE_ALIVE_TRIVIA, MICRO_TYPES };
