import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("grouped meld commit action stays ahead of large previews", async () => {
  const css = await readFile(new URL("./multiMeld.css", import.meta.url), "utf8");
  assert.match(css, /\.selection-advisor\.grouped-meld-mode \.multi-meld-button\{[^}]*order:-10/);
  assert.match(css, /\.selection-advisor\.grouped-meld-mode \.multi-meld-button\{[^}]*position:sticky/);
  assert.match(css, /\.selection-advisor\.grouped-meld-mode \.multi-meld-button\{[^}]*top:0/);
});

test("grouped meld advisor preserves a stable scroll area", async () => {
  const css = await readFile(new URL("./multiMeld.css", import.meta.url), "utf8");
  assert.match(css, /\.selection-advisor\.grouped-meld-mode\{[^}]*scrollbar-gutter:stable/);
});
