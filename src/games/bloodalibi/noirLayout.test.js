import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const indexSource = fs.readFileSync(new URL("./index.jsx", import.meta.url), "utf8");
const noirSource = fs.readFileSync(new URL("./NoirGame.jsx", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("./noir.css", import.meta.url), "utf8");
const artSource = fs.readFileSync(new URL("./noirArt.css", import.meta.url), "utf8");

test("Blackglass routes to the full-viewport noir board and loads canonical art styling", () => {
  assert.match(indexSource, /noirArt\.css/);
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

test("noir layout owns the viewport with a larger readable board-first frame", () => {
  assert.match(cssSource, /height:100dvh/);
  assert.match(cssSource, /overflow:hidden/);
  assert.match(cssSource, /grid-template-columns:246px minmax\(0,1fr\) 330px/);
  assert.match(cssSource, /grid-template-rows:58px minmax\(0,1fr\) 122px/);
  assert.match(cssSource, /board-master\.jpg/);
});

test("rooms and corridors preserve the polished Clue-style visual contract", () => {
  assert.match(cssSource, /\.bn-room\.theme-greenhouse/);
  assert.match(cssSource, /\.bn-room\.theme-atrium/);
  assert.match(cssSource, /\.bn-room\.theme-nightclub/);
  assert.match(cssSource, /\.bn-hall\.door/);
  assert.match(cssSource, /\.bn-hall\.reachable/);
  assert.match(cssSource, /\.bn-passages\{display:none\}/);
  assert.match(cssSource, /\.bn-room-label strong/);
});

test("canonical cast, weapon, and room atlases are wired into the live game", () => {
  assert.match(artSource, /canonical-cast-atlas\.jpg/);
  assert.match(artSource, /weapon-atlas\.jpg/);
  assert.match(artSource, /room-atlas\.jpg/);
  assert.match(artSource, /#blackglass-dex-vale/);
  assert.match(artSource, /#blackglass-cleaver/);
  assert.match(artSource, /#blackglass-penthouse/);
});
