import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const enhancerUrl = new URL("./ChatBubbleEnhancer.jsx", import.meta.url);
const stylesUrl = new URL("./chatBubble.css", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("loads the temporary chat bubble enhancement", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /import "\.\/chatBubble\.css";/);
  assert.match(source, /\["ChatBubbleEnhancer", \(\) => import\("\.\/ChatBubbleEnhancer"\)\]/);
});

test("shows a bubble when Enter submits a non-empty chat message", async () => {
  const source = await readFile(enhancerUrl, "utf8");
  assert.match(source, /event\.key !== "Enter"/);
  assert.match(source, /\.game-page \.compose input/);
  assert.match(source, /input\?\.value\?\.trim\(\)/);
  assert.match(source, /document\.addEventListener\("keydown", onKeyDown, true\)/);
});

test("keeps the bubble visible for exactly 2.5 seconds and resets for a new message", async () => {
  const source = await readFile(enhancerUrl, "utf8");
  assert.match(source, /CHAT_BUBBLE_DURATION_MS = 2500/);
  assert.match(source, /clearTimeout\(timerRef\.current\)/);
  assert.match(source, /window\.setTimeout\(\(\) => setBubble\(null\), CHAT_BUBBLE_DURATION_MS\)/);
});

test("supports the send button and renders a non-blocking animated bubble", async () => {
  const source = await readFile(enhancerUrl, "utf8");
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(source, /\.game-page \.compose button/);
  assert.match(source, /className="ephemeral-chat-bubble"/);
  assert.match(source, /<AnimatePresence>/);
  assert.match(styles, /\.ephemeral-chat-bubble\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(styles, /z-index:\s*140/);
});
