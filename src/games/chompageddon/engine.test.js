import assert from "node:assert/strict";
import test from "node:test";
import {
  CHOMP_RULES,
  captureBalls,
  chomperPose,
  createChompers,
  createRound,
  resolveBallCollisions,
  triggerChomp,
  winnersForRound,
} from "./engine.js";

test("Chompageddon supports one to four human players and fills remaining seats with bots", () => {
  const oneHuman = createChompers(1, () => 0.5);
  assert.equal(oneHuman.filter((player) => player.isHuman).length, 1);
  assert.equal(oneHuman.filter((player) => !player.isHuman).length, 3);

  const fourHumans = createChompers(4, () => 0.5);
  assert.equal(fourHumans.length, 4);
  assert.equal(fourHumans.every((player) => player.isHuman), true);
});

test("a monster can only start another chomp after its current lunge completes", () => {
  const round = createRound({ humanCount: 4, random: () => 0.5, ballCount: 1 });
  assert.equal(triggerChomp(round, 0), true);
  assert.equal(round.chompers[0].phase, "launch");
  assert.equal(triggerChomp(round, 0), false);
});

test("full-extension mouth captures every ball inside the capture radius", () => {
  const round = createRound({ humanCount: 4, random: () => 0.5, ballCount: 3 });
  const pose = chomperPose(0, 1);
  const mouthX = pose.x;
  const mouthY = pose.y - 43;
  round.balls[0] = { ...round.balls[0], x: mouthX, y: mouthY, capturedBy: null };
  round.balls[1] = { ...round.balls[1], x: mouthX + 16, y: mouthY + 12, capturedBy: null };
  round.balls[2] = { ...round.balls[2], x: CHOMP_RULES.arenaSize / 2, y: CHOMP_RULES.arenaSize / 2, capturedBy: null };

  const captured = captureBalls(round, 0);
  assert.equal(captured, 2);
  assert.equal(round.chompers[0].score, 2);
  assert.equal(round.balls[0].capturedBy, 0);
  assert.equal(round.balls[1].capturedBy, 0);
  assert.equal(round.balls[2].capturedBy, null);
});

test("overlapping balls separate and exchange motion", () => {
  const balls = [
    { id: 0, x: 100, y: 100, vx: 60, vy: 0, capturedBy: null },
    { id: 1, x: 115, y: 100, vx: -60, vy: 0, capturedBy: null },
  ];
  resolveBallCollisions(balls);
  assert.ok(balls[0].x < 100);
  assert.ok(balls[1].x > 115);
  assert.ok(balls[0].vx < 60);
  assert.ok(balls[1].vx > -60);
});

test("highest score wins and ties return multiple monsters", () => {
  const round = createRound({ humanCount: 4, random: () => 0.5, ballCount: 1 });
  round.chompers[0].score = 5;
  round.chompers[1].score = 8;
  round.chompers[2].score = 8;
  round.chompers[3].score = 3;
  assert.deepEqual(winnersForRound(round).map((entry) => entry.index), [1, 2]);
});
