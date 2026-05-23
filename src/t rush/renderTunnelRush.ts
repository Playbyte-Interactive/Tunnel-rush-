import { GameState, NUM_FACES, FACE_ANGLE, ObstacleLayer, getObstacleRotation, LEVEL_LENGTH } from "./tunnelRush";

// Progressive Dark Themes
function getLevelColors(level: number) {
  const themes = [
    { main: "#ff2a2a", d1: "#a60000", d2: "#7a0000", d3: "#d90000", wire: "rgba(255, 60, 60, 0.6)", bg1: "#0a0000", bg2: "#140000" },
    { main: "#00f0ff", d1: "#008b99", d2: "#00636e", d3: "#00bacd", wire: "rgba(0, 180, 255, 0.5)", bg1: "#00050d", bg2: "#000a1a" },
    { main: "#39ff14", d1: "#1f9909", d2: "#146605", d3: "#2cc40c", wire: "rgba(50, 255, 50, 0.4)", bg1: "#000a00", bg2: "#001400" },
    { main: "#d000ff", d1: "#660080", d2: "#400050", d3: "#8c00b3", wire: "rgba(180, 0, 255, 0.3)", bg1: "#05000a", bg2: "#0a0014" },
    { main: "#ffae00", d1: "#996800", d2: "#664500", d3: "#cc8b00", wire: "rgba(255, 150, 0, 0.2)", bg1: "#0a0500", bg2: "#140a00" },
    { main: "#ff003c", d1: "#80001e", d2: "#4d0012", d3: "#b3002a", wire: "rgba(255, 0, 50, 0.1)", bg1: "#030001", bg2: "#060002" }
  ];
  return themes[level % themes.length];
}

