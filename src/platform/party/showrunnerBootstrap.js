import { partyAudio } from "./audioDirector";
import { ANNOUNCER_BANKS, introZinger, joinZinger, partyAnnouncer } from "./announcer";
import "./showrunner.css";

const spokenIntros = new Set();
let lastPhaseKey = "";
let captionTimer = null;

function isHostScreen() {
  if (typeof window === "undefined") return false;
  const role = new URLSearchParams(window.location.search).get("role");
  return role === "host" || Boolean(document.querySelector(".party-stage:not(.party-phone)"));
}

function gameFromDom(fallback = "lobby") {
  if (typeof document === "undefined") return fallback;
  const stage = document.querySelector(".party-theme-punchline, .party-theme-lastonealive, .party-theme-doodlealibi");
  if (!stage) return fallback === "finale" ? "lobby" : fallback;
  if (stage.classList.contains("party-theme-punchline")) return "punchline";
  if (stage.classList.contains("party-theme-lastonealive")) return "lastonealive";
  if (stage.classList.contains("party-theme-doodlealibi")) return "doodlealibi";
  return fallback;
}

function choose(lines = []) {
  if (!lines.length) return "";
  return lines[Math.floor(Math.random() * lines.length)] || "";
}

function showCaption(text, gameId) {
  if (!text || typeof document === "undefined") return;
  let node = document.getElementById("party-announcer-caption");
  if (!node) {
    node = document.createElement("div");
    node.id = "party-announcer-caption";
    node.className = "party-announcer-caption";
    node.innerHTML = '<span aria-hidden="true">🎙️</span><p></p>';
    document.body.appendChild(node);
  }
  node.dataset.game = gameId;
  node.querySelector("p").textContent = text;
  node.classList.remove("show");
  void node.offsetWidth;
  node.classList.add("show");
  if (captionTimer) window.clearTimeout(captionTimer);
  captionTimer = window.setTimeout(() => node.classList.remove("show"), 5600);
}

function speak(text, gameId, options = {}) {
  if (!text || !isHostScreen()) return;
  showCaption(text, gameId);
  partyAnnouncer.speak(text, gameId, options);
}

function currentPanel() {
  const title = document.querySelector(".party-stage-title h1")?.textContent?.trim() || "";
  const kicker = document.querySelector(".party-stage-title .party-kicker")?.textContent?.trim() || "";
  const body = document.querySelector(".party-stage-panel")?.textContent?.trim() || "";
  return { title, kicker, body };
}

function phaseFromPanel(gameId, panel) {
  const title = panel.title.toUpperCase();
  const kicker = panel.kicker.toUpperCase();
  if (gameId === "punchline") {
    if (title.includes("CHAMPION")) return "final";
    if (title.includes("CROWD PLEASER") && kicker.includes("EVERYBODY")) return "finaleAnswer";
    if (title.includes("RANK YOUR") || title.includes("PICK THE CROWD PLEASER")) return "finaleVote";
    if (title.includes("SPOKEN")) return "result";
    if (title.startsWith("ROUND") && (kicker.includes("VOTE") || kicker.includes("JUDGES"))) return "vote";
    if (title.startsWith("ROUND")) return "answer";
  }
  if (gameId === "lastonealive") {
    if (title.includes("THE ONE WHO GOT OUT")) return "final";
    if (title.includes("RUN FOR THE EXIT")) return "finale";
    if (title.includes("DEAD GET ONE SHOT")) return "resurrection";
    if (title.includes("IS BACK") || title.includes("GRAVE STAYS FULL")) return "resurrection";
    if (title.includes("ANSWER REVEAL")) return "triviaResult";
    if (title.startsWith("TRIVIA")) return "trivia";
    if (["DEAD BUTTON", "SAFE DIAL", "ODD ONE OUT", "MAJORITY GRAVE", "MEMORY MORGUE", "CUT THE WIRE"].some((name) => title.includes(name))) return "microgame";
    if (title.includes("TRAP CLAIMS") || title.includes("EVERYBODY ESCAPED")) return "microResult";
  }
  if (gameId === "doodlealibi") {
    if (title.includes("MASTER OF THE ALIBI")) return "final";
    if (title.includes("CASE CLOSED")) return "result";
    if (title.includes("ONE LAST ALIBI")) return "suspectGuess";
    if (title.includes("WHO GOT THE ALTERED") || title.includes("TV DETECTIVE")) return "vote";
    if (title.includes("EVIDENCE WALL")) return "gallery";
    if (title.startsWith("CASE") || title.includes("FINAL CASE")) return "draw";
  }
  return "";
}

