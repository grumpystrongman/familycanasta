import { partyAudio } from "./audioDirector";

const voiceProfiles = {
  punchline: { rate: 1.06, pitch: 1.08, hints: ["Aria", "Jenny", "Samantha", "Ava", "Google US English", "Daniel", "Guy"] },
  lastonealive: { rate: 0.9, pitch: 0.72, hints: ["Guy", "Daniel", "David", "Mark", "Alex", "Google UK English Male"] },
  doodlealibi: { rate: 0.94, pitch: 0.84, hints: ["Daniel", "Guy", "David", "Alex", "Samantha", "Google UK English"] },
  lobby: { rate: 1.0, pitch: 1.0, hints: ["Aria", "Jenny", "Samantha", "Daniel", "Guy", "Google US English"] },
};

export const ANNOUNCER_BANKS = {
  punchline: {
    intro: [
      "Welcome to Punchline, where confidence is mandatory and comedy is technically optional.",
      "This is Punchline. Write fast, vote ruthlessly, and remember: explaining the joke only makes it worse.",
      "Welcome to Punchline. Tonight, two sentences enter. Dignity does not.",
    ],
    answer: [
      "Phones up. Write something funny. Or confusing enough that people assume it is funny.",
      "Your prompts are live. Please create comedy responsibly. Actually, never mind. Go nuts.",
      "Time to write. Somewhere, a future group chat apology is being born.",
      "Make it short. Make it sharp. Make it something you can deny tomorrow.",
    ],
    vote: [
      "Two answers. One tiny shred of glory. Vote now.",
      "The jokes are on the board. Choose the one that deserves to survive.",
      "Vote with your heart, your brain, or whatever part of you thinks this is funny.",
      "One of these answers has a future. The other has a LinkedIn post about resilience.",
    ],
    result: [
      "The room has spoken, and somehow nobody called security.",
      "Points awarded. Self-respect remains under review.",
      "There it is. Democracy, but for bad decisions.",
      "A winner emerges. Historians will not be notified.",
    ],
    finaleAnswer: [
      "Final round. One answer each. This is where legends are made, or at least screenshots.",
      "Crowd Pleaser time. Empty the comedy tank. We are not paying to refill it.",
    ],
    finaleVote: [
      "Rank your favorites. Friendships are temporary. Points are forever. For about thirty seconds.",
      "Choose your top answers. Eye contact afterward is optional.",
    ],
    final: [
      "That is the show. Please congratulate the winner and quietly delete your worst answer.",
      "We have a champion. The trophy is imaginary, but the bragging rights are irritatingly real.",
    ],
  },
  lastonealive: {
    intro: [
      "Welcome to Last One Alive. Please keep your hands, feet, and remaining life force inside the game at all times.",
      "This is Last One Alive. Trivia first. Regrettable consequences immediately afterward.",
      "Welcome, contestants. The good news is the questions are multiple choice. The bad news is everything else.",
    ],
    trivia: [
      "Question incoming. Knowledge is power. Wrong answers are also power, just mostly for the trap room.",
      "Choose carefully. The basement is accepting new applicants.",
      "Trivia time. Your remaining hearts would appreciate a correct answer.",
      "Four choices. One correct answer. Several terrible ways to learn you picked wrong.",
    ],
    triviaSafe: [
      "Everybody got it right. Frankly, that is suspicious.",
      "No victims this round. The trap department has filed a complaint.",
      "Correct across the board. Please enjoy this temporary and deeply misleading sense of security.",
    ],
    triviaDanger: [
      "Wrong answers detected. The trap room has been notified and is being way too enthusiastic about it.",
      "Somebody missed it. Somewhere below us, machinery is waking up.",
      "Incorrect. That sound you hear is probably fine. Probably.",
    ],
    microgame: [
      "Welcome to the consequences portion of the evening.",
      "A tiny game with completely reasonable stakes. By which I mean your remaining hearts.",
      "The trap is live. Panic efficiently.",
    ],
    microResult: [
      "The trap has spoken. It mostly said ouch.",
      "Consequences delivered. Customer service is unavailable.",
      "Some survived. Some learned a valuable lesson about clicking things.",
    ],
    resurrection: [
      "The dead get one shot at coming back. Apparently even mortality has a return policy.",
      "Ghosts, this is your chance. Try not to waste your second first impression.",
    ],
    finale: [
      "Run for the exit. Correct answers move you forward. Wrong answers build character, which is useless right now.",
      "The door is open. Metaphorically. Keep answering.",
    ],
    final: [
      "Someone got out. The rest of you have become part of the property value disclosure.",
      "We have a survivor. Please exit through the gift shop and do not feed the ghosts.",
    ],
  },
  doodlealibi: {
    intro: [
      "Welcome to Doodle Alibi. Tonight, artistic talent is less useful than a convincing lie.",
      "This is Doodle Alibi. Draw what you are told, trust absolutely nobody, and please stop blaming the stylus.",
      "Welcome, artists. One of you has a different assignment. All of you have questionable drawing skills.",
    ],
    draw: [
      "Your secret assignments are live. Draw fast and act innocent. Those are separate skills.",
      "Start drawing. Remember, confidence can hide a shocking amount of artistic evidence.",
      "Pens down eventually. Until then, create something a jury might reluctantly identify.",
    ],
    gallery: [
      "The evidence is in. Unfortunately, so are the drawings.",
      "Study the gallery. Somewhere in this mess is a lie. Possibly several crimes against perspective.",
      "Behold the evidence wall. Art teachers, avert your eyes.",
    ],
    vote: [
      "Make your accusation. Confidence is not evidence, but it has never stopped anybody before.",
      "Pick the suspicious drawing. Remember: everybody looks guilty when they draw hands.",
      "Who got the altered prompt? Accuse wisely, or at least dramatically.",
    ],
    suspectGuess: [
      "One last alibi. The suspect gets a chance to guess what everyone else was drawing.",
      "Suspect, tell us the common prompt. This is your extremely artistic plea bargain.",
    ],
    result: [
      "Case closed. The evidence was terrible, but technically sufficient.",
      "The truth is out. Several drawings would like to request legal representation.",
      "Mystery solved. Art remains unsolved.",
    ],
    final: [
      "That is Doodle Alibi. Please frame the winning drawing somewhere nobody important can see it.",
      "We have a master of the alibi. The museum has declined to comment.",
    ],
  },
};

