// --- Core Constants ---
export const NUM_FACES = 8;
export const FACE_ANGLE = (2 * Math.PI) / NUM_FACES;
export const LEVEL_LENGTH = 3000;
export const OBSTACLE_DEPTH = 170;
export const PLAYER_ANGULAR_RADIUS = FACE_ANGLE * 0.23;

const TWO_PI = Math.PI * 2;
const BASE_SPEED = 1750;
const MAX_SPEED = 4.05;
const STEER_SPEED = 6.8;
const ROTATION_DISTANCE_SCALE = 0.00034;
const STARTING_OBSTACLE_DISTANCE = 2300;
const VISIBLE_OBSTACLE_COUNT = 42;

// --- Types ---
export type InputState = {
  angleDirection: number; 
};

export type ObstaclePattern = "window" | "split" | "blades" | "pinwheel" | "beam" | "hole" | "wall" | "steps";

export type ObstacleLayer = {
  distance: number;
  blockedFaces: boolean[];
  pattern: ObstaclePattern;
  spinSpeed: number;
  phase: number;
  depth: number;
};

export type GameState = {
  distance: number;
  speed: number;
  playerAngle: number;
  status: "ready" | "running" | "paused" | "crashed";
  obstacles: ObstacleLayer[];
  combo: number;
  nextObstacleIndex: number;
};

// --- Engine Logic ---

function wrapAngle(angle: number) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function blockRun(blockedFaces: boolean[], start: number, length: number) {
  for (let i = 0; i < length; i++) {
    blockedFaces[(start + i + NUM_FACES) % NUM_FACES] = true;
  }
}

function clearRun(blockedFaces: boolean[], start: number, length: number) {
  for (let i = 0; i < length; i++) {
    blockedFaces[(start + i + NUM_FACES) % NUM_FACES] = false;
  }
}

function largestOpenRun(blockedFaces: boolean[]) {
  let best = 0;
  let current = 0;

  for (let i = 0; i < NUM_FACES * 2; i++) {
    if (!blockedFaces[i % NUM_FACES]) {
      current += 1;
      best = Math.max(best, Math.min(current, NUM_FACES));
    } else {
      current = 0;
    }
  }

  return best;
}

function ensureFairGap(blockedFaces: boolean[], fallbackGapStart: number) {
  if (largestOpenRun(blockedFaces) >= 2) return blockedFaces;
  clearRun(blockedFaces, fallbackGapStart, 2);
  return blockedFaces;
}

function makeBlockedFaces(pattern: ObstaclePattern, level: number) {
  const blockedFaces = Array<boolean>(NUM_FACES).fill(false);
  const gapStart = Math.floor(Math.random() * NUM_FACES);

  if (pattern === "beam") {
    blockRun(blockedFaces, gapStart, 1);
    blockRun(blockedFaces, gapStart + 4, 1);
  } else if (pattern === "hole") {
    blockedFaces.fill(true);
    clearRun(blockedFaces, gapStart, level < 3 ? 3 : 2);
  } else if (pattern === "wall") {
    blockRun(blockedFaces, gapStart, level < 2 ? 3 : 4);
  } else if (pattern === "window") {
    const wideGap = Math.max(2, 4 - Math.floor(level / 5));
    blockedFaces.fill(true);
    clearRun(blockedFaces, gapStart, wideGap);
  } else if (pattern === "split") {
    const wideGap = Math.max(2, 4 - Math.floor(level / 5));
    blockedFaces.fill(true);
    const gapSize = Math.max(2, wideGap - 1);
    clearRun(blockedFaces, gapStart, gapSize);
    clearRun(blockedFaces, gapStart + 4, gapSize);
  } else if (pattern === "blades") {
    blockRun(blockedFaces, gapStart, 2);
    blockRun(blockedFaces, gapStart + 3, 1);
    blockRun(blockedFaces, gapStart + 5, 1);
  } else if (pattern === "pinwheel") {
    blockedFaces.fill(false);
    blockRun(blockedFaces, gapStart, 2);
    blockRun(blockedFaces, gapStart + 3, 1);
    blockRun(blockedFaces, gapStart + 6, 1);
  } else if (pattern === "steps") {
    blockedFaces.fill(true);
    clearRun(blockedFaces, gapStart, 2);
    clearRun(blockedFaces, gapStart + 3, 1);
    clearRun(blockedFaces, gapStart + 6, 1);
  }

  return ensureFairGap(blockedFaces, gapStart);
}

