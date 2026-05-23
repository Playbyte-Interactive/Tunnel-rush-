// --- Core Constants ---
export const NUM_FACES = 8; 
export const FACE_ANGLE = (2 * Math.PI) / NUM_FACES;
export const LEVEL_LENGTH = 3000;
export const OBSTACLE_DEPTH = 320;
const TWO_PI = Math.PI * 2;

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
};

// --- Engine Logic ---

function wrapAngle(angle: number) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function makeBlockedFaces(pattern: ObstaclePattern, level: number) {
  const blockedFaces = Array(NUM_FACES).fill(false);
  const gapStart = Math.floor(Math.random() * NUM_FACES);

  if (pattern === "beam") {
    blockedFaces[gapStart % NUM_FACES] = true;
    blockedFaces[(gapStart + 4) % NUM_FACES] = true;
  } else if (pattern === "hole") {
    blockedFaces.fill(true);
    blockedFaces[gapStart % NUM_FACES] = false;
    blockedFaces[(gapStart + 1) % NUM_FACES] = false;
  } else if (pattern === "wall") {
    const size = Math.random() > 0.5 ? 3 : 4;
    for (let i = 0; i < size; i++) blockedFaces[(gapStart + i) % NUM_FACES] = true;
  } else if (pattern === "window") {
    const wideGap = Math.max(2, 4 - Math.floor(level / 5));
    blockedFaces.fill(true);
    for (let i = 0; i < wideGap; i++) blockedFaces[(gapStart + i) % NUM_FACES] = false;
  } else if (pattern === "split") {
    const wideGap = Math.max(2, 4 - Math.floor(level / 5));
    blockedFaces.fill(true);
    const gapSize = Math.max(2, wideGap - 1);
    for (let i = 0; i < gapSize; i++) {
      blockedFaces[(gapStart + i) % NUM_FACES] = false;
      blockedFaces[(gapStart + 4 + i) % NUM_FACES] = false;
    }
  } else if (pattern === "blades") {
    for (let i = 0; i < NUM_FACES; i++) blockedFaces[i] = i % 2 === 0;
    blockedFaces[gapStart] = false;
    blockedFaces[(gapStart + 1) % NUM_FACES] = false;
  } else if (pattern === "pinwheel") {
    blockedFaces.fill(false);
    for (let i = 0; i < NUM_FACES; i += 2) blockedFaces[(gapStart + i) % NUM_FACES] = true;
    blockedFaces[(gapStart + 2) % NUM_FACES] = false;
  } else if (pattern === "steps") {
    blockedFaces.fill(true);
    blockedFaces[gapStart] = false;
    blockedFaces[(gapStart + 1) % NUM_FACES] = false;
    blockedFaces[(gapStart + 3) % NUM_FACES] = false;
  }

  return blockedFaces;
}

export function getObstacleRotation(obstacle: ObstacleLayer, distance: number) {
  return wrapAngle(obstacle.phase + distance * obstacle.spinSpeed * 0.00034);
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
     spinSpeed = spinDirection * (1.2 + Math.random() * 1.5);
  } else if (level >= 1 && Math.random() > 0.4) {
     spinSpeed = spinDirection * (0.6 + Math.random() * 1.0);
  }

  return {
    distance,
    blockedFaces: makeBlockedFaces(pattern, level),
    pattern,
    spinSpeed,
    phase: Math.floor(Math.random() * NUM_FACES) * FACE_ANGLE,
    depth: OBSTACLE_DEPTH + Math.min(100, level * 10)
  };
}

export function createTunnelRushGame(): GameState {
  const obstacles: ObstacleLayer[] = [];
  let currentZ = 2200;
  
  for (let i = 0; i < 40; i++) {
    obstacles.push(generateObstacleLayer(currentZ, i));
    // Noticeably increased the distance gap between obstacles here
    const randomGap = 2000 + Math.random() * 1500; 
    currentZ += randomGap;
  }

  return {
    distance: 0,
    speed: 1.15,
    playerAngle: 0, 
    status: "ready",
    obstacles,
    combo: 0 
  };
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

  game.speed = Math.min(game.speed + 0.012 * dt, 4.2);

  const steerSpeed = 6.8; 
  game.playerAngle += input.angleDirection * steerSpeed * dt;
  game.playerAngle = wrapAngle(game.playerAngle);

  const baseSpeed = 1750;
  const oldDistance = game.distance;
  game.distance += baseSpeed * game.speed * dt;

  if (Math.floor(oldDistance / LEVEL_LENGTH) < Math.floor(game.distance / LEVEL_LENGTH)) {
    events.onLevelUp();
  }

  if (game.obstacles.length > 0) {
    const nextObstacle = game.obstacles[0];
    const frontFaceZ = nextObstacle.distance - nextObstacle.depth;
    const backFaceZ = nextObstacle.distance;

    const isInsideBlock = game.distance >= frontFaceZ && game.distance <= backFaceZ;
    const jumpedOverBlock = oldDistance < frontFaceZ && game.distance > backFaceZ;

    if (isInsideBlock || jumpedOverBlock) {
      const checkDistance = isInsideBlock ? game.distance : frontFaceZ;
      const obstacleRotation = getObstacleRotation(nextObstacle, checkDistance);
      
      const relAngle = wrapAngle(game.playerAngle - obstacleRotation);
      const currentFaceIndex = Math.floor((relAngle + FACE_ANGLE / 2) / FACE_ANGLE) % NUM_FACES;

      if (nextObstacle.blockedFaces[currentFaceIndex]) {
        game.status = "crashed";
        events.onCrash(Math.floor(game.distance));
        return; 
      }
    }

    if (oldDistance <= backFaceZ && game.distance > backFaceZ) {
      game.combo++;
      events.onPass(game.combo);
    }

    if (game.distance > backFaceZ + 400) {
      game.obstacles.shift();
      const lastZ = game.obstacles.length > 0 ? game.obstacles[game.obstacles.length - 1].distance : game.distance + 10000;
      // Noticeably increased the distance gap between dynamically spawned obstacles here
      const randomGap = 2000 + Math.random() * 1500;
      game.obstacles.push(generateObstacleLayer(lastZ + randomGap, game.combo + game.obstacles.length));
    }
  }
}