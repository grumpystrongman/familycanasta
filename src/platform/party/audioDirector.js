const MUSIC_KEY = "familyPartyMusicVolume";
const SFX_KEY = "familyPartySfxVolume";

const patterns = {
  lobby: { bpm: 92, root: 48, notes: [0, 7, 12, 7, 3, 10, 12, 7], wave: "triangle" },
  punchline: { bpm: 116, root: 50, notes: [0, 4, 7, 11, 7, 4, 2, 9], wave: "square" },
  lastonealive: { bpm: 78, root: 41, notes: [0, 1, 7, 6, 0, 8, 7, 3], wave: "sawtooth" },
  doodlealibi: { bpm: 104, root: 45, notes: [0, 5, 9, 12, 9, 5, 2, 7], wave: "triangle" },
  finale: { bpm: 132, root: 53, notes: [0, 7, 12, 16, 19, 16, 12, 7], wave: "square" },
};

function storedNumber(key, fallback) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
function midiToHz(note) { return 440 * Math.pow(2, (note - 69) / 12); }

class AudioDirector {
  constructor() {
    this.context = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicVolume = storedNumber(MUSIC_KEY, 0.35);
    this.sfxVolume = storedNumber(SFX_KEY, 0.65);
    this.loopTimer = null;
    this.loopName = "";
    this.step = 0;
  }

  async enable() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      this.context = new Context();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.sfxGain.gain.value = this.sfxVolume;
      this.musicGain.connect(this.context.destination);
      this.sfxGain.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
    return true;
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, Number(value)));
    localStorage.setItem(MUSIC_KEY, String(this.musicVolume));
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicVolume, this.context.currentTime, 0.03);
  }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(value)));
    localStorage.setItem(SFX_KEY, String(this.sfxVolume));
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.context.currentTime, 0.03);
  }

  note(frequency, duration = 0.12, destination = this.sfxGain, wave = "sine", gain = 0.18, when = 0) {
    if (!this.context || !destination) return;
    const start = this.context.currentTime + when;
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  noise(duration = 0.08, gain = 0.08) {
    if (!this.context || !this.sfxGain) return;
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const amp = this.context.createGain();
    amp.gain.setValueAtTime(gain, this.context.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    source.buffer = buffer;
    source.connect(amp);
    amp.connect(this.sfxGain);
    source.start();
  }

  sfx(name) {
    if (!this.context) return;
    const tones = {
      join: [[660, .09], [880, .12, .07]], ready: [[523, .08], [784, .14, .08]], tick: [[920, .035]],
      lock: [[350, .06], [700, .12, .05]], reveal: [[130, .16], [520, .24, .06]], vote: [[740, .055]],
      correct: [[523, .08], [659, .09, .08], [784, .16, .16]], wrong: [[220, .12], [165, .2, .11]],
      eliminate: [[180, .08], [130, .12, .07], [90, .26, .14]], draw: [[1000, .025]], score: [[880, .035]],
      countdown3: [[440, .12]], countdown2: [[440, .12]], countdown1: [[440, .12]], go: [[880, .24]],
      fanfare: [[523, .09], [659, .09, .09], [784, .09, .18], [1046, .36, .28]],
    };
    const sequence = tones[name] || tones.tick;
    sequence.forEach(([hz, duration, when = 0], index) => this.note(hz, duration, this.sfxGain, "triangle", 0.17, when || index * 0.07));
    if (["reveal", "eliminate", "fanfare"].includes(name)) this.noise(name === "fanfare" ? 0.22 : 0.1, 0.045);
  }

  startMusic(name = "lobby") {
    if (!this.context || !this.musicGain || this.loopName === name) return;
    this.stopMusic();
    const pattern = patterns[name] || patterns.lobby;
    this.loopName = name;
    this.step = 0;
    const beatMs = 60000 / pattern.bpm / 2;
    const schedule = () => {
      if (!this.context || !this.loopName) return;
      const semitone = pattern.notes[this.step % pattern.notes.length];
      this.note(midiToHz(pattern.root + semitone), Math.min(0.22, beatMs / 1000 * 0.65), this.musicGain, pattern.wave, 0.055);
      if (this.step % 4 === 0) this.note(midiToHz(pattern.root - 12), 0.28, this.musicGain, "sine", 0.045);
      this.step += 1;
    };
    schedule();
    this.loopTimer = window.setInterval(schedule, beatMs);
  }

  stopMusic() {
    if (this.loopTimer) window.clearInterval(this.loopTimer);
    this.loopTimer = null;
    this.loopName = "";
  }
}

export const partyAudio = new AudioDirector();
