import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const watchdogUrl = new URL("./RobotTurnWatchdog.jsx", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("loads the robot watchdog enhancement", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /\["RobotTurnWatchdog", \(\) => import\("\.\/RobotTurnWatchdog"\)\]/);
});

test("allows any connected human client to recover a robot turn", async () => {
  const source = await readFile(watchdogUrl, "utf8");

  assert.match(source, /const caller = room\.members\?\.\[uid\]/);
  assert.match(source, /if \(!caller \|\| caller\.isRobot\) return room/);
  assert.match(source, /if \(!activePlayer\(room\)\?\.isRobot\) return room/);
  assert.match(source, /return executeRobotTurn\(room\)/);
  assert.doesNotMatch(source, /hostUid\s*!==\s*uid/);
});

test("retries a missed or no-op robot turn", async () => {
  const source = await readFile(watchdogUrl, "utf8");

  assert.match(source, /const ROBOT_POLL_MS = 1400/);
  assert.match(source, /window\.setInterval\(runRobotIfNeeded, ROBOT_POLL_MS\)/);
  assert.match(source, /transactionRunning/);
});
