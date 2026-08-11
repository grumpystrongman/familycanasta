const MUSIC_KEY = "familyPartyMusicVolume";
const SFX_KEY = "familyPartySfxVolume";

const KENNEY_RAW = "https://raw.githubusercontent.com/lavenderdotpet/CC0-Public-Domain-Sounds/main";
const interfaceAudio = (file) => `${KENNEY_RAW}/kenney_interfacesounds/Audio/${file}.ogg`;
const uiAudio = (file) => `${KENNEY_RAW}/kenney_uiaudio/Audio/${file}.ogg`;
const impactAudio = (file) => `${KENNEY_RAW}/kenney_impactsounds/Audio/${file}.ogg`;
const maleVoice = (file) => `${KENNEY_RAW}/kenney_voiceoverpack/Male/${file}.ogg`;
const femaleVoice = (file) => `${KENNEY_RAW}/kenney_voiceoverpack/Female/${file}.ogg`;

// Recorded production music. These tracks are free under CC BY 4.0; attribution
// lives in THIRD_PARTY_AUDIO.md and is surfaced in the Party Stage credits UI.
const MUSIC = {
  lobby: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pinball%20Spring.mp3",
  punchline: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Mischief%20Maker.mp3",
  lastonealive: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Giant%20Wyrm.mp3",
  doodlealibi: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Marty%20Gots%20a%20Plan.mp3",
  finale: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Boogie%20Party.mp3",
};

const SFX = {
  join: [interfaceAudio("open_002"), interfaceAudio("open_003")],
  ready: [interfaceAudio("confirmation_001"), interfaceAudio("confirmation_002")],
  tick: [interfaceAudio("tick_001"), interfaceAudio("tick_002")],
  lock: [interfaceAudio("confirmation_003"), interfaceAudio("select_003")],
  reveal: [interfaceAudio("bong_001"), interfaceAudio("bong_002")],
  vote: [interfaceAudio("select_001"), interfaceAudio("select_002")],
  correct: [interfaceAudio("confirmation_004")],
  wrong: [interfaceAudio("error_005"), interfaceAudio("error_006")],
  eliminate: [impactAudio("impactPunch_heavy_000"), impactAudio("impactPunch_heavy_001")],
  draw: [uiAudio("click3"), uiAudio("click4")],
  score: [interfaceAudio("confirmation_002"), interfaceAudio("confirmation_004")],
  countdown3: [interfaceAudio("tick_004")],
  countdown2: [interfaceAudio("tick_004")],
  countdown1: [interfaceAudio("tick_004")],
  go: [interfaceAudio("open_004"), interfaceAudio("confirmation_004")],
  heartbeat: [impactAudio("impactSoft_heavy_000")],
  applause: [interfaceAudio("bong_003"), interfaceAudio("bong_004")],
  fanfare: [interfaceAudio("confirmation_004"), interfaceAudio("open_004")],
};

const VOICE = {
  ready: { default: maleVoice("ready") },
  go: { default: maleVoice("go"), doodlealibi: femaleVoice("go") },
  correct: { default: maleVoice("correct"), punchline: femaleVoice("correct") },
  wrong: { default: maleVoice("wrong"), doodlealibi: femaleVoice("wrong") },
  hurry: { default: maleVoice("hurry_up") },
  finalRound: { default: maleVoice("final_round"), doodlealibi: femaleVoice("final_round") },
  winner: { default: maleVoice("you_win"), punchline: femaleVoice("congratulations") },
  gameOver: { default: maleVoice("game_over") },
};

