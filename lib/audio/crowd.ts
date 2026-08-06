// Synthesized crowd reactions — filtered noise + a couple of oscillators,
// entirely generated in-browser via the Web Audio API. No audio assets.

let sharedContext: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedContext) sharedContext = new AudioCtx();
  if (sharedContext.state === "suspended") sharedContext.resume().catch(() => {});
  return sharedContext;
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) return noiseBuffer;
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/** Call from a real click/tap so the browser's autoplay gate unlocks before the first reaction needs to play. */
export function unlockCrowdAudio(): void {
  getContext();
}

function playNoiseSwell(
  context: AudioContext,
  opts: { startFreq: number; endFreq: number; filterType: BiquadFilterType; duration: number; peakGain: number }
) {
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  source.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = opts.filterType;
  filter.Q.value = 0.9;
  const now = context.currentTime;
  filter.frequency.setValueAtTime(opts.startFreq, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(opts.endFreq, 40), now + opts.duration);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(opts.peakGain, now + Math.min(0.15, opts.duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

  source.connect(filter).connect(gain).connect(context.destination);
  source.start(now);
  source.stop(now + opts.duration + 0.05);
}

function playTone(
  context: AudioContext,
  opts: { startFreq: number; endFreq: number; type: OscillatorType; duration: number; peakGain: number; delay?: number }
) {
  const osc = context.createOscillator();
  osc.type = opts.type;
  const now = context.currentTime + (opts.delay ?? 0);
  osc.frequency.setValueAtTime(opts.startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(opts.endFreq, 40), now + opts.duration);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(opts.peakGain, now + Math.min(0.12, opts.duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

  osc.connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + opts.duration + 0.05);
}

/** A crowd cheer — noise swelling upward in pitch, scaled by intensity (0-1). */
export function playCheer(intensity: number): void {
  const context = getContext();
  if (!context) return;
  const clamped = Math.max(0, Math.min(1, intensity));
  const duration = 0.9 + clamped * 1.1;
  playNoiseSwell(context, {
    startFreq: 500,
    endFreq: 1800 + clamped * 1200,
    filterType: "bandpass",
    duration,
    peakGain: 0.08 + clamped * 0.32,
  });
  if (clamped > 0.6) {
    playTone(context, { startFreq: 500, endFreq: 1100, type: "triangle", duration: 0.4, peakGain: 0.05 + clamped * 0.1, delay: 0.05 });
  }
}

/** A crowd boo/groan — noise descending in pitch, scaled by intensity (0-1). */
export function playBoo(intensity: number): void {
  const context = getContext();
  if (!context) return;
  const clamped = Math.max(0, Math.min(1, intensity));
  const duration = 1.0 + clamped * 1.1;
  playNoiseSwell(context, {
    startFreq: 380,
    endFreq: 130,
    filterType: "lowpass",
    duration,
    peakGain: 0.08 + clamped * 0.3,
  });
  playTone(context, {
    startFreq: 220,
    endFreq: 90,
    type: "sawtooth",
    duration: duration * 0.8,
    peakGain: 0.04 + clamped * 0.12,
    delay: 0.05,
  });
}
