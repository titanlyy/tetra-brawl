let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let muted = false;
let nextBeat = 0;
let step = 0;

const SCALE = [110, 130.81, 146.83, 164.81, 196, 164.81, 146.83, 130.81];

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    master.gain.value = 0.9;
    musicBus.gain.value = 0.22;
    sfxBus.gain.value = 0.8;
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

export function setMuted(next: boolean) {
  muted = next;
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.03);
}

export function isMuted() {
  return muted;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
  bus: "sfx" | "music" = "sfx",
) {
  const audio = ensure();
  if (!audio || !master || muted) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(bus === "music" ? musicBus! : sfxBus!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function sfxMove() {
  tone(720 + Math.random() * 80, 0.04, "square", 0.03);
}

export function sfxRotate() {
  tone(480, 0.05, "triangle", 0.05);
}

export function sfxLock() {
  tone(130, 0.07, "square", 0.05);
}

export function sfxHold() {
  tone(300, 0.06, "sine", 0.04);
}

export function sfxClear(kind: "jab" | "rush" | "crush" | "super") {
  const notes = kind === "super" ? [523, 659, 784, 1046] : kind === "crush" ? [440, 554, 659] : kind === "rush" ? [392, 523] : [494];
  notes.forEach((n, i) => tone(n, 0.12, "square", kind === "super" ? 0.07 : 0.05, i * 0.06));
}

export function sfxHit() {
  tone(90, 0.12, "sawtooth", 0.04);
  tone(180, 0.08, "square", 0.03);
}

export function sfxCounter() {
  tone(880, 0.08, "triangle", 0.06);
  tone(1320, 0.1, "sine", 0.04, 0.05);
}

export function sfxFight() {
  tone(220, 0.16, "square", 0.06);
  tone(330, 0.18, "triangle", 0.05, 0.04);
}

export function sfxKo() {
  tone(196, 0.3, "sawtooth", 0.06);
  tone(98, 0.45, "square", 0.05, 0.08);
}

export function musicPulse() {
  const audio = ensure();
  if (!audio || muted || !musicBus) return;
  if (audio.currentTime < nextBeat) return;
  const freq = SCALE[step % SCALE.length] ?? 110;
  tone(freq / 2, 0.18, "sine", 0.05, 0, "music");
  if (step % 2 === 0) tone(freq, 0.08, "triangle", 0.02, 0, "music");
  step += 1;
  nextBeat = audio.currentTime + 0.32;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}
