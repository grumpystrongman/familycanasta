const MUSIC_KEY = "familyPartyMusicVolume";
const SFX_KEY = "familyPartySfxVolume";

const themes = {
  lobby: {
    bpm: 96, root: 48, wave: "triangle", lead: [0, 7, 12, 7, 3, 10, 12, 7], bass: [0, 0, 7, 0, 3, 3, 10, 7], chords: [0, 5, 3, 7],
    kick: [0, 8], snare: [4, 12], hats: [2, 6, 10, 14], brightness: 1400,
  },
  punchline: {
    bpm: 118, root: 50, wave: "square", lead: [0, 4, 7, 11, 7, 4, 2, 9], bass: [0, 0, 7, 9, 0, 4, 7, 2], chords: [0, 5, 7, 2],
    kick: [0, 6, 8, 14], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14], brightness: 2100,
  },
  lastonealive: {
    bpm: 82, root: 38, wave: "sawtooth", lead: [0, 1, 7, 6, 0, 8, 7, 3], bass: [0, 0, 1, 0, 7, 6, 0, 3], chords: [0, 1, 8, 6],
    kick: [0, 3, 8, 11], snare: [12], hats: [2, 6, 10, 14], brightness: 850,
  },
  doodlealibi: {
    bpm: 106, root: 45, wave: "triangle", lead: [0, 5, 9, 12, 9, 5, 2, 7], bass: [0, 0, 5, 7, 0, 9, 5, 2], chords: [0, 5, 2, 7],
    kick: [0, 7, 8], snare: [4, 12], hats: [2, 4, 6, 10, 12, 14], brightness: 1500,
  },
  finale: {
    bpm: 132, root: 53, wave: "square", lead: [0, 7, 12, 16, 19, 16, 12, 7], bass: [0, 7, 9, 5, 0, 7, 12, 7], chords: [0, 7, 9, 5],
    kick: [0, 4, 8, 12], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14], brightness: 2400,
  },
};