function getObstacleDepth(pattern: ObstaclePattern, level: number) {
  const levelDepth = Math.min(56, level * 7);

  if (pattern === "beam") return 128 + levelDepth * 0.5;
  if (pattern === "blades" || pattern === "pinwheel") return 148 + levelDepth * 0.65;
  if (pattern === "hole" || pattern === "window") return OBSTACLE_DEPTH + levelDepth;

  return OBSTACLE_DEPTH + 18 + levelDepth;
}

function getGapAfterObstacle(distance: number, index: number) {
  const level = Math.floor(distance / LEVEL_LENGTH);
  const baseGap = Math.max(1900, 2500 - level * 95);
  const jitter = Math.max(350, 900 - level * 55);
  const rhythmOffset = (index % 4) * 80;

  return baseGap + rhythmOffset + Math.random() * jitter;
}

function carveStartingLane(obstacle: ObstacleLayer, index: number) {
  if (index > 1) return;

  const safeFace = Math.floor(wrapAngle(-obstacle.phase) / FACE_ANGLE) % NUM_FACES;
  clearRun(obstacle.blockedFaces, safeFace - 1, index === 0 ? 3 : 2);
}

export function getObstacleRotation(obstacle: ObstacleLayer, distance: number) {
  return wrapAngle(getObstacleRotationUnwrapped(obstacle, distance));
}

function getObstacleRotationUnwrapped(obstacle: ObstacleLayer, distance: number) {
  return obstacle.phase + distance * obstacle.spinSpeed * ROTATION_DISTANCE_SCALE;
}

export function generateObstacleLayer(distance: number, index = 0): ObstacleLayer {
  const level = Math.floor(distance / LEVEL_LENGTH);

  const patternDeck: ObstaclePattern[] =
    level < 2
      ? ["window", "hole", "wall", "split"]
      : level < 4
        ? ["window", "split", "beam", "wall", "hole", "steps"]
        : ["window", "split", "beam", "blades", "pinwheel", "hole", "wall", "steps"];

  const pattern = patternDeck[(index + Math.floor(Math.random() * patternDeck.length)) % patternDeck.length];
  const spinDirection = Math.random() > 0.5 ? 1 : -1;

  let spinSpeed = 0;
  if (pattern === "beam" || pattern === "pinwheel" || pattern === "blades") {
    spinSpeed = spinDirection * (1.15 + Math.random() * 1.35);
  } else if (level >= 1 && Math.random() > 0.4) {
    spinSpeed = spinDirection * (0.55 + Math.random() * 0.9);
  }

  const obstacle = {
    distance,
    blockedFaces: makeBlockedFaces(pattern, level),
    pattern,
    spinSpeed,
    phase: Math.floor(Math.random() * NUM_FACES) * FACE_ANGLE,
    depth: getObstacleDepth(pattern, level)
  };

  carveStartingLane(obstacle, index);
  return obstacle;
}

function appendObstacle(game: GameState) {
  const lastObstacle = game.obstacles[game.obstacles.length - 1];
  const lastDistance = lastObstacle?.distance ?? STARTING_OBSTACLE_DISTANCE;
  const nextDistance = game.obstacles.length === 0
    ? STARTING_OBSTACLE_DISTANCE
    : lastDistance + getGapAfterObstacle(lastDistance, game.nextObstacleIndex);

  game.obstacles.push(generateObstacleLayer(nextDistance, game.nextObstacleIndex));
  game.nextObstacleIndex += 1;
}

function replenishObstacles(game: GameState) {
  while (game.obstacles.length < VISIBLE_OBSTACLE_COUNT) {
    appendObstacle(game);
  }
}

export function createTunnelRushGame(): GameState {
  const game: GameState = {
    distance: 0,
    speed: 1.15,
    playerAngle: 0,
    status: "ready",
    obstacles: [],
    combo: 0,
    nextObstacleIndex: 0
  };

  replenishObstacles(game);
  return {
    ...game,
    obstacles: [...game.obstacles]
  };
}

function intervalOverlaps(aMin: number, aMax: number, bMin: number, bMax: number) {
  return aMin <= bMax && bMin <= aMax;
}

function sweepOverlapsBlockedFaces(
  blockedFaces: boolean[],
  startRelativeAngle: number,
  endRelativeAngle: number,
  radius = PLAYER_ANGULAR_RADIUS
) {
  const sweepMin = Math.min(startRelativeAngle, endRelativeAngle) - radius;
  const sweepMax = Math.max(startRelativeAngle, endRelativeAngle) + radius;

  for (let face = 0; face < NUM_FACES; face++) {
    if (!blockedFaces[face]) continue;

    const sectorStart = face * FACE_ANGLE;
    const sectorEnd = (face + 1) * FACE_ANGLE;
    const firstRepeat = Math.floor((sweepMin - sectorEnd) / TWO_PI) - 1;
    const lastRepeat = Math.ceil((sweepMax - sectorStart) / TWO_PI) + 1;

    for (let repeat = firstRepeat; repeat <= lastRepeat; repeat++) {
      const offset = repeat * TWO_PI;
      if (intervalOverlaps(sweepMin, sweepMax, sectorStart + offset, sectorEnd + offset)) {
        return true;
      }
    }
  }

  return false;
}

