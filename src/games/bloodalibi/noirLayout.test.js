import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const indexSource = fs.readFileSync(new URL("./index.jsx", import.meta.url), "utf8");
const noirSource = fs.readFileSync(new URL("./NoirGame.jsx", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("./noir.css", import.meta.url), "utf8");
const deductionCssSource = fs.readFileSync(new URL("./deduction.css", import.meta.url), "utf8");
const artSource = fs.readFileSync(new URL("./noirArt.css", import.meta.url), "utf8");
const referenceSource = fs.readFileSync(new URL("./noirReference.css", import.meta.url), "utf8");
const audioSource = fs.readFileSync(new URL("./noirAudio.js", import.meta.url), "utf8");
const audioCredits = fs.readFileSync(new URL("./AUDIO_SOURCES.md", import.meta.url), "utf8");

test("Blackglass routes to the full-viewport noir board and loads the reference layer last", () => {
  assert.match(indexSource, /noirArt\.css/);
  assert.match(indexSource, /noirFinish\.css/);
  assert.match(indexSource, /noirReference\.css/);
  assert.ok(indexSource.indexOf("noirReference.css") > indexSource.indexOf("noirFinish.css"));
  assert.match(indexSource, /NoirGame\.jsx/);
  assert.match(noirSource, /engineThreePart/);
  assert.match(noirSource, /itemAssetUrl/);
  assert.match(noirSource, /blackglass-noir-board/);
});

test("noir theory reconstruction visibly uses suspect, weapon, and room assets", () => {
  assert.match(noirSource, /assets\.suspect/);
  assert.match(noirSource, /assets\.weapon/);
  assert.match(noirSource, /assets\.room/);
  assert.match(noirSource, /PROPOSE THEORY/);
  assert.match(noirSource, /LOCK ACCUSATION/);
});

test("final accusation is a separate turn-wide action instead of being locked to investigation phase", () => {
  assert.match(noirSource, /const canAccuse = myTurn && !eliminated && !busy && !state\.pendingRefutation/);
  assert.match(noirSource, /canAccuse/);
  assert.match(noirSource, /Final room[\s\S]*disabled=!\{theory\.canAccuse\}/);
  assert.match(noirSource, /LOCK ACCUSATION/);
  assert.match(noirSource, /Available any time on your turn/);
});

test("Blackglass preserves the private alibi choice and deduction desk", () => {
  assert.match(noirSource, /showAlibi/);
  assert.match(noirSource, /Choose your alibi card/);
  assert.match(noirSource, /YOUR PRIVATE HAND/);
  assert.match(noirSource, /Find the missing piece/);
  assert.match(noirSource, /buildDeductionGroups/);
  assert.match(deductionCssSource, /\.bn-alibi-overlay/);
  assert.match(deductionCssSource, /\.bn-deduction-grid/);
});

test("the underlying Clue-style board still owns the full viewport", () => {
  assert.match(cssSource, /height:100dvh/);
  assert.match(cssSource, /overflow:hidden/);
  assert.match(cssSource, /\.bn-room\.theme-greenhouse/);
  assert.match(cssSource, /\.bn-room\.theme-atrium/);
  assert.match(cssSource, /\.bn-room\.theme-nightclub/);
  assert.match(cssSource, /\.bn-hall\.door/);
  assert.match(cssSource, /\.bn-hall\.reachable/);
  assert.match(cssSource, /\.bn-passages\{display:none\}/);
});

test("reference layer matches the approved black brass red cinematic hierarchy", () => {
  assert.match(referenceSource, /--nr-gold:#c99a47/);
  assert.match(referenceSource, /--nr-red:#9e3427/);
  assert.match(referenceSource, /grid-template-columns:282px minmax\(0,1fr\) 360px/);
  assert.match(referenceSource, /grid-template-rows:64px minmax\(0,1fr\) 118px/);
  assert.match(referenceSource, /\.bn-shell \.bn-room-label\{display:none!important\}/);
  assert.match(referenceSource, /\.bn-shell \.bn-hall\.door/);
  assert.match(referenceSource, /\.bn-players article img/);
  assert.match(referenceSource, /\.bn-theory-form \.bn-primary/);
  assert.match(referenceSource, /Georgia/);
});

test("evidence art is direct, unfiltered, and free of the broken raster atlas path", () => {
  assert.match(artSource, /filter: none !important/);
  assert.match(artSource, /mix-blend-mode: normal !important/);
  assert.doesNotMatch(artSource, /atlas-hd|atlas-polished|blank\.svg#/);
  assert.doesNotMatch(artSource, /blur\(/i);
  assert.doesNotMatch(artSource, /saturate\(/i);
  assert.doesNotMatch(artSource, /brightness\(/i);
  assert.doesNotMatch(artSource, /contrast\(/i);
});

test("Blackglass audio is documented CC0 noir music with distinct accusation zingers", () => {
  assert.match(noirSource, /useNoirAudio/);
  assert.match(noirSource, /AUDIO ON/);
  assert.match(audioSource, /Moil/);
  assert.match(audioSource, /Ruskerdax/);
  assert.match(audioSource, /Kenney/);
  assert.match(audioSource, /correctRef/);
  assert.match(audioSource, /wrongRef/);
  assert.match(audioSource, /entry\.type === "accusation"/);
  assert.match(audioCredits, /CC0 1\.0/);
  assert.match(audioCredits, /opengameart\.org\/content\/moil/);
  assert.match(audioCredits, /kenney\.nl\/assets\/music-jingles/);
});
