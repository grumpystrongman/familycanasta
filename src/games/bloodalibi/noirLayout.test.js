import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const indexSource = fs.readFileSync(new URL("./index.jsx", import.meta.url), "utf8");
const noirSource = fs.readFileSync(new URL("./NoirGame.jsx", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("./noir.css", import.meta.url), "utf8");
const deductionCssSource = fs.readFileSync(new URL("./deduction.css", import.meta.url), "utf8");
const artSource = fs.readFileSync(new URL("./noirArt.css", import.meta.url), "utf8");
const finishSource = fs.readFileSync(new URL("./noirFinish.css", import.meta.url), "utf8");

test("Blackglass routes to the full-viewport noir board and loads both art layers", () => {
  assert.match(indexSource, /noirArt\.css/);
  assert.match(indexSource, /noirFinish\.css/);
  assert.match(indexSource, /NoirGame\.jsx/);
  assert.match(noirSource, /engineThreePart/);
  assert.match(noirSource, /itemAssetUrl/);
  assert.match(noirSource, /theoryAssetUrls/);
  assert.match(noirSource, /blackglass-noir-board/);
});

test("noir theory reconstruction visibly uses suspect, weapon, and room assets", () => {
  assert.match(noirSource, /assets\.suspect/);
  assert.match(noirSource, /assets\.weapon/);
  assert.match(noirSource, /assets\.room/);
  assert.match(noirSource, /PROPOSE THEORY/);
  assert.match(noirSource, /LOCK ACCUSATION/);
});

test("Blackglass exposes a private alibi choice and deduction desk", () => {
  assert.match(noirSource, /showAlibi/);
  assert.match(noirSource, /Choose your alibi card/);
  assert.match(noirSource, /YOUR PRIVATE HAND/);
  assert.match(noirSource, /Find the missing piece/);
  assert.match(noirSource, /buildDeductionGroups/);
  assert.match(deductionCssSource, /\.bn-alibi-overlay/);
  assert.match(deductionCssSource, /\.bn-deduction-grid/);
  assert.match(deductionCssSource, /\.bn-findings article\.resolved/);
});

test("noir layout owns the viewport with a larger readable board-first frame", () => {
  assert.match(cssSource, /height:100dvh/);
  assert.match(cssSource, /overflow:hidden/);
  assert.match(cssSource, /grid-template-columns:246px minmax\(0,1fr\) 330px/);
  assert.match(cssSource, /grid-template-rows:58px minmax\(0,1fr\) 122px/);
  assert.match(cssSource, /board-master\.jpg/);
});

test("rooms and corridors preserve the Clue-style geometry while the art owns the visible room title", () => {
  assert.match(cssSource, /\.bn-room\.theme-greenhouse/);
  assert.match(cssSource, /\.bn-room\.theme-atrium/);
  assert.match(cssSource, /\.bn-room\.theme-nightclub/);
  assert.match(cssSource, /\.bn-hall\.door/);
  assert.match(cssSource, /\.bn-hall\.reachable/);
  assert.match(cssSource, /\.bn-passages\{display:none\}/);
  assert.match(finishSource, /\.bn-shell \.bn-room-label\{display:none!important\}/);
});

test("evidence art uses the HD committed sources with no color-filter grading", () => {
  assert.match(artSource, /blank\.svg#suspects-/);
  assert.match(artSource, /blank\.svg#weapons-/);
  assert.match(artSource, /blank\.svg#rooms-/);
  assert.match(artSource, /cast-atlas-hd\.webp/);
  assert.match(artSource, /weapon-atlas-hd\.svg/);
  assert.match(artSource, /room-atlas-hd\.webp/);
  assert.doesNotMatch(artSource, /cast-atlas-polished/);
  assert.doesNotMatch(artSource, /weapon-atlas-polished/);
  assert.doesNotMatch(artSource, /room-atlas-polished/);
  assert.match(artSource, /filter: none !important/);
  assert.match(artSource, /mix-blend-mode: normal !important/);
  assert.doesNotMatch(artSource, /blur\(/i);
  assert.doesNotMatch(artSource, /saturate\(/i);
  assert.doesNotMatch(artSource, /brightness\(/i);
  assert.doesNotMatch(artSource, /contrast\(/i);
  assert.match(finishSource, /aspect-ratio:1\/1!important/);
  assert.match(finishSource, /\.learning-launch/);
});
