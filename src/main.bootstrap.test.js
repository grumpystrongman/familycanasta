import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("./main.jsx", import.meta.url);

test("loads the game hub independently from optional Canasta controllers", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /await import\("\.\/HubApp"\)/);
  assert.match(source, /mountEnhancement/);
  assert.match(source, /selectedGameId\(\) === "canasta"/);
  assert.match(source, /ReactDOM\.createRoot\(container\)/);
  assert.doesNotMatch(source, /import HubApp from "\.\/HubApp"/);
  assert.doesNotMatch(source, /import GameStateEnhancer from/);
});

test("renders visible family card room startup and failure states instead of a blank root", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /Loading the family card room/);
  assert.match(source, /The family card room could not start/);
  assert.match(source, /AppErrorBoundary/);
});
