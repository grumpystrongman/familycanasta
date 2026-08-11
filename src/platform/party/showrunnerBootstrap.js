import { partyAudio } from "./audioDirector";
import { ANNOUNCER_BANKS, introZinger, joinZinger } from "./announcer";
import "./showrunner.css";

const shownIntros = new Set();
let lastPhaseKey = "";
let captionTimer = null;

function isHostScreen() {
  if (typeof window === "undefined") return false;
  const role = new URLSearchParams(window.location.search).get("role");
  return role === "host" || Boolean(document.querySelector(".party-stage:not(.party-phone)"));
}

function gameFromDom(fallback = "lobby") {
  const stage = document.querySelector(".party-theme-punchline, .party-theme-lastonealive, .party-theme-doodlealibi");
  if (!stage) return fallback === "finale" ? "lobby" : fallback;
  if (stage.classList.contains("party-theme-punchline")) return "punchline";
  if (stage.classList.contains("party-theme-lastonealive")) return "lastonealive";
  if (stage.classList.contains("party-theme-doodlealibi")) return "doodlealibi";
  return fallback;
}

function choose(lines = []) { return lines[Math.floor(Math.random() * lines.length)] || ""; }

function showCaption(text, gameId) {
  if (!text || !isHostScreen()) return;
  let node = document.getElementById("party-announcer-caption");
  if (!node) {
    node = document.createElement("div");
    node.id = "party-announcer-caption";
    node.className = "party-announcer-caption";
    node.innerHTML = '<span aria-hidden="true">🎙️</span><div><small>SHOW HOST</small><p></p></div>';
    document.body.appendChild(node);
  }
  node.dataset.game = gameId;
  node.querySelector("p").textContent = text;
  node.classList.remove("show");
  void node.offsetWidth;
  node.classList.add("show");
  if (captionTimer) window.clearTimeout(captionTimer);
  captionTimer = window.setTimeout(() => node.classList.remove("show"), 5200);
}

function currentPanel() {
  return {
    title: document.querySelector(".party-stage-title h1")?.textContent?.trim() || "",
    kicker: document.querySelector(".party-stage-title .party-kicker")?.textContent?.trim() || "",
  };
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
    if (title.includes("DEAD GET ONE SHOT") || title.includes("IS BACK") || title.includes("GRAVE STAYS FULL")) return "resurrection";
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
    const ranked = [...document.querySelectorAll(".party-answer-showdown.results article")].map((article) => {
      const votes = Number((article.querySelector(".party-vote-score")?.textContent || "").match(/^(\d+)/)?.[1] || 0);
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
  if (phase === "triviaResult" && gameId === "lastonealive") return choose(/HEADING TO THE TRAP/i.test(panel.kicker) ? bank.triviaDanger : bank.triviaSafe);
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
  if (["finale", "finaleAnswer"].includes(phase)) partyAudio.cue("finalRound");
  showCaption(lineForPhase(gameId, phase, panel), gameId);
}

function announceJoin(gameId) {
  const names = [...document.querySelectorAll(".party-player-tile b")].map((node) => node.textContent?.trim()).filter(Boolean);
  if (names.length) showCaption(joinZinger({ nickname: names[names.length - 1] }, names.length), gameId);
}

function handleShowEvent(event) {
  if (!isHostScreen() || event.type !== "sfx") return;
  const gameId = gameFromDom(event.theme || "lobby");
  if (event.name === "join") return void window.setTimeout(() => announceJoin(gameId), 80);
  if (event.name === "go" && gameId !== "lobby" && !shownIntros.has(gameId)) {
    shownIntros.add(gameId);
    showCaption(introZinger(gameId), gameId);
    return;
  }
  if (["tick", "reveal", "vote", "eliminate", "fanfare", "go"].includes(event.name)) window.setTimeout(() => announceCurrentPhase(gameId), event.name === "reveal" ? 160 : 80);
}

function ensureCreditsButton() {
  if (!isHostScreen() || document.getElementById("party-audio-credits-button")) return;
  const button = document.createElement("button");
  button.id = "party-audio-credits-button";
  button.className = "party-audio-credits-button";
  button.type = "button";
  button.textContent = "Audio credits";
  button.onclick = () => {
    const existing = document.getElementById("party-audio-credits");
    if (existing) return existing.remove();
    const panel = document.createElement("div");
    panel.id = "party-audio-credits";
    panel.className = "party-audio-credits";
    panel.innerHTML = `<button type="button" aria-label="Close audio credits">×</button><strong>PARTY STAGE AUDIO</strong><p>Music by Kevin MacLeod (incompetech.com), licensed CC BY 4.0: Pinball Spring, Mischief Maker, Giant Wyrm, Marty Gots a Plan, and Boogie Party.</p><p>Interface sounds, impacts, and recorded game voice cues by Kenney, licensed CC0.</p>`;
    panel.querySelector("button").onclick = () => panel.remove();
    document.body.appendChild(panel);
  };
  document.body.appendChild(button);
}

function renderLifecycleControls() {
  const api = window.__familyPartyLifecycle;
  let node = document.getElementById("party-lifecycle-controls");
  if (!api?.roomCode) { node?.remove(); return; }
  const final = api.phase === "final";
  if (!final && !api.isHost) { node?.remove(); return; }
  const signature = `${api.roomCode}:${api.isHost}:${api.status}:${api.phase}:${api.busy}`;
  if (node?.dataset.signature === signature) return;
  if (!node) {
    node = document.createElement("div");
    node.id = "party-lifecycle-controls";
    node.className = "party-lifecycle-controls";
    document.body.appendChild(node);
  }
  node.dataset.signature = signature;
  node.classList.toggle("final", final);
  node.innerHTML = "";

  if (final) {
    const title = document.createElement("strong");
    title.textContent = api.isHost ? "WHAT NEXT?" : "GAME COMPLETE";
    node.appendChild(title);
    if (api.isHost) {
      const replay = document.createElement("button");
      replay.type = "button";
      replay.className = "primary";
      replay.textContent = "↻ PLAY AGAIN · SAME ROOM";
      replay.disabled = Boolean(api.busy);
      replay.onclick = () => api.replay?.();
      node.appendChild(replay);
    } else {
      const hint = document.createElement("span");
      hint.className = "party-rematch-hint";
      hint.textContent = "Stay here for a rematch, or return to the game room.";
      node.appendChild(hint);
    }
    const home = document.createElement("button");
    home.type = "button";
    home.textContent = "⌂ FAMILY GAME ROOM";
    home.disabled = Boolean(api.busy);
    home.onclick = () => api.gameRoom?.();
    node.appendChild(home);
  } else if (api.isHost && api.status === "playing") {
    const exit = document.createElement("button");
    exit.type = "button";
    exit.className = "quiet";
    exit.textContent = "End show";
    exit.onclick = () => {
      if (window.confirm("End this room for everyone and return to the Family Game Room?")) api.gameRoom?.();
    };
    node.appendChild(exit);
  }
}

function handleLifecycle() {
  const api = window.__familyPartyLifecycle;
  if (api?.status === "lobby") {
    shownIntros.delete(gameFromDom());
    lastPhaseKey = "";
    partyAudio.startMusic("lobby");
  }
  renderLifecycleControls();
  ensureCreditsButton();
}

if (typeof window !== "undefined" && !window.__familyPartyShowrunnerInstalled) {
  window.__familyPartyShowrunnerInstalled = true;
  partyAudio.onEvent(handleShowEvent);
  window.addEventListener("family-party-lifecycle", handleLifecycle);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", handleLifecycle, { once: true });
  else handleLifecycle();
}
