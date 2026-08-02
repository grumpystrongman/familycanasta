import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mainSource = readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
const hubSource = readFileSync(new URL("./HubApp.jsx", import.meta.url), "utf8");
const canastaModule = readFileSync(new URL("./games/canasta/index.jsx", import.meta.url), "utf8");

test("startup routes through the family game hub", () => {
  assert.match(mainSource, /import\("\.\/HubApp"\)/);
  assert.doesNotMatch(mainSource, /const module = await import\("\.\/App"\)/);
});

test("Canasta enhancements only mount for the Canasta route", () => {
  assert.match(mainSource, /selectedGameId\(\) === "canasta"/);
});

test("the hub discovers game modules without a shared registry edit", () => {
  assert.match(hubSource, /import\.meta\.glob\("\.\/games\/\*\/index\.jsx"\)/);
  assert.match(hubSource, /gameModulePath\(game\.id\)/);
});

test("the Canasta module delegates to the existing application", () => {
  assert.equal(canastaModule.trim().startsWith('export { default } from "../../App";'), true);
});

test("planned games are visible but disabled until their module is installed", () => {
  for (const gameId of ["hearts", "spades", "rummy"]) {
    assert.match(hubSource, new RegExp(`id: "${gameId}"`));
  }
  assert.match(hubSource, /disabled=!\{?available\}?|disabled=\{!available\}/);
});