function storageGet(key) {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); }
  catch { return null; }
}
function storageSet(key, value) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); }
  catch { /* storage can be blocked */ }
}
function storedNumber(key, fallback) {
  const raw = storageGet(key);
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
function choose(list = []) { return list[Math.floor(Math.random() * list.length)] || ""; }
function safeAudio(url) {
  if (typeof Audio === "undefined" || !url) return null;
  const audio = new Audio(url);
  audio.preload = "auto";
  return audio;
}

class AudioDirector {
  constructor() {
    this.context = null; // compatibility flag used by the existing controls
    this.musicVolume = storedNumber(MUSIC_KEY, 0.34);
    this.sfxVolume = storedNumber(SFX_KEY, 0.78);
    this.music = null;
    this.loopName = "";
    this.ducked = false;
    this.listeners = new Set();
    this.preloaded = new Map();
    this.lastVoiceAt = 0;
  }

  onEvent(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type, detail = {}) {
    this.listeners.forEach((listener) => {
      try { listener({ type, ...detail }); } catch { /* presentation hooks never break gameplay */ }
    });
  }

  async enable() {
    if (typeof window === "undefined" || typeof Audio === "undefined") return false;
    this.context = { state: "running" };
    // Prime the handful of clips used most often. Browsers may still lazy-load,
    // but this removes most first-click latency without blocking the game.
    ["join", "ready", "vote", "lock", "reveal", "correct", "wrong", "go"].forEach((name) => {
      (SFX[name] || []).forEach((url) => this.preload(url));
    });
    Object.values(VOICE).forEach((entry) => Object.values(entry).forEach((url) => this.preload(url)));
    return true;
  }

  preload(url) {
    if (!url || this.preloaded.has(url)) return this.preloaded.get(url) || null;
    const audio = safeAudio(url);
    if (!audio) return null;
    this.preloaded.set(url, audio);
    try { audio.load(); } catch { /* network/browser may defer loading */ }
    return audio;
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, Number(value)));
    storageSet(MUSIC_KEY, String(this.musicVolume));
    if (this.music) this.music.volume = this.musicVolume * (this.ducked ? 0.22 : 1);
  }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(value)));
    storageSet(SFX_KEY, String(this.sfxVolume));
  }

  duckMusic(factor = 0.22) {
    this.ducked = true;
    if (this.music) this.music.volume = this.musicVolume * factor;
  }

  restoreMusic() {
    this.ducked = false;
    if (this.music) this.music.volume = this.musicVolume;
  }

  playUrl(url, volume = this.sfxVolume, { rate = 1 } = {}) {
    if (!url || typeof Audio === "undefined") return null;
    const source = this.preload(url);
    const audio = source ? source.cloneNode(true) : safeAudio(url);
    if (!audio) return null;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.playbackRate = rate;
    audio.play().catch(() => {});
    return audio;
  }

  voiceCue(name) {
    const entry = VOICE[name];
    if (!entry) return;
    // Don't turn the human cue pack into constant chatter.
    if (Date.now() - this.lastVoiceAt < 1800) return;
    const url = entry[this.loopName] || entry.default;
    if (!url) return;
    this.lastVoiceAt = Date.now();
    this.duckMusic(0.16);
    const audio = this.playUrl(url, Math.min(1, this.sfxVolume * 1.05));
    if (audio) {
      const restore = () => this.restoreMusic();
      audio.addEventListener("ended", restore, { once: true });
      audio.addEventListener("error", restore, { once: true });
      window.setTimeout(restore, 2500);
    } else this.restoreMusic();
  }

  sfx(name) {
    if (!this.context) {
      this.enable().then((ok) => { if (ok) this.sfx(name); }).catch(() => {});
      return;
    }
    this.emit("sfx", { name, theme: this.loopName || "lobby" });
    const urls = SFX[name] || SFX.tick;
    this.playUrl(choose(urls), this.sfxVolume);

    if (name === "ready") this.voiceCue("ready");
    else if (name === "go") this.voiceCue("go");
    else if (name === "correct") this.voiceCue("correct");
    else if (name === "wrong") this.voiceCue("wrong");
    else if (name === "fanfare") this.voiceCue("winner");
  }

  cue(name) { this.voiceCue(name); }

  startMusic(name = "lobby") {
    if (!this.context) {
      this.enable().then((ok) => { if (ok) this.startMusic(name); }).catch(() => {});
      return;
    }
    const source = MUSIC[name] || MUSIC.lobby;
    if (this.loopName === name && this.music && !this.music.paused) return;
    this.stopMusic();
    this.loopName = name;
    this.music = safeAudio(source);
    if (!this.music) return;
    this.music.loop = true;
    this.music.volume = this.musicVolume;
    this.music.preload = "auto";
    this.music.play().catch(() => {});
    this.emit("music", { name });
  }

  stopMusic() {
    if (this.music) {
      try { this.music.pause(); this.music.currentTime = 0; } catch { /* ignore */ }
    }
    this.music = null;
    this.loopName = "";
  }
}

export const partyAudio = new AudioDirector();
