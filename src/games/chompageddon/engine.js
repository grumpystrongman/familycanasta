export const CHOMP_RULES = Object.freeze({
  arenaSize: 760,
  ballRadius: 10,
  ballCount: 32,
  roundSeconds: 60,
  minHumans: 1,
  maxHumans: 4,
  arenaRadius: 302,
  ballRestitution: 0.96,
  wallRestitution: 0.92,
  maxBallSpeed: 340,
});

export const CHOMPERS = Object.freeze([
  { id: "gulpzilla", name: "Gulpzilla", epithet: "The Deep Throat", side: "bottom", hue: 304, control: "SPACE", controlCode: "Space" },
  { id: "slobbertooth", name: "Slobbertooth", epithet: "The Slimy Sniper", side: "top", hue: 112, control: "W", controlCode: "KeyW" },
  { id: "chompchamp", name: "Chomp Champ", epithet: "The Bulldozer", side: "left", hue: 205, control: "A", controlCode: "KeyA" },
  { id: "snarfosaur", name: "Snarfosaur", epithet: "The Vacuum", side: "right", hue: 24, control: "D", controlCode: "KeyD" },
]);

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randomBetween(random, min, max) { return min + random() * (max - min); }

function capVelocity(ball) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed <= CHOMP_RULES.maxBallSpeed || speed === 0) return;
  const scale = CHOMP_RULES.maxBallSpeed / speed;
  ball.vx *= scale;
  ball.vy *= scale;
}

