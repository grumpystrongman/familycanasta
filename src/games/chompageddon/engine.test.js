import assert from "node:assert/strict";
import test from "node:test";
import {
  CHOMP_RULES,
  captureBalls,
  chomperPose,
  createChompers,
  createRound,
  resolveBallCollisions,
  resolveChomperBallCollisions,
  stepRound,
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

test("head-on balls separate and exchange their normal velocity", () => {
  const balls = [
    { id: 0, x: 100, y: 100, vx: 60, vy: 0, capturedBy: null },
    { id: 1, x: 115, y: 100, vx: -60, vy: 0, capturedBy: null },
  ];
  const collisions = resolveBallCollisions(balls);
  assert.equal(collisions, 1);
  assert.ok(balls[0].x < 100);
  assert.ok(balls[1].x > 115);
  assert.ok(balls[0].vx < 0, "left ball should reverse after the collision");
  assert.ok(balls[1].vx > 0, "right ball should reverse after the collision");
});

test("fast balls collide under sub-stepping instead of tunneling through each other", () => {
  const round = createRound({ humanCount: 4, random: () => 0.5, ballCount: 2 });
  const center = CHOMP_RULES.arenaSize / 2;
  round.rattleClock = 99;
  round.balls[0] = { ...round.balls[0], x: center - 20, y: center, vx: 340, vy: 0, capturedBy: null };
  round.balls[1] = { ...round.balls[1], x: center + 20, y: center, vx: -340, vy: 0, capturedBy: null };

  stepRound(round, 0.033, () => 0.5);
  assert.ok(round.balls[0].vx < 0, "first fast ball should bounce back");
  assert.ok(round.balls[1].vx > 0, "second fast ball should bounce back");
});

test("a tangent rim graze gets deflected back into the arena instead of becoming an orbit", () => {
  const round = createRound({ humanCount: 4, random: () => 0.5, ballCount: 1 });
  const center = CHOMP_RULES.arenaSize / 2;
  const limit = CHOMP_RULES.arenaRadius - CHOMP_RULES.ballRadius;
  round.rattleClock = 99;
  round.balls[0] = { ...round.balls[0], x: center + limit, y: center, vx: 0, vy: 220, capturedBy: null };

  stepRound(round, 0.033, () => 0.75);
  const ball = round.balls[0];
  const radialVelocity = ball.vx;
  assert.ok(radialVelocity < -10, `expected an inward radial component, got ${radialVelocity}`);
});

test("an extending monster head physically knocks aside a ball it does not capture", () => {
  const round = createRound({ humanCount: 4, random: () => 0.5, ballCount: 1 });
  const monster = round.chompers[2];
  monster.phase = "launch";
  monster.phaseTime = 0.07;
  const pose = chomperPose(2, Math.sin(Math.PI / 4));
  round.balls[0] = { ...round.balls[0], x: pose.x + 50, y: pose.y + 6, vx: 0, vy: 0, capturedBy: null };

  const hits = resolveChomperBallCollisions(round);
  assert.equal(hits, 1);
  assert.ok(round.balls[0].vx > 80, "moving head should transfer meaningful forward momentum");
  assert.ok(Math.abs(round.balls[0].vy) > 5, "head collision should also scatter the ball laterally");
});

test("highest score wins and ties return multiple monsters", () => {
  const round = createRound({ humanCount: 4, random: () => 0.5, ballCount: 1 });
  round.chompers[0].score = 5;
  round.chompers[1].score = 8;
  round.chompers[2].score = 8;
  round.chompers[3].score = 3;
  assert.deepEqual(winnersForRound(round).map((entry) => entry.index), [1, 2]);
});
