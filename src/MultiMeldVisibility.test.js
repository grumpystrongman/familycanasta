import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("grouped meld commit action stays ahead of large previews", async () => {
  const css = await readFile(new URL("./multiMeld.css", import.meta.url), "utf8");
  assert.match(css, /\.selection-advisor\.grouped-meld-mode\s+\.multi-meld-button\s*\{[^}]*order:\s*-10/s);
  assert.match(css, /\.selection-advisor\.grouped-meld-mode\s+\.multi-meld-button\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.selection-advisor\.grouped-meld-mode\s+\.multi-meld-button\s*\{[^}]*top:\s*0/s);
});

test("grouped meld advisor preserves a stable scroll area", async () => {
  const css = await readFile(new URL("./multiMeld.css", import.meta.url), "utf8");
  assert.match(css, /\.selection-advisor\.grouped-meld-mode\s*\{[^}]*scrollbar-gutter:\s*stable/s);
});
