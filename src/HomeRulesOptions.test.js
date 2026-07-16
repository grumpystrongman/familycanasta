import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const optionsUrl = new URL("./HomeRulesOptions.jsx", import.meta.url);

test("adds a stored one-or-two canasta house rule to custom game setup", async () => {
  const source = await readFile(optionsUrl, "utf8");
  assert.match(source, /CANASTAS_TO_GO_OUT_KEY = "canastaCanastasToGoOut"/);
  assert.match(source, /function storedCanastasToGoOut\(\)/);
  assert.match(source, /Canastas to go out/);
  assert.match(source, /2 canastas — house rule/);
  assert.match(source, /canastasToGoOut: findSettingsControl\(settings, "Canastas to go out"\)/);
});

test("lets the host change the canasta requirement in the lobby", async () => {
  const source = await readFile(optionsUrl, "utf8");
  assert.match(source, /async function changeLobbyCanastasToGoOut/);
  assert.match(source, /update\(ref\(db, `rooms\/\$\{roomCode\}\/rules`\), \{ canastasToGoOut: nextValue \}\)/);
  assert.match(source, /aria-label="Canastas required to go out"/);
  assert.match(source, /value=\{currentSetup\.canastasToGoOut\}/);
});

test("preserves the house rule when room capacity changes", async () => {
  const source = await readFile(optionsUrl, "utf8");
  assert.match(source, /canastasToGoOut: room\.rules\?\.canastasToGoOut/);
  assert.match(source, /localStorage\.setItem\(CANASTAS_TO_GO_OUT_KEY, String\(canastasToGoOut\)\)/);
});
