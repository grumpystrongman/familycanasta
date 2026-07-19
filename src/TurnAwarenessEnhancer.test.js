import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatTurnTime,
  remainingTurnSeconds,
  TURN_OVERLAY_MS,
  TURN_REMINDER_SECONDS,
} from "./TurnAwarenessEnhancer.jsx";

const sourceUrl = new URL("./TurnAwarenessEnhancer.jsx", import.meta.url);
const cssUrl = new URL("./turnAwareness.css", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("turn reminder counts down for one minute without going negative", () => {
  assert.equal(TURN_REMINDER_SECONDS, 60);
  assert.equal(remainingTurnSeconds(1000, 1000), 60);
  assert.equal(remainingTurnSeconds(1000, 1500), 60);
  assert.equal(remainingTurnSeconds(1000, 2000), 59);
  assert.equal(remainingTurnSeconds(1000, 61000), 0);
  assert.equal(remainingTurnSeconds(1000, 71000), 0);
  assert.equal(formatTurnTime(60), "1:00");
  assert.equal(formatTurnTime(9), "0:09");
  assert.equal(formatTurnTime(0), "0:00");
});

test("your-turn overlay lasts five seconds and dismisses on mouse movement", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.equal(TURN_OVERLAY_MS, 5000);
  assert.match(source, /setShowOverlay\(true\)/);
  assert.match(source, /setTimeout\(dismiss, TURN_OVERLAY_MS\)/);
  assert.match(source, /addEventListener\("mousemove", dismiss, \{ once: true \}\)/);
  assert.match(source, /showOverlay && isMyTurn/);
});

test("last ten seconds use the urgent red blinking treatment", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const css = await readFile(cssUrl, "utf8");
  const main = await readFile(mainUrl, "utf8");
  assert.match(source, /secondsLeft <= 10/);
  assert.match(source, /Reminder only/);
  assert.match(css, /turn-reminder-timer\.urgent/);
  assert.match(css, /turn-red-blink/);
  assert.match(css, /#ff5364/);
  assert.match(main, /TurnAwarenessEnhancer/);
  assert.match(main, /turnAwareness\.css/);
});
