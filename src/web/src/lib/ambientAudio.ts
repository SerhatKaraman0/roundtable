/**
 * Procedural Study & Fireplace Ambience using the Web Audio API.
 * Synthesizes a soft, warm hearth rumble and gentle intermittent ember crackles
 * with zero external audio assets or network downloads.
 */

type Listener = (muted: boolean) => void;

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isMutedState = false;
let isStartedState = false;
const listeners: Set<Listener> = new Set();

function notifyListeners() {
  listeners.forEach((l) => l(isMutedState));
}

function createCrackleBuffer(ctx: AudioContext): AudioBuffer {
  // 3 seconds of sparse crackle / fireplace ember impulses
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 3;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    // Sparse crackle impulses (approx 1 every 400-800 samples on average)
    if (Math.random() < 0.0022) {
      const burstLen = Math.floor(Math.random() * 8) + 2;
      const amplitude = (Math.random() * 0.7 + 0.3) * (Math.random() < 0.5 ? 1 : -1);
      for (let j = 0; j < burstLen && i + j < length; j++) {
        data[i + j] = amplitude * Math.exp(-j / 2.5);
      }
      i += burstLen;
    } else {
      data[i] = 0;
    }
  }

  return buffer;
}

export function isAmbienceMuted(): boolean {
  return isMutedState;
}

export function isAmbienceStarted(): boolean {
  return isStartedState;
}

export function subscribeAmbience(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function startAmbience(): Promise<void> {
  if (typeof window === 'undefined') return;

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(isMutedState ? 0.0 : 0.15, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    // ── 1. Warm Study Room Rumble (Brownian-ish low drone) ──
    const rumbleLowpass = audioCtx.createBiquadFilter();
    rumbleLowpass.type = 'lowpass';
    rumbleLowpass.frequency.setValueAtTime(110, audioCtx.currentTime);

    // Detuned low oscillators for realistic room warmth
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, audioCtx.currentTime);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(74, audioCtx.currentTime);

    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.04, audioCtx.currentTime);

    osc1.connect(rumbleLowpass);
    osc2.connect(rumbleLowpass);
    rumbleLowpass.connect(oscGain);
    oscGain.connect(masterGain);

    osc1.start();
    osc2.start();

    // ── 2. Fireplace / Candle Ember Crackle ──
    const crackleBuffer = createCrackleBuffer(audioCtx);
    const crackleSource = audioCtx.createBufferSource();
    crackleSource.buffer = crackleBuffer;
    crackleSource.loop = true;

    const crackleFilter = audioCtx.createBiquadFilter();
    crackleFilter.type = 'bandpass';
    crackleFilter.frequency.setValueAtTime(1800, audioCtx.currentTime);
    crackleFilter.Q.setValueAtTime(1.5, audioCtx.currentTime);

    const crackleGain = audioCtx.createGain();
    crackleGain.gain.setValueAtTime(0.07, audioCtx.currentTime);

    crackleSource.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(masterGain);

    crackleSource.start();
    isStartedState = true;
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

export function toggleAmbienceMute(): boolean {
  isMutedState = !isMutedState;

  if (audioCtx && masterGain) {
    const targetGain = isMutedState ? 0.0 : 0.15;
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.05);
  }

  // If unmuting for the first time before started, try to start
  if (!isStartedState && !isMutedState) {
    startAmbience().catch(() => {});
  }

  notifyListeners();
  return isMutedState;
}
