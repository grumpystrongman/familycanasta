import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainUrl = new URL("./main.jsx", import.meta.url);
const readabilityUrl = new URL("./chatReadability.css", import.meta.url);
const emoteStylesUrl = new URL("./emotes.css", import.meta.url);

test("loads table-chat readability styles after the emote styles", async () => {
  const source = await readFile(mainUrl, "utf8");
  const emoteIndex = source.indexOf('import "./emotes.css";');
  const readabilityIndex = source.indexOf('import "./chatReadability.css";');

  assert.ok(emoteIndex >= 0);
  assert.ok(readabilityIndex > emoteIndex);
});

test("keeps normal and emote text black inside table chat", async () => {
  const styles = await readFile(readabilityUrl, "utf8");

  assert.match(styles, /\.score-chat-sidebar \.messages article p[\s\S]*color:\s*#111111 !important/);
  assert.match(styles, /p\.chat-emote-message strong\s*\{[^}]*color:\s*#111111 !important/s);
  assert.match(styles, /p\.chat-emote-message\s*\{[^}]*background:\s*#ffffff/s);
});

test("does not recolor the animated emote displayed over the game board", async () => {
  const readability = await readFile(readabilityUrl, "utf8");
  const emoteStyles = await readFile(emoteStylesUrl, "utf8");

  assert.doesNotMatch(readability, /canasta-emote-stage/);
  assert.match(emoteStyles, /\.canasta-emote-stage\s*\{[^}]*color:\s*#fff7df/s);
  assert.match(emoteStyles, /\.canasta-emote-stage \.emote-caption\s*\{[^}]*color:\s*#ffe5a2/s);
});