function relativePlayerAngleAt(
  obstacle: ObstacleLayer,
  oldDistance: number,
  travelDistance: number,
  oldPlayerAngle: number,
  playerAngleDelta: number,
  t: number
) {
  const distanceAtT = oldDistance + travelDistance * t;
  const angleAtT = oldPlayerAngle + playerAngleDelta * t;
  return angleAtT - getObstacleRotationUnwrapped(obstacle, distanceAtT);
}

function getSweptObstacleCollision(
  obstacle: ObstacleLayer,
  oldDistance: number,
  newDistance: number,
  oldPlayerAngle: number,
  newPlayerAngle: number
) {
  const travelDistance = newDistance - oldDistance;
  if (travelDistance <= 0) return null;

  const frontFace = obstacle.distance - obstacle.depth;
  const backFace = obstacle.distance;

  if (newDistance < frontFace || oldDistance > backFace) return null;

  const enterT = Math.max(0, (frontFace - oldDistance) / travelDistance);
  const exitT = Math.min(1, (backFace - oldDistance) / travelDistance);
  if (enterT > exitT) return null;

  const playerAngleDelta = newPlayerAngle - oldPlayerAngle;
  const collidesBetween = (startT: number, endT: number) => {
    const startRelativeAngle = relativePlayerAngleAt(
      obstacle,
      oldDistance,
      travelDistance,
      oldPlayerAngle,
      playerAngleDelta,
      startT
    );
    const endRelativeAngle = relativePlayerAngleAt(
      obstacle,
      oldDistance,
      travelDistance,
      oldPlayerAngle,
      playerAngleDelta,
      endT
    );

    return sweepOverlapsBlockedFaces(obstacle.blockedFaces, startRelativeAngle, endRelativeAngle);
  };

  if (!collidesBetween(enterT, exitT)) return null;

  let low = enterT;
  let high = exitT;

  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    if (collidesBetween(enterT, mid)) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return {
    t: high,
    distance: oldDistance + travelDistance * high
  };
}

export function doesObstacleBlockAngle(
  obstacle: ObstacleLayer,
  playerAngle: number,
  playerDistance: number,
  radius = PLAYER_ANGULAR_RADIUS
) {
  const relativeAngle = playerAngle - getObstacleRotationUnwrapped(obstacle, playerDistance);
  return sweepOverlapsBlockedFaces(obstacle.blockedFaces, relativeAngle, relativeAngle, radius);
}

export function stepTunnelRush(
  game: GameState,
  input: InputState,
  dt: number,
  events: {
    onCrash: (distance: number) => void;
    onPass: (combo: number) => void;
    onLevelUp: () => void;
  }
) {
  if (game.status !== "running") return;

  game.speed = Math.min(game.speed + 0.012 * dt, MAX_SPEED);

  const oldPlayerAngle = game.playerAngle;
  const newPlayerAngle = oldPlayerAngle + input.angleDirection * STEER_SPEED * dt;

  const oldDistance = game.distance;
  const newDistance = oldDistance + BASE_SPEED * game.speed * dt;

  let collision: ReturnType<typeof getSweptObstacleCollision> = null;

  for (const obstacle of game.obstacles) {
    const hit = getSweptObstacleCollision(obstacle, oldDistance, newDistance, oldPlayerAngle, newPlayerAngle);
    if (hit && (!collision || hit.distance < collision.distance)) {
      collision = hit;
    }
  }

  const finalDistance = collision?.distance ?? newDistance;
  const finalAngle = oldPlayerAngle + (newPlayerAngle - oldPlayerAngle) * (collision?.t ?? 1);

  if (Math.floor(oldDistance / LEVEL_LENGTH) < Math.floor(finalDistance / LEVEL_LENGTH)) {
    events.onLevelUp();
  }

  for (const obstacle of game.obstacles) {
    if (oldDistance <= obstacle.distance && finalDistance > obstacle.distance) {
      game.combo++;
      events.onPass(game.combo);
    }
  }

  game.distance = finalDistance;
  game.playerAngle = wrapAngle(finalAngle);

  if (collision) {
    game.status = "crashed";
    events.onCrash(Math.floor(finalDistance));
    return;
  }

  while (game.obstacles[0] && game.distance > game.obstacles[0].distance + 80) {
    game.obstacles.shift();
  }

  replenishObstacles(game);
}