export function createBalls(random = Math.random, count = CHOMP_RULES.ballCount) {
  const center = CHOMP_RULES.arenaSize / 2;
  return Array.from({ length: count }, (_, id) => {
    const positionAngle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 224;
    const heading = random() * Math.PI * 2;
    const speed = randomBetween(random, 125, 225);
    return {
      id,
      x: center + Math.cos(positionAngle) * radius,
      y: center + Math.sin(positionAngle) * radius,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
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
    rattleClock: randomBetween(random, 0.55, 0.95),
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

function bounceOffArena(ball, random) {
  const center = CHOMP_RULES.arenaSize / 2;
  const limit = CHOMP_RULES.arenaRadius - CHOMP_RULES.ballRadius;
  const dx = ball.x - center;
  const dy = ball.y - center;
  const distance = Math.hypot(dx, dy) || 1;
  if (distance <= limit) return false;

  const nx = dx / distance;
  const ny = dy / distance;
  ball.x = center + nx * limit;
  ball.y = center + ny * limit;

  const outward = ball.vx * nx + ball.vy * ny;
  if (outward > 0) {
    ball.vx -= (1 + CHOMP_RULES.wallRestitution) * outward * nx;
    ball.vy -= (1 + CHOMP_RULES.wallRestitution) * outward * ny;
  }

  // A molded plastic rim is not a mathematically perfect circle. Give each rim
  // impact a small rough deflection so a tangential graze cannot become an orbit.
  const angle = randomBetween(random, -0.18, 0.18);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const nextVx = ball.vx * cos - ball.vy * sin;
  const nextVy = ball.vx * sin + ball.vy * cos;
  ball.vx = nextVx;
  ball.vy = nextVy;

  // Guarantee some motion back into the bowl instead of allowing edge-gliding.
  const inward = ball.vx * nx + ball.vy * ny;
  if (inward > -18) {
    const correction = inward + 18;
    ball.vx -= correction * nx;
    ball.vy -= correction * ny;
  }
  capVelocity(ball);
  return true;
}

function stepBall(ball, dt, random) {
  if (ball.capturedBy != null) return;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Very light rolling resistance: enough to feel physical without killing the
  // party-game motion halfway through a round.
  const damping = Math.pow(0.9992, dt * 60);
  ball.vx *= damping;
  ball.vy *= damping;
  bounceOffArena(ball, random);
}

export function resolveBallCollisions(balls) {
  const diameter = CHOMP_RULES.ballRadius * 2;
  const diameterSq = diameter * diameter;
  let collisions = 0;

  for (let i = 0; i < balls.length; i += 1) {
    const a = balls[i];
    if (a.capturedBy != null) continue;
    for (let j = i + 1; j < balls.length; j += 1) {
      const b = balls[j];
      if (b.capturedBy != null) continue;

      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distSq = dx * dx + dy * dy;
      if (distSq >= diameterSq) continue;

      // Perfectly coincident centers still need a usable collision normal.
      if (distSq < 0.000001) {
        const angle = ((a.id * 37 + b.id * 71) % 360) * Math.PI / 180;
        dx = Math.cos(angle) * 0.001;
        dy = Math.sin(angle) * 0.001;
        distSq = dx * dx + dy * dy;
      }

      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = diameter - dist;

      // Positional correction prevents balls from remaining interpenetrated and
      // repeatedly receiving fake impulses on following frames.
      const correction = Math.max(0, overlap - 0.01) * 0.5;
      a.x -= nx * correction;
      a.y -= ny * correction;
      b.x += nx * correction;
      b.y += ny * correction;

      const relativeVx = b.vx - a.vx;
      const relativeVy = b.vy - a.vy;
      const closingSpeed = relativeVx * nx + relativeVy * ny;
      if (closingSpeed >= 0) continue;

      // Equal-mass 2D impulse. Tangential velocity is preserved while the normal
      // component is exchanged, which makes glancing collisions actually glance.
      const impulse = -(1 + CHOMP_RULES.ballRestitution) * closingSpeed / 2;
      const impulseX = impulse * nx;
      const impulseY = impulse * ny;
      a.vx -= impulseX;
      a.vy -= impulseY;
      b.vx += impulseX;
      b.vy += impulseY;
      capVelocity(a);
      capVelocity(b);
      collisions += 1;
    }
  }
  return collisions;
}

export function resolveChomperBallCollisions(round) {
  let hits = 0;
  const ballRadius = CHOMP_RULES.ballRadius;

  round.chompers.forEach((chomper, index) => {
    const extension = extensionFor(chomper);
    if (extension <= 0.08 || chomper.phase === "idle") return;

    const pose = chomperPose(index, extension);
    const headRadius = 45;
    const combined = headRadius + ballRadius;
    const combinedSq = combined * combined;
    const launchSpeed = chomper.phase === "launch" ? 155 : chomper.phase === "retract" ? 70 : 35;
    const travelX = Math.cos(pose.angle);
    const travelY = Math.sin(pose.angle);

    for (const ball of round.balls) {
      if (ball.capturedBy != null) continue;
      let dx = ball.x - pose.x;
      let dy = ball.y - pose.y;
      let distSq = dx * dx + dy * dy;
      if (distSq >= combinedSq) continue;
      if (distSq < 0.000001) {
        dx = travelX;
        dy = travelY;
        distSq = 1;
      }

      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = combined - dist;
      ball.x += nx * (overlap + 0.5);
      ball.y += ny * (overlap + 0.5);

      // The moving monster head transfers momentum to whatever it fails to eat.
      // A small lateral component makes pileups explode instead of forming lanes.
      const side = ((ball.id + index) % 2 === 0 ? 1 : -1);
      ball.vx += nx * launchSpeed + travelX * 48 - travelY * side * 24;
      ball.vy += ny * launchSpeed + travelY * 48 + travelX * side * 24;
      capVelocity(ball);
      hits += 1;
    }
  });

  return hits;
}

function rattleTable(round, random) {
  const center = CHOMP_RULES.arenaSize / 2;
  for (const ball of round.balls) {
    if (ball.capturedBy != null) continue;
    const speed = Math.hypot(ball.vx, ball.vy);
    const angle = random() * Math.PI * 2;
    const kick = speed < 80 ? randomBetween(random, 24, 42) : randomBetween(random, 7, 18);
    ball.vx += Math.cos(angle) * kick;
    ball.vy += Math.sin(angle) * kick;

    // Balls living near the rim get a gentle inward bias during a table rattle.
    const dx = center - ball.x;
    const dy = center - ball.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance > 225) {
      ball.vx += (dx / distance) * 16;
      ball.vy += (dy / distance) * 16;
    }
    capVelocity(ball);
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
  round.rattleClock = Number.isFinite(round.rattleClock) ? round.rattleClock - safeDt : 0;
  updateBots(round, safeDt, random);

  // Sub-step at roughly 120 Hz so fast balls do not tunnel through one another.
  const substeps = Math.max(1, Math.ceil(safeDt / (1 / 120)));
  const subDt = safeDt / substeps;
  for (let step = 0; step < substeps; step += 1) {
    updateChompAnimations(round, subDt);
    for (const ball of round.balls) stepBall(ball, subDt, random);
    resolveBallCollisions(round.balls);
    resolveChomperBallCollisions(round);
  }

  if (round.rattleClock <= 0) {
    rattleTable(round, random);
    round.rattleClock = randomBetween(random, 0.65, 1.05);
  }

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
