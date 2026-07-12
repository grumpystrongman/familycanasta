import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("./main.jsx", import.meta.url);

test("loads the core application independently from optional controllers", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /await import\("\.\/App"\)/);
  assert.match(source, /mountEnhancement/);
  assert.match(source, /ReactDOM\.createRoot\(container\)/);
  assert.doesNotMatch(source, /import App from "\.\/App"/);
  assert.doesNotMatch(source, /import GameStateEnhancer from/);
});

test("renders visible startup and failure states instead of a blank root", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /Loading Family Canasta/);
  assert.match(source, /Family Canasta could not start/);
  assert.match(source, /AppErrorBoundary/);
});
