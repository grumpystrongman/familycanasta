import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_ENABLED_KEY = "blackglassAudioEnabled";
const MUSIC_VOLUME = 0.14;
const DUCKED_VOLUME = 0.035;

export const NOIR_AUDIO_SOURCES = Object.freeze({
  music: Object.freeze({
    title: "Moil",
    author: "Ruskerdax",
    license: "CC0 1.0",
    source: "https://opengameart.org/content/moil",
    url: "https://raw.githubusercontent.com/dinalUdagedara/poker/252f26b67a75dfc3d409a5318bb09ae75bc77ef3/public/sounds/music/table-loop.mp3",
  }),
  correct: Object.freeze({
    title: "Saxophone win jingle",
    author: "Kenney",
    license: "CC0 1.0",
    source: "https://kenney.nl/assets/music-jingles",
    url: "https://raw.githubusercontent.com/dinalUdagedara/poker/252f26b67a75dfc3d409a5318bb09ae75bc77ef3/public/sounds/music/win.ogg",
  }),
  wrong: Object.freeze({
    title: "Saxophone lose jingle",
    author: "Kenney",
    license: "CC0 1.0",
    source: "https://kenney.nl/assets/music-jingles",
    url: "https://raw.githubusercontent.com/dinalUdagedara/poker/252f26b67a75dfc3d409a5318bb09ae75bc77ef3/public/sounds/music/lose.ogg",
  }),
});

function readInitialEnabled() {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(AUDIO_ENABLED_KEY) !== "false"; } catch { return true; }
}

function makeAudio(src, { loop = false, volume = 1, preload = "auto" } = {}) {
  if (typeof Audio === "undefined") return null;
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = volume;
  audio.preload = preload;
  return audio;
}

export function useNoirAudio(state) {
  const [enabled, setEnabled] = useState(readInitialEnabled);
  const musicRef = useRef(null);
  const correctRef = useRef(null);
  const wrongRef = useRef(null);
  const unlockedRef = useRef(false);
  const lastAccusationRef = useRef(null);
  const restoreTimerRef = useRef(null);

  const startMusic = useCallback(() => {
    const music = musicRef.current;
    if (!enabled || !music || !unlockedRef.current || state?.phase === "game-over") return;
    music.volume = MUSIC_VOLUME;
    music.play().catch(() => {});
  }, [enabled, state?.phase]);

  useEffect(() => {
    musicRef.current = makeAudio(NOIR_AUDIO_SOURCES.music.url, { loop: true, volume: MUSIC_VOLUME, preload: "metadata" });
    correctRef.current = makeAudio(NOIR_AUDIO_SOURCES.correct.url, { volume: 0.62 });
    wrongRef.current = makeAudio(NOIR_AUDIO_SOURCES.wrong.url, { volume: 0.58 });
    return () => {
      if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current);
      [musicRef.current, correctRef.current, wrongRef.current].forEach((audio) => audio?.pause());
    };
  }, []);

  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      startMusic();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [startMusic]);

  useEffect(() => {
    try { window.localStorage.setItem(AUDIO_ENABLED_KEY, String(enabled)); } catch { /* preference is optional */ }
    if (!enabled) {
      musicRef.current?.pause();
      correctRef.current?.pause();
      wrongRef.current?.pause();
      return;
    }
    startMusic();
  }, [enabled, startMusic]);

  useEffect(() => {
    const accusation = [...(state?.caseLog || [])].reverse().find((entry) => entry.type === "accusation");
    if (!accusation) return;
    const key = `${accusation.turn ?? "?"}:${accusation.uid ?? "?"}:${accusation.correct ? "correct" : "wrong"}`;
    if (lastAccusationRef.current === key) return;
    lastAccusationRef.current = key;
    if (!enabled || !unlockedRef.current) return;

    const music = musicRef.current;
    const sting = accusation.correct ? correctRef.current : wrongRef.current;
    if (music && !music.paused) music.volume = DUCKED_VOLUME;
    if (sting) {
      sting.currentTime = 0;
      sting.play().catch(() => {});
    }

    if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current);
    restoreTimerRef.current = window.setTimeout(() => {
      if (state?.phase === "game-over") music?.pause();
      else if (music && enabled) {
        music.volume = MUSIC_VOLUME;
        music.play().catch(() => {});
      }
    }, 2200);
  }, [state?.caseLog, state?.phase, enabled]);

  const toggle = useCallback(() => {
    unlockedRef.current = true;
    setEnabled((value) => !value);
  }, []);

  return { enabled, toggle, sources: NOIR_AUDIO_SOURCES };
}