function dynamicResultLine(gameId, fallback) {
  if (gameId === "punchline") {
    const articles = [...document.querySelectorAll(".party-answer-showdown.results article")];
    const ranked = articles.map((article) => {
      const scoreText = article.querySelector(".party-vote-score")?.textContent || "";
      const votes = Number(scoreText.match(/^(\d+)/)?.[1] || 0);
      const name = article.querySelector(".party-author")?.textContent?.replace(/^\S+\s*/, "")?.trim() || "";
      return { votes, name };
    }).sort((a, b) => b.votes - a.votes);
    if (ranked[0]?.name && ranked[0].votes > 0) return `${ranked[0].name} takes it with ${ranked[0].votes} vote${ranked[0].votes === 1 ? "" : "s"}. ${fallback}`;
  }
  if (gameId === "lastonealive") {
    const victims = [...document.querySelectorAll(".party-life-wall article.hit b")].map((node) => node.textContent?.trim()).filter(Boolean);
    if (victims.length === 1) return `${victims[0]} just lost a heart. ${fallback}`;
  }
  if (gameId === "doodlealibi") {
    const reveal = document.querySelector(".party-suspect-reveal")?.textContent?.trim();
    if (reveal) return `${reveal}. ${fallback}`;
  }
  return fallback;
}

function lineForPhase(gameId, phase, panel) {
  const bank = ANNOUNCER_BANKS[gameId] || {};
  if (!phase) return "";
  if (phase === "triviaResult" && gameId === "lastonealive") {
    const danger = /HEADING TO THE TRAP/i.test(panel.kicker);
    return choose(danger ? bank.triviaDanger : bank.triviaSafe);
  }
  if (phase === "microgame" && gameId === "lastonealive") {
    const title = panel.title.toUpperCase();
    if (title.includes("DEAD BUTTON")) return "Dead Button. Six choices, one curse, and absolutely no warranty.";
    if (title.includes("SAFE DIAL")) return "Safe Dial. Stop inside the zone. Precision suddenly matters, which feels unfair.";
    if (title.includes("ODD ONE OUT")) return "Odd One Out. Find the intruder before the intruder finds your remaining heart.";
    if (title.includes("MAJORITY GRAVE")) return "Majority Grave. The minority survives. Democracy has been temporarily suspended.";
    if (title.includes("MEMORY MORGUE")) return "Memory Morgue. Remember what you saw. Your brain has one job right now.";
    if (title.includes("CUT THE WIRE")) return "Cut the Wire. Choose the safe pattern. This seems like a terrible certification exam.";
  }
  const base = choose(bank[phase] || []);
  return ["result", "microResult"].includes(phase) ? dynamicResultLine(gameId, base) : base;
}

function announceCurrentPhase(gameId) {
  if (!isHostScreen()) return;
  const panel = currentPanel();
  const phase = phaseFromPanel(gameId, panel);
  if (!phase) return;
  const key = `${gameId}:${phase}:${panel.title}`;
  if (key === lastPhaseKey) return;
  lastPhaseKey = key;
  const line = lineForPhase(gameId, phase, panel);
  speak(line, gameId, { interrupt: true });
}

function announceJoin(gameId) {
  const names = [...document.querySelectorAll(".party-player-tile b")].map((node) => node.textContent?.trim()).filter(Boolean);
  if (!names.length) return;
  const line = joinZinger({ nickname: names[names.length - 1] }, names.length);
  speak(line, gameId === "lobby" ? "lobby" : gameId, { interrupt: false });
}

function handleShowEvent(event) {
  if (!isHostScreen()) return;
  const gameId = gameFromDom(event.theme || "lobby");
  if (event.type === "music") return;
  if (event.type !== "sfx") return;

  if (event.name === "join") {
    window.setTimeout(() => announceJoin(gameId), 80);
    return;
  }
  if (event.name === "go" && gameId !== "lobby" && !spokenIntros.has(gameId)) {
    spokenIntros.add(gameId);
    speak(introZinger(gameId), gameId, { interrupt: true });
    return;
  }
  if (["tick", "reveal", "vote", "eliminate", "fanfare", "go"].includes(event.name)) {
    window.setTimeout(() => announceCurrentPhase(gameId), event.name === "reveal" ? 160 : 80);
  }
}

if (typeof window !== "undefined" && !window.__familyPartyShowrunnerInstalled) {
  window.__familyPartyShowrunnerInstalled = true;
  partyAnnouncer.prepare();
  partyAudio.onEvent(handleShowEvent);
}
