import { BadgeHelp, Gauge, Pause, Play, RotateCcw, Home, Trophy, Zap, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createTunnelRushGame, LEVEL_LENGTH, stepTunnelRush, type InputState } from "./t rush/tunnelRush";
import { drawTunnelRush } from "./t rush/renderTunnelRush";
import { 
  initAudio, startBGM, stopBGM, playCrashSound, 
  playPassSound, playLevelUpSound, toggleMute, 
  playUIClick, playUIHover 
} from "./t rush/sound";

const BEST_KEY = "tunnel-rush-classic-record";
const SCORE_DIVIDER = 50;  

function readBestDistance() {
  const value = Number(window.localStorage.getItem(BEST_KEY));
  return Number.isFinite(value) ? value : 0;
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef(createTunnelRushGame());
  const inputRef = useRef<InputState>({ angleDirection: 0 });
  const frameRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef(0);

  const [snapshot, setSnapshot] = useState(() => ({ ...gameRef.current }));
  const [bestDistance, setBestDistance] = useState(readBestDistance());
  const [isMuted, setIsMuted] = useState(false);
  const [showRules, setShowRules] = useState(() => window.localStorage.getItem("tunnel-rush-rules-seen") !== "true");

  const currentScore = Math.floor(snapshot.distance / SCORE_DIVIDER);
  const bestScore = Math.floor(bestDistance / SCORE_DIVIDER);
  const currentLevel = Math.floor(snapshot.distance / LEVEL_LENGTH) + 1;

  // --- Game State Controllers ---

  const handleStart = () => {
    initAudio(); 
    playUIClick();
    startBGM();
    gameRef.current = createTunnelRushGame();
    gameRef.current.status = "running";
    window.localStorage.setItem("tunnel-rush-rules-seen", "true");
    setShowRules(false);
    inputRef.current = { angleDirection: 0 };
    previousTimeRef.current = null;
    setSnapshot({ ...gameRef.current });
  };

  const handleResume = () => {
    playUIClick();
    startBGM();
    inputRef.current = { angleDirection: 0 };
    gameRef.current.status = "running";
    previousTimeRef.current = null;
    setSnapshot({ ...gameRef.current });
  };

  const handlePause = () => {
    if (gameRef.current.status === "running") {
      playUIClick();
      stopBGM();
      inputRef.current = { angleDirection: 0 };
      gameRef.current.status = "paused";
      setSnapshot({ ...gameRef.current });
    }
  };

  const handleQuitToMenu = () => {
    playUIClick();
    stopBGM();
    gameRef.current = createTunnelRushGame();
    gameRef.current.status = "ready";
    setSnapshot({ ...gameRef.current });
  };

  const handleToggleMute = () => {
    playUIClick();
    setIsMuted(toggleMute());
  };

  // --- Engine Loop ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect();
      const width = Math.floor(rect?.width ?? window.innerWidth);
      const height = Math.floor(rect?.height ?? window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTunnelRush(context, gameRef.current, { width, height });
    };

    const loop = (time: number) => {
      const previous = previousTimeRef.current ?? time;
      const dt = Math.min((time - previous) / 1000, 0.04);
      previousTimeRef.current = time;

      stepTunnelRush(gameRef.current, inputRef.current, dt, {
        onCrash: (finalDist: number) => {
          stopBGM();
          playCrashSound();
          if (finalDist > bestDistance) {
            window.localStorage.setItem(BEST_KEY, String(finalDist));
            setBestDistance(finalDist);
          }
        },
        onPass: (combo: number) => playPassSound(combo),
        onLevelUp: () => playLevelUpSound()
      });

      if (time - lastUiUpdateRef.current > 70 || gameRef.current.status !== snapshot.status) {
        lastUiUpdateRef.current = time;
        setSnapshot({ ...gameRef.current });
      }

      drawTunnelRush(context, gameRef.current, { width: canvas.clientWidth, height: canvas.clientHeight });
      frameRef.current = window.requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    frameRef.current = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [snapshot.status, bestDistance]);

  // --- Keyboard Bindings ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') inputRef.current.angleDirection = -1;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') inputRef.current.angleDirection = 1;
      
      if (e.key === ' ' || e.key === 'Escape') {
        if (gameRef.current.status === "running") handlePause();
        else if (gameRef.current.status === "paused") handleResume();
      }
      
      if (e.key === 'Enter' && gameRef.current.status !== "running" && gameRef.current.status !== "paused") {
        handleStart();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a' || 
          e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') inputRef.current.angleDirection = 0;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target instanceof Element && e.target.closest("button")) {
      return;
    }

    if (snapshot.status !== "running") return;
    const isLeftHalf = e.clientX < window.innerWidth / 2;
    inputRef.current.angleDirection = isLeftHalf ? -1 : 1;
  };

  const stopSteer = () => inputRef.current.angleDirection = 0;

  return (
    <main className="app">
      <section 
        className="playfield"
        onPointerDown={handlePointerDown}
        onPointerUp={stopSteer}
        onPointerLeave={stopSteer}
        onPointerCancel={stopSteer}
      >
        <canvas ref={canvasRef} />

        {/* --- HUD --- */}
        {(snapshot.status === "running" || snapshot.status === "paused") && (
          <>
            <div className="hud hud-top">
              <div className="brand-chip">
                <Zap size={16} />
              <span>Rush</span>
              </div>
              <div className="hud-buttons">
                <button 
                  className="icon-button" 
                  onPointerEnter={playUIHover}
                  onClick={(e) => { e.stopPropagation(); handleToggleMute(); }}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button
                  className="icon-button"
                  onPointerEnter={playUIHover}
                  onClick={(e) => { e.stopPropagation(); setShowRules(true); }}
                >
                  <BadgeHelp size={18} />
                </button>
                <button 
                  className="icon-button" 
                  onPointerEnter={playUIHover}
                  onClick={(e) => { e.stopPropagation(); snapshot.status === "paused" ? handleResume() : handlePause(); }}
                >
                  {snapshot.status === "paused" ? <Play size={18} /> : <Pause size={18} />}
                </button>
              </div>
            </div>

            <div className="hud stats-strip">
              <span>Score <strong style={{color: "var(--cyan)"}}>{currentScore}</strong></span>
              <span>Level <strong style={{color: "var(--gold)"}}>{currentLevel}</strong></span>
              <span>Speed <strong>{(snapshot.speed).toFixed(1)}x</strong></span>
              <span>Best <strong>{bestScore}</strong></span>
            </div>
          </>
        )}

        {/* --- OVERLAYS --- */}

        {snapshot.status === "ready" && !showRules && (
          <div className="state-panel">
            <p className="eyebrow">Neon Mode</p>
            <h1>Tunnel Rush</h1>
            
            <div className="final-stats">
              <span><Trophy size={16} /> High Score: {bestScore}</span>
            </div>

            <div className="panel-actions">
              <button 
                className="primary-button" 
                onPointerEnter={playUIHover} 
                onClick={handleStart}
              >
                <Play size={18} /> START GAME
              </button>
            </div>
            <p style={{ marginTop: "20px", fontSize: "0.8rem", color: "var(--muted)" }}>
              Tap left/right sides to steer
            </p>
          </div>
        )}

        {showRules && (
          <div className="state-panel">
            <p className="eyebrow">How to Play</p>
            <h1>Tunnel Rush</h1>
            <p style={{ margin: "18px 0 0", color: "var(--muted)", lineHeight: 1.45 }}>
              Hold either side to steer the tunnel line through the open gaps. Red walls end the run.
            </p>
            <div className="panel-actions">
              <button
                className="primary-button"
                onPointerEnter={playUIHover}
                onClick={() => {
                  window.localStorage.setItem("tunnel-rush-rules-seen", "true");
                  setShowRules(false);
                }}
              >
                <Play size={18} /> GOT IT
              </button>
            </div>
          </div>
        )}

        {snapshot.status === "paused" && !showRules && (
          <div className="state-panel">
            <p className="eyebrow">Take a breath</p>
            <h1>PAUSED</h1>

            <div className="panel-actions" style={{ flexDirection: "column", gap: "10px" }}>
              <button className="primary-button" onPointerEnter={playUIHover} onClick={handleResume}>
                <Play size={18} /> RESUME
              </button>
              <button className="primary-button" onPointerEnter={playUIHover} onClick={handleStart} style={{ background: "transparent", color: "var(--text)" }}>
                <RotateCcw size={18} /> RESTART
              </button>
              <button className="primary-button" onPointerEnter={playUIHover} onClick={handleQuitToMenu} style={{ background: "rgba(255, 60, 60, 0.2)", color: "#ff8888", borderColor: "rgba(255, 60, 60, 0.4)" }}>
                <Home size={18} /> QUIT
              </button>
            </div>
          </div>
        )}

        {snapshot.status === "crashed" && !showRules && (
          <div className="state-panel" style={{ borderColor: "rgba(255, 60, 60, 0.6)" }}>
            <p className="eyebrow" style={{ color: "#ff5555" }}>Impact Detected</p>
            <h1 style={{ color: "#ff4444" }}>CRASHED</h1>
            
            <div className="final-stats">
              <span><Gauge size={16} /> Score: {currentScore}</span>
              <span style={{ borderLeft: "1px solid rgba(255,255,255,0.2)", paddingLeft: "10px" }}>Best: {bestScore}</span>
            </div>

            <div className="panel-actions" style={{ flexDirection: "column", gap: "10px" }}>
              <button className="primary-button" onPointerEnter={playUIHover} onClick={handleStart}>
                <RotateCcw size={18} /> RETRY RUN
              </button>
              <button className="primary-button" onPointerEnter={playUIHover} onClick={handleQuitToMenu} style={{ background: "transparent", color: "var(--text)" }}>
                <Home size={18} /> MAIN MENU
              </button>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}