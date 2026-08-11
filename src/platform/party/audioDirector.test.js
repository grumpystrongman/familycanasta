import test from "node:test";
import assert from "node:assert/strict";
import { PARTY_AUDIO_SOURCES } from "./audioDirector.js";

test("Party Stage music uses recorded remote tracks instead of generated oscillators", () => {
  assert.deepEqual(Object.keys(PARTY_AUDIO_SOURCES.music).sort(), ["doodlealibi", "finale", "lastonealive", "lobby", "punchline"]);
  for (const url of Object.values(PARTY_AUDIO_SOURCES.music)) {
    assert.match(url, /^https:\/\//);
    assert.match(url, /\.mp3$/i);
  }
});

test("Party Stage SFX and voice cues use recorded Kenney assets", () => {
  const sfxUrls = Object.values(PARTY_AUDIO_SOURCES.sfx).flat();
  const voiceUrls = Object.values(PARTY_AUDIO_SOURCES.voice).flatMap((entry) => Object.values(entry));
  assert.ok(sfxUrls.length >= 25);
  assert.ok(voiceUrls.length >= 8);
  for (const url of [...sfxUrls, ...voiceUrls]) {
    assert.match(url, /^https:\/\/raw\.githubusercontent\.com\//);
    assert.match(url, /\.ogg$/i);
  }
});
