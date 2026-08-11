import { partyAudio } from "./audioDirector";
import { ANNOUNCER_BANKS, introZinger, joinZinger } from "./announcer";
import "./showrunner.css";

const shownIntros = new Set();
let lastPhaseKey = "";
let captionTimer = null;
let lifecycleObserver = null;

function ensureAudibleDefaults() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem("familyPartyMusicVolume") == null) partyAudio.setMusicVolume(0.34);
    if (window.localStorage.getItem("familyPartySfxVolume") == null) partyAudio.setSfxVolume(0.78);
  } catch { /* in-memory defaults still work */ }
}

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
    node.innerHTML = '<span aria-hidden="true">🎙️</span><div><small>SHOW HOST</small><p></p></div>';
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

// Deliberately text-only. Long comedy lines sounded poor through browser TTS.
// Short generic game calls now use Kenney's recorded human voice clips in the
// audio director instead.
function presentHostLine(text, gameId) {
  if (!text || !isHostScreen()) return;
  showCaption(text, gameId);
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
  if (["finale", "finaleAnswer"].includes(phase)) partyAudio.cue("finalRound");
  if (phase === "final") partyAudio.cue("winner");
  presentHostLine(lineForPhase(gameId, phase, panel), gameId);
}

function announceJoin(gameId) {
  const names = [...document.querySelectorAll(".party-player-tile b")].map((node) => node.textContent?.trim()).filter(Boolean);
  if (!names.length) return;
  presentHostLine(joinZinger({ nickname: names[names.length - 1] }, names.length), gameId === "lobby" ? "lobby" : gameId);
}

function handleShowEvent(event) {
  if (!isHostScreen()) return;
  const gameId = gameFromDom(event.theme || "lobby");
  if (event.type === "music" || event.type !== "sfx") return;

  if (event.name === "join") {
    window.setTimeout(() => announceJoin(gameId), 80);
    return;
  }
  if (event.name === "go" && gameId !== "lobby" && !shownIntros.has(gameId)) {
    shownIntros.add(gameId);
    presentHostLine(introZinger(gameId), gameId);
    return;
  }
  if (["tick", "reveal", "vote", "eliminate", "fanfare", "go"].includes(event.name)) {
    window.setTimeout(() => announceCurrentPhase(gameId), event.name === "reveal" ? 160 : 80);
  }
}

function ensureCreditsButton() {
  if (!isHostScreen() || document.getElementById("party-audio-credits-button")) return;
  const button = document.createElement("button");
  button.id = "party-audio-credits-button";
  button.className = "party-audio-credits-button";
  button.type = "button";
  button.textContent = "Audio credits";
  button.onclick = () => {
    let panel = document.getElementById("party-audio-credits");
    if (panel) { panel.remove(); return; }
    panel = document.createElement("div");
    panel.id = "party-audio-credits";
    panel.className = "party-audio-credits";
    panel.innerHTML = `<button type="button" aria-label="Close audio credits">×</button><strong>PARTY STAGE AUDIO</strong><p>Music by Kevin MacLeod (incompetech.com), licensed CC BY 4.0: Pinball Spring, Mischief Maker, Giant Wyrm, Marty Gots a Plan, and Boogie Party.</p><p>Interface sounds, impacts, and recorded game voice cues by Kenney, licensed CC0.</p>`;
    panel.querySelector("button").onclick = () => panel.remove();
    document.body.appendChild(panel);
  };
  document.body.appendChild(button);
}

function renderLifecycleControls() {
  if (typeof document === "undefined") return;
  const api = window.__familyPartyLifecycle;
  let node = document.getElementById("party-lifecycle-controls");
  if (!api?.roomCode) {
    node?.remove();
    return;
  }

  const final = api.phase === "final";
  const shouldShow = final || api.isHost;
  if (!shouldShow) { node?.remove(); return; }
  if (!node) {
    node = document.createElement("div");
    node.id = "party-lifecycle-controls";
    node.className = "party-lifecycle-controls";
    document.body.appendChild(node);
  }
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
      const stay = document.createElement("span");
      stay.className = "party-rematch-hint";
      stay.textContent = "Stay here for a rematch, or return to the game room.";
      node.appendChild(stay);
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

function installLifecycleObserver() {
  renderLifecycleControls();
  ensureCreditsButton();
  window.addEventListener("family-party-lifecycle", renderLifecycleControls);
  if (!lifecycleObserver && typeof MutationObserver !== "undefined") {
    lifecycleObserver = new MutationObserver(() => {
      renderLifecycleControls();
      ensureCreditsButton();
    });
    lifecycleObserver.observe(document.body, { childList: true, subtree: true });
  }
}

if (typeof window !== "undefined" && !window.__familyPartyShowrunnerInstalled) {
  window.__familyPartyShowrunnerInstalled = true;
  ensureAudibleDefaults();
  partyAudio.onEvent(handleShowEvent);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLifecycleObserver, { once: true });
  else installLifecycleObserver();
}