const joinLines = [
  (name) => `${name} has entered the room. Expectations have been adjusted accordingly.`,
  (name) => `${name} is here. We can finally begin making questionable decisions.`,
  (name) => `${name} joined the game. Please update the emergency contact sheet.`,
  (name) => `${name} has arrived. Statistically, something weird is about to happen.`,
  (name) => `${name} is in. There goes the neighborhood, digitally speaking.`,
];

const microLines = {
  deadButton: "Dead Button. Six choices, one curse, and absolutely no warranty.",
  safeDial: "Safe Dial. Stop inside the zone. Precision suddenly matters, which feels unfair.",
  oddOneOut: "Odd One Out. Find the intruder before the intruder finds your remaining heart.",
  majorityGrave: "Majority Grave. The minority survives. Democracy has been temporarily suspended.",
  memoryMorgue: "Memory Morgue. Remember what you saw. Your brain has one job right now.",
  cutWire: "Cut the Wire. Choose the safe pattern. This seems like a terrible certification exam.",
};

let lastSpoken = "";
let lastJoinCount = 0;

function playerById(players, uid) { return players?.find((p) => p.uid === uid); }
function chooseFresh(lines = []) {
  if (!lines.length) return "";
  const options = lines.filter((line) => line !== lastSpoken);
  const pool = options.length ? options : lines;
  return pool[Math.floor(Math.random() * pool.length)] || "";
}
function countTop(state) {
  const counts = state?.result?.counts || {};
  return Object.entries(counts).sort((a, b) => Number(b[1]) - Number(a[1]))[0] || null;
}

export function introZinger(gameId) { return chooseFresh(ANNOUNCER_BANKS[gameId]?.intro || []); }

export function joinZinger(player, count) {
  if (!player?.nickname || count <= lastJoinCount) return "";
  lastJoinCount = count;
  return joinLines[Math.floor(Math.random() * joinLines.length)](player.nickname);
}

export function phaseZinger(gameId, state, players = []) {
  const bank = ANNOUNCER_BANKS[gameId] || {};
  if (!state?.phase) return "";

  if (gameId === "punchline") {
    if (state.phase === "result") {
      const top = countTop(state);
      const winner = top ? playerById(players, top[0]) : null;
      if (winner && Number(top[1]) > 0) return `${winner.nickname} takes that matchup. ${chooseFresh(bank.result)}`;
    }
    return chooseFresh(bank[state.phase] || []);
  }

  if (gameId === "lastonealive") {
    if (state.phase === "triviaResult") return chooseFresh(state.wrongUids?.length ? bank.triviaDanger : bank.triviaSafe);
    if (state.phase === "microgame") return microLines[state.microType] || chooseFresh(bank.microgame);
    if (state.phase === "microResult" && state.microLosers?.length) {
      const names = state.microLosers.map((uid) => playerById(players, uid)?.nickname).filter(Boolean);
      if (names.length === 1) return `${names[0]} loses a heart. ${chooseFresh(bank.microResult)}`;
    }
    return chooseFresh(bank[state.phase] || []);
  }

  if (gameId === "doodlealibi") {
    if (state.phase === "result") {
      const suspects = (state.suspectUids || []).map((uid) => playerById(players, uid)?.nickname).filter(Boolean);
      if (suspects.length === 1) return `${suspects[0]} had the altered prompt. ${chooseFresh(bank.result)}`;
    }
    return chooseFresh(bank[state.phase] || []);
  }

  return "";
}

function availableVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices?.() || [];
}

function pickVoice(profile) {
  const voices = availableVoices().filter((voice) => /^en([-_]|$)/i.test(voice.lang || "en"));
  if (!voices.length) return null;
  for (const hint of profile.hints || []) {
    const match = voices.find((voice) => String(voice.name).toLowerCase().includes(hint.toLowerCase()));
    if (match) return match;
  }
  return voices.find((voice) => voice.localService) || voices[0];
}

class PartyAnnouncer {
  constructor() {
    this.enabled = true;
    this.speaking = false;
  }

  prepare() {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    window.speechSynthesis.getVoices?.();
    return true;
  }

  cancel() {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    this.speaking = false;
    partyAudio.restoreMusic();
  }

  speak(text, gameId = "lobby", { interrupt = true } = {}) {
    if (!text || !this.enabled || typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return false;
    if (this.speaking && !interrupt) return false;
    if (interrupt) window.speechSynthesis.cancel();
    const profile = voiceProfiles[gameId] || voiceProfiles.lobby;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = pickVoice(profile);
    utterance.lang = utterance.voice?.lang || "en-US";
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = 1;
    utterance.onstart = () => { this.speaking = true; partyAudio.duckMusic(gameId === "lastonealive" ? 0.18 : 0.24); };
    const done = () => { this.speaking = false; partyAudio.restoreMusic(); };
    utterance.onend = done;
    utterance.onerror = done;
    lastSpoken = text;
    window.speechSynthesis.speak(utterance);
    return true;
  }
}

export const partyAnnouncer = new PartyAnnouncer();
