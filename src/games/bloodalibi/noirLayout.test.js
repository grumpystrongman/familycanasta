import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const indexSource = fs.readFileSync(new URL("./index.jsx", import.meta.url), "utf8");
const noirSource = fs.readFileSync(new URL("./NoirGame.jsx", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("./noir.css", import.meta.url), "utf8");

test("Blackglass routes to the full-viewport noir board", () => {
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

test("noir layout owns the viewport instead of becoming a long document", () => {
  assert.match(cssSource, /height:100dvh/);
  assert.match(cssSource, /overflow:hidden/);
  assert.match(cssSource, /grid-template-columns:220px minmax\(0,1fr\) 302px/);
  assert.match(cssSource, /grid-template-rows:48px minmax\(0,1fr\) 108px/);
});