function storageGet(key) {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); }
  catch { return null; }
}
function storageSet(key, value) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); }
  catch { /* storage can be blocked in private browsing */ }
}
function storedNumber(key, fallback) {
  const value = Number(storageGet(key));
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
function midiToHz(note) { return 440 * Math.pow(2, (note - 69) / 12); }
function at(value, list) { return list.includes(value % 16); }

class AudioDirector {
  constructor() {
    this.context = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.master = null;
    this.musicVolume = storedNumber(MUSIC_KEY, 0.52);
    this.sfxVolume = storedNumber(SFX_KEY, 0.82);
    this.loopTimer = null;
    this.loopName = "";
    this.step = 0;
    this.nextNoteTime = 0;
    this.ducked = false;
    this.listeners = new Set();
  }

  onEvent(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type, detail = {}) {
    this.listeners.forEach((listener) => {
      try { listener({ type, ...detail }); }
      catch { /* a show-effect listener must never break gameplay audio */ }
    });
  }

  async enable() {
    if (typeof window === "undefined") return false;
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      this.context = new Context();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.master = this.context.createDynamicsCompressor();
      this.master.threshold.value = -18;
      this.master.knee.value = 20;
      this.master.ratio.value = 4;
      this.master.attack.value = 0.006;
      this.master.release.value = 0.18;
      this.musicGain.gain.value = this.musicVolume;
      this.sfxGain.gain.value = this.sfxVolume;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
    return this.context.state === "running";
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, Number(value)));
    storageSet(MUSIC_KEY, String(this.musicVolume));
    if (this.musicGain && !this.ducked) this.musicGain.gain.setTargetAtTime(this.musicVolume, this.context.currentTime, 0.03);
  }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(value)));
    storageSet(SFX_KEY, String(this.sfxVolume));
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.context.currentTime, 0.03);
  }

  duckMusic(factor = 0.24) {
    if (!this.musicGain || !this.context) return;
    this.ducked = true;
    this.musicGain.gain.cancelScheduledValues(this.context.currentTime);
    this.musicGain.gain.setTargetAtTime(this.musicVolume * factor, this.context.currentTime, 0.05);
  }

  restoreMusic() {
    if (!this.musicGain || !this.context) return;
    this.ducked = false;
    this.musicGain.gain.cancelScheduledValues(this.context.currentTime);
    this.musicGain.gain.setTargetAtTime(this.musicVolume, this.context.currentTime, 0.12);
  }

  tone(frequency, duration = 0.12, destination = this.sfxGain, wave = "sine", gain = 0.16, when = 0, options = {}) {
    if (!this.context || !destination) return;
    const start = this.context.currentTime + Math.max(0, when);
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (options.endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), start + duration);
    if (options.detune) osc.detune.value = options.detune;
    filter.type = options.filterType || "lowpass";
    filter.frequency.value = options.filter || 5000;
    filter.Q.value = options.q || 0.7;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(0.02, duration * 0.25));
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.04);
  }

  chord(rootMidi, intervals, duration, destination, gain, when = 0, wave = "triangle", filter = 1800) {
    intervals.forEach((interval, index) => this.tone(
      midiToHz(rootMidi + interval), duration, destination, wave, gain / Math.max(1, intervals.length * 0.78), when,
      { detune: (index - 1) * 3, filter },
    ));
  }

  noise(duration = 0.08, gain = 0.08, when = 0, filterType = "highpass", frequency = 1500) {
    if (!this.context || !this.sfxGain) return;
    const start = this.context.currentTime + Math.max(0, when);
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const amp = this.context.createGain();
    filter.type = filterType;
    filter.frequency.value = frequency;
    amp.gain.setValueAtTime(Math.max(0.0002, gain), start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.sfxGain);
    source.start(start);
  }

  kick(when = 0, gain = 0.22, destination = this.musicGain) {
    if (!this.context || !destination) return;
    const start = this.context.currentTime + Math.max(0, when);
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(135, start);
    osc.frequency.exponentialRampToValueAtTime(46, start + 0.14);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(amp);
    amp.connect(destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }

  snare(when = 0, gain = 0.08) {
    this.noise(0.11, gain, when, "bandpass", 1800);
    this.tone(180, 0.07, this.musicGain, "triangle", gain * 0.45, when, { filter: 800 });
  }

  hat(when = 0, gain = 0.025) { this.noise(0.035, gain, when, "highpass", 5500); }

  impact(when = 0, gain = 0.22) {
    this.kick(when, gain, this.sfxGain);
    this.noise(0.18, gain * 0.28, when, "lowpass", 900);
  }

  sweep(startHz, endHz, duration, when = 0, gain = 0.12) {
    this.tone(startHz, duration, this.sfxGain, "sawtooth", gain, when, { endFrequency: endHz, filter: 2600 });
  }

  sfx(name) {
    if (!this.context || this.context.state !== "running") {
      this.enable().then((ok) => { if (ok) this.sfx(name); }).catch(() => {});
      return;
    }
    this.emit("sfx", { name, theme: this.loopName || "lobby" });
    const n = (midi, duration, when = 0, gain = 0.16, wave = "triangle") => this.tone(midiToHz(midi), duration, this.sfxGain, wave, gain, when);
    switch (name) {
      case "join":
        n(76, .08, 0, .12); n(83, .1, .07, .14); n(88, .18, .14, .12); this.noise(.08, .025, .02, "highpass", 4200); break;
      case "ready":
        this.chord(60, [0, 4, 7], .22, this.sfxGain, .34, 0, "triangle", 3200); n(84, .12, .08, .1); break;
      case "tick": n(82, .045, 0, .11, "square"); break;
      case "lock":
        this.impact(0, .12); this.sweep(480, 170, .13, 0, .08); n(69, .09, .08, .08); break;
      case "reveal":
        this.sweep(170, 880, .46, 0, .08); this.noise(.32, .04, .03, "bandpass", 2400); this.chord(60, [0, 4, 7, 11], .35, this.sfxGain, .38, .32, "triangle", 3400); break;
      case "vote": n(78, .055, 0, .13, "square"); n(85, .06, .045, .08); break;
      case "correct":
        [72, 76, 79, 84].forEach((m, i) => n(m, .13 + i * .02, i * .065, .12)); this.noise(.12, .018, .16, "highpass", 4800); break;
      case "wrong":
        n(46, .2, 0, .19, "sawtooth"); n(45, .28, .04, .12, "square"); this.impact(.02, .14); break;
      case "eliminate":
        this.impact(0, .28); [43, 38, 31].forEach((m, i) => n(m, .23, i * .13, .15, "sawtooth")); this.noise(.28, .055, .04, "lowpass", 650); break;
      case "draw": this.noise(.055, .035, 0, "bandpass", 3200); n(91, .035, 0, .05); break;
      case "score": n(84, .05, 0, .1); n(91, .09, .045, .11); break;
      case "countdown3": case "countdown2": case "countdown1": n(69, .16, 0, .18, "square"); this.impact(0, .08); break;
      case "go":
        this.impact(0, .2); this.chord(67, [0, 4, 7, 12], .45, this.sfxGain, .5, 0, "square", 3000); this.noise(.26, .045, .03, "highpass", 3600); break;
      case "heartbeat": this.kick(0, .18, this.sfxGain); this.kick(.2, .12, this.sfxGain); break;
      case "applause":
        for (let i = 0; i < 10; i += 1) this.noise(.11, .028 + Math.random() * .018, i * .055, "bandpass", 1500 + Math.random() * 2200); break;
      case "fanfare":
        this.impact(0, .22); [60, 64, 67, 72, 76, 79].forEach((m, i) => n(m, .18, i * .07, .11));
        this.chord(72, [0, 4, 7, 12], .62, this.sfxGain, .52, .34, "triangle", 4200);
        for (let i = 0; i < 10; i += 1) this.noise(.11, .028 + Math.random() * .018, .18 + i * .055, "bandpass", 1500 + Math.random() * 2200);
        break;
      default: n(82, .05, 0, .1); break;
    }
  }

  scheduleStep(theme, step, time) {
    const when = Math.max(0, time - this.context.currentTime);
    const localStep = step % 16;
    if (at(localStep, theme.kick)) this.kick(when, theme === themes.lastonealive ? 0.12 : 0.16, this.musicGain);
    if (at(localStep, theme.snare)) this.snare(when, theme === themes.lastonealive ? 0.038 : 0.055);
    if (at(localStep, theme.hats)) this.hat(when, theme === themes.lastonealive ? 0.012 : 0.019);

    if (localStep % 4 === 0) {
      const chordIndex = Math.floor(localStep / 4) % theme.chords.length;
      const chordRoot = theme.root + theme.chords[chordIndex] + 12;
      const minor = this.loopName === "lastonealive" || this.loopName === "doodlealibi";
      this.chord(chordRoot, minor ? [0, 3, 7, 10] : [0, 4, 7, 11], 0.72, this.musicGain, 0.11, when, "triangle", theme.brightness);
    }

    if (localStep % 2 === 0) {
      const bassIndex = Math.floor(localStep / 2) % theme.bass.length;
      this.tone(midiToHz(theme.root - 12 + theme.bass[bassIndex]), 0.24, this.musicGain, "sine", 0.052, when, { filter: 560 });
    }

    if ([1, 3, 6, 9, 11, 14].includes(localStep)) {
      const leadIndex = Math.floor(localStep / 2) % theme.lead.length;
      this.tone(midiToHz(theme.root + 12 + theme.lead[leadIndex]), 0.12, this.musicGain, theme.wave, 0.025, when, { filter: theme.brightness });
    }
  }

  startMusic(name = "lobby") {
    if (!this.context || !this.musicGain || this.context.state !== "running") {
      this.enable().then((ok) => { if (ok) this.startMusic(name); }).catch(() => {});
      return;
    }
    if (this.loopName === name && this.loopTimer) return;
    this.stopMusic();
    const theme = themes[name] || themes.lobby;
    this.loopName = name;
    this.step = 0;
    this.nextNoteTime = this.context.currentTime + 0.03;
    this.emit("music", { name });
    const sixteenth = (60 / theme.bpm) / 4;
    const scheduler = () => {
      if (!this.context || !this.loopName) return;
      while (this.nextNoteTime < this.context.currentTime + 0.12) {
        this.scheduleStep(theme, this.step, this.nextNoteTime);
        this.step += 1;
        this.nextNoteTime += sixteenth;
      }
    };
    scheduler();
    this.loopTimer = window.setInterval(scheduler, 25);
  }

  stopMusic() {
    if (this.loopTimer && typeof window !== "undefined") window.clearInterval(this.loopTimer);
    this.loopTimer = null;
    this.loopName = "";
    this.step = 0;
  }
}

export const partyAudio = new AudioDirector();
