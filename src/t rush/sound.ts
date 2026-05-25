// Web Audio API Context
let ctx: AudioContext | null = null;
let isMuted = false;

export function initAudio() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AudioContextClass();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

export function toggleMute() {
  isMuted = !isMuted;
  return isMuted;
}

// --- SOUND EFFECTS ---

export function playPassSound(combo: number) {
  if (!ctx || isMuted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  const baseFreq = 600;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq + Math.min(combo * 20, 400), t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
  
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

export function playCrashSound() {
  if (!ctx || isMuted) return;
  const t = ctx.currentTime;
  
  const bufferSize = ctx.sampleRate * 0.5; 
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, t);
  filter.frequency.exponentialRampToValueAtTime(100, t + 0.5);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
}

export function playLevelUpSound() {
  if (!ctx || isMuted) return;
  const notes = [440, 554.37, 659.25, 880]; 
  notes.forEach((freq, i) => {
    const t = ctx!.currentTime + i * 0.08;
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);
    
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  });
}

// --- UI SOUNDS ---

export function playUIHover() {
  if (!ctx || isMuted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, t); // Quick, high-tech blip
  
  gain.gain.setValueAtTime(0.02, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

export function playUIClick() {
  if (!ctx || isMuted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'square';
  osc.frequency.setValueAtTime(880, t); // Sci-fi confirmation chirp
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.1);
  
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

// --- MUSIC ---

export function startBGM() {
  initAudio();
}

export function stopBGM() {
  // The low-frequency gameplay drone was removed; keep this no-op for callers.
}