export function drawTunnelRush(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  dimensions: { width: number; height: number }
) {
  const { width, height } = dimensions;
  
  const centerX = width / 2;
  const centerY = height * 0.42; 

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const maxTunnelDistance = 5500;
  const ringStep = 200;
  const visibleRings = Math.floor(maxTunnelDistance / ringStep);
  
  const offsetZ = game.distance % ringStep;

  const BASE_SIZE = Math.min(width, height);
  const TUNNEL_RADIUS = BASE_SIZE * 0.75;
  const CAMERA_Y_OFFSET = TUNNEL_RADIUS * 0.65; 
  const FOCAL_LENGTH = BASE_SIZE * 0.85;

  const currentLevel = Math.floor(game.distance / LEVEL_LENGTH);

  const getTwistAtZ = (z: number) => {
    const globalZ = game.distance + z;
    const levelBend = Math.sin(currentLevel * 1.5 + globalZ / 2500) * 0.12;
    return -game.playerAngle + Math.PI / 2 + levelBend;
  };

  const project = (angle: number, z: number, innerScale = 1) => {
    const relZ = Math.max(5, z); 
    
    const x3d = Math.cos(angle) * (TUNNEL_RADIUS * innerScale);
    const y3d = Math.sin(angle) * (TUNNEL_RADIUS * innerScale);

    const yCam = y3d - CAMERA_Y_OFFSET;
    const scale = FOCAL_LENGTH / relZ;

    return {
      x: centerX + x3d * scale,
      y: centerY + yCam * scale
    };
  };

  const drawPolygon = (p1: any, p2: any, p3: any, p4: any, fillHex: string, strokeHex: string, z: number, lineWidth = 1) => {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    
    ctx.fillStyle = fillHex;
    ctx.fill();
    
    if (strokeHex !== "none") {
      ctx.strokeStyle = strokeHex;
      ctx.lineWidth = Math.max(0.1, (lineWidth * 400) / Math.max(100, z)); 
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    const fog = Math.max(0, Math.min(1, Math.pow(z / maxTunnelDistance, 1.8)));
    if (fog > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${fog})`;
      ctx.fill();
      if (strokeHex !== "none") {
        ctx.strokeStyle = `rgba(0, 0, 0, ${fog})`;
        ctx.lineWidth = ctx.lineWidth + 0.5; 
        ctx.stroke();
      }
    }
  };

  type RenderItem = 
    | { type: 'tunnel', z: number, nextZ: number, globalZ: number }
    | { type: 'obstacle', z: number, obs: ObstacleLayer };

  const renderItems: RenderItem[] = [];

  for (let i = 0; i <= visibleRings; i++) {
    const z = i * ringStep - offsetZ;
    if (z > -ringStep) {
      renderItems.push({ type: 'tunnel', z: Math.max(0, z), nextZ: z + ringStep, globalZ: game.distance + z });
    }
  }

  game.obstacles.forEach((obs) => {
    const z = obs.distance - game.distance;
    if (z > -obs.depth && z <= maxTunnelDistance) {
      renderItems.push({ type: 'obstacle', z: Math.max(0, z), obs });
    }
  });

  renderItems.sort((a, b) => b.z - a.z);

  renderItems.forEach(item => {
    if (item.type === 'tunnel') {
      const twist1 = getTwistAtZ(item.z);
      const twist2 = getTwistAtZ(item.nextZ);
      
      const segLevel = Math.floor(item.globalZ / LEVEL_LENGTH);
      const colors = getLevelColors(segLevel);

      for (let j = 0; j < NUM_FACES; j++) {
        const a1 = j * FACE_ANGLE + twist1;
        const a2 = (j + 1) * FACE_ANGLE + twist1;
        const na1 = j * FACE_ANGLE + twist2;
        const na2 = (j + 1) * FACE_ANGLE + twist2;

        const p1 = project(a1, item.z);
        const p2 = project(a2, item.z);
        const p3 = project(na2, item.nextZ);
        const p4 = project(na1, item.nextZ);

        const isAlt = (j + Math.floor(item.globalZ / ringStep)) % 2 === 0;
        const faceColor = isAlt ? colors.bg1 : colors.bg2;

        drawPolygon(p1, p2, p3, p4, faceColor, colors.wire, item.z, 0.9);
      }
    } else {
      const thickness = item.obs.depth; 
      const frontZ = Math.max(5, item.z - thickness);
      const obstacleRotation = getObstacleRotation(item.obs, game.distance);
      
      const twistBack = getTwistAtZ(item.z) + obstacleRotation;
      const twistFront = getTwistAtZ(frontZ) + obstacleRotation;

      const obsLevel = Math.floor(item.obs.distance / LEVEL_LENGTH);
      const colors = getLevelColors(obsLevel);

      // This logic defines how the shapes look
      let innerScale = 0.25; 
      if (item.obs.pattern === "pinwheel" || item.obs.pattern === "blades") innerScale = 0.08; 
      if (item.obs.pattern === "beam") innerScale = 0.02; // Stretches fully across the center to form a bar

      for (let j = 0; j < NUM_FACES; j++) {
        if (item.obs.blockedFaces[j]) {
          const a1Back = j * FACE_ANGLE + twistBack;
          const a2Back = (j + 1) * FACE_ANGLE + twistBack;
          const a1Front = j * FACE_ANGLE + twistFront;
          const a2Front = (j + 1) * FACE_ANGLE + twistFront;

          const pb1 = project(a1Back, item.z);
          const pb2 = project(a2Back, item.z);
          const pb3 = project(a2Back, item.z, innerScale);
          const pb4 = project(a1Back, item.z, innerScale);

          const pf1 = project(a1Front, frontZ);
          const pf2 = project(a2Front, frontZ);
          const pf3 = project(a2Front, frontZ, innerScale);
          const pf4 = project(a1Front, frontZ, innerScale);

          // Culling logic properly hides walls touching each other to fix geometry artifacts
          const isLeftBlocked = item.obs.blockedFaces[(j - 1 + NUM_FACES) % NUM_FACES];
          const isRightBlocked = item.obs.blockedFaces[(j + 1) % NUM_FACES];

          if (!isLeftBlocked) drawPolygon(pb1, pf1, pf4, pb4, colors.d1, "none", frontZ); 
          if (!isRightBlocked) drawPolygon(pb2, pf2, pf3, pb3, colors.d2, "none", frontZ); 
          
          drawPolygon(pb4, pf4, pf3, pb3, colors.d3, "none", frontZ); 
          
          drawPolygon(pf1, pf2, pf3, pf4, colors.main, "#ffffff", frontZ, 1.2); 
        }
      }
    }
  });
}