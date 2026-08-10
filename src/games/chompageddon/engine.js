export const CHOMP_RULES = Object.freeze({
  arenaSize: 760,
  ballRadius: 10,
  ballCount: 32,
  roundSeconds: 60,
  minHumans: 1,
  maxHumans: 4,
});

export const CHOMPERS = Object.freeze([
  { id: "gulpzilla", name: "Gulpzilla", epithet: "The Deep Throat", side: "bottom", hue: 304, control: "SPACE", controlCode: "Space" },
  { id: "slobbertooth", name: "Slobbertooth", epithet: "The Slimy Sniper", side: "top", hue: 112, control: "W", controlCode: "KeyW" },
  { id: "chompchamp", name: "Chomp Champ", epithet: "The Bulldozer", side: "left", hue: 205, control: "A", controlCode: "KeyA" },
  { id: "snarfosaur", name: "Snarfosaur", epithet: "The Vacuum", side: "right", hue: 24, control: "D", controlCode: "KeyD" },
]);

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randomBetween(random, min, max) { return min + random() * (max - min); }

export function createBalls(random = Math.random, count = CHOMP_RULES.ballCount) {
  const center = CHOMP_RULES.arenaSize / 2;
  return Array.from({ length: count }, (_, id) => {
    const angle = random() * Math.PI * 2;
    const radius = randomBetween(random, 54, 230);
    const speed = randomBetween(random, 88, 176);
    return {
      id,
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      vx: Math.cos(angle + Math.PI / 2) * speed + randomBetween(random, -54, 54),
      vy: Math.sin(angle + Math.PI / 2) * speed + randomBetween(random, -54, 54),
      hue: (id * 47 + 18) % 360,
      capturedBy: null,
    };
  });
}

export function createChompers(humanCount = 1, random = Math.random) {
  const humans = clamp(Number(humanCount) || 1, CHOMP_RULES.minHumans, CHOMP_RULES.maxHumans);
  return CHOMPERS.map((monster, index) => ({
    ...monster,
    index,
    isHuman: index < humans,
    phase: "idle",
    phaseTime: 0,
    score: 0,
    combo: 0,
    lastCapture: 0,
    nextAi: randomBetween(random, 0.35, 0.9),
  }));
}

export function createRound({ humanCount = 1, random = Math.random, ballCount = CHOMP_RULES.ballCount } = {}) {
  return {
    balls: createBalls(random, ballCount),
    chompers: createChompers(humanCount, random),
    elapsed: 0,
    finished: false,
    flash: 0,
    lastCapture: null,
  };
}

export function extensionFor(chomper) {
  if (!chomper || chomper.phase === "idle") return 0;
  if (chomper.phase === "launch") return Math.sin(clamp(chomper.phaseTime / 0.14, 0, 1) * Math.PI / 2);
  if (chomper.phase === "bite") return 1;
  if (chomper.phase === "retract") return 1 - clamp(chomper.phaseTime / 0.2, 0, 1);
  return 0;
}

export function chomperPose(index, extension = 0) {
  const size = CHOMP_RULES.arenaSize;
  const center = size / 2;
  const baseGap = 54;
  const travel = 146 * extension;
  if (index === 0) return { x: center, y: size - baseGap - travel, angle: -Math.PI / 2 };
  if (index === 1) return { x: center, y: baseGap + travel, angle: Math.PI / 2 };
  if (index === 2) return { x: baseGap + travel, y: center, angle: 0 };
  return { x: size - baseGap - travel, y: center, angle: Math.PI };
}

export function triggerChomp(round, index) {
  const chomper = round?.chompers?.[index];
  if (!chomper || round.finished || chomper.phase !== "idle") return false;
  chomper.phase = "launch";
  chomper.phaseTime = 0;
  round.flash = Math.max(round.flash, 0.5);
  return true;
}

function stepBall(ball, dt) {
  if (ball.capturedBy != null) return;
  const size = CHOMP_RULES.arenaSize;
  const r = CHOMP_RULES.ballRadius;
  const inner = 64;
  const outer = size - 64;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  const damping = Math.pow(0.997, dt * 60);
  ball.vx *= damping;
  ball.vy *= damping;

  if (ball.x < inner + r) { ball.x = inner + r; ball.vx = Math.abs(ball.vx) * 0.94; }
  if (ball.x > outer - r) { ball.x = outer - r; ball.vx = -Math.abs(ball.vx) * 0.94; }
  if (ball.y < inner + r) { ball.y = inner + r; ball.vy = Math.abs(ball.vy) * 0.94; }
  if (ball.y > outer - r) { ball.y = outer - r; ball.vy = -Math.abs(ball.vy) * 0.94; }

  const center = size / 2;
  const dx = ball.x - center;
  const dy = ball.y - center;
  const distance = Math.hypot(dx, dy) || 1;
  const maxRadius = 302;
  if (distance > maxRadius) {
    const nx = dx / distance;
    const ny = dy / distance;
    ball.x = center + nx * maxRadius;
    ball.y = center + ny * maxRadius;
    const outward = ball.vx * nx + ball.vy * ny;
    if (outward > 0) {
      ball.vx -= 1.88 * outward * nx;
      ball.vy -= 1.88 * outward * ny;
    }
  }

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < 48) {
    const tangent = Math.atan2(dy, dx) + Math.PI / 2;
    ball.vx += Math.cos(tangent) * 26 * dt;
    ball.vy += Math.sin(tangent) * 26 * dt;
  }
}

export function resolveBallCollisions(balls) {
  const minDist = CHOMP_RULES.ballRadius * 2;
  const minDistSq = minDist * minDist;
  for (let i = 0; i < balls.length; i += 1) {
    const a = balls[i];
    if (a.capturedBy != null) continue;
    for (let j = i + 1; j < balls.length; j += 1) {
      const b = balls[j];
      if (b.capturedBy != null) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 0 || distSq >= minDistSq) continue;
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const normalVelocity = rvx * nx + rvy * ny;
      if (normalVelocity > 0) continue;
      const impulse = -(1.82 * normalVelocity) / 2;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }
  }
}

export function captureBalls(round, index) {
  const chomper = round.chompers[index];
  const pose = chomperPose(index, 1);
  const mouthX = pose.x + Math.cos(pose.angle) * 43;
  const mouthY = pose.y + Math.sin(pose.angle) * 43;
  let captured = 0;
  for (const ball of round.balls) {
    if (ball.capturedBy != null) continue;
    const dx = ball.x - mouthX;
    const dy = ball.y - mouthY;
    if (dx * dx + dy * dy <= 43 * 43) {
      ball.capturedBy = index;
      captured += 1;
    }
  }
  if (captured > 0) {
    chomper.score += captured;
    chomper.combo = captured;
    chomper.lastCapture = captured;
    round.lastCapture = { index, count: captured };
    round.flash = 1;
  } else {
    chomper.combo = 0;
    chomper.lastCapture = 0;
  }
  return captured;
}

function updateBots(round, dt, random) {
  const progress = clamp(round.elapsed / CHOMP_RULES.roundSeconds, 0, 1);
  for (const chomper of round.chompers) {
    if (chomper.isHuman || chomper.phase !== "idle") continue;
    chomper.nextAi -= dt;
    if (chomper.nextAi > 0) continue;
    const pose = chomperPose(chomper.index, 1);
    const near = round.balls.some((ball) => {
      if (ball.capturedBy != null) return false;
      const dx = ball.x - pose.x;
      const dy = ball.y - pose.y;
      return dx * dx + dy * dy < 140 * 140;
    });
    if (near || random() < 0.2 + progress * 0.18) triggerChomp(round, chomper.index);
    const minDelay = 0.62 - progress * 0.23;
    chomper.nextAi = randomBetween(random, minDelay, minDelay + 0.72);
  }
}

function updateChompAnimations(round, dt) {
  for (const chomper of round.chompers) {
    if (chomper.phase === "idle") continue;
    chomper.phaseTime += dt;
    if (chomper.phase === "launch" && chomper.phaseTime >= 0.14) {
      chomper.phase = "bite";
      chomper.phaseTime = 0;
      captureBalls(round, chomper.index);
    } else if (chomper.phase === "bite" && chomper.phaseTime >= 0.105) {
      chomper.phase = "retract";
      chomper.phaseTime = 0;
    } else if (chomper.phase === "retract" && chomper.phaseTime >= 0.2) {
      chomper.phase = "idle";
      chomper.phaseTime = 0;
    }
  }
}

export function stepRound(round, dt, random = Math.random) {
  if (!round || round.finished) return round;
  const safeDt = clamp(dt, 0, 0.033);
  round.elapsed += safeDt;
  for (const ball of round.balls) stepBall(ball, safeDt);
  resolveBallCollisions(round.balls);
  updateBots(round, safeDt, random);
  updateChompAnimations(round, safeDt);
  round.flash = Math.max(0, round.flash - safeDt * 4.5);
  const remaining = round.balls.filter((ball) => ball.capturedBy == null).length;
  if (round.elapsed >= CHOMP_RULES.roundSeconds || remaining === 0) round.finished = true;
  return round;
}

export function winnersForRound(round) {
  if (!round?.chompers?.length) return [];
  const best = Math.max(...round.chompers.map((chomper) => chomper.score));
  return round.chompers.filter((chomper) => chomper.score === best);
}
