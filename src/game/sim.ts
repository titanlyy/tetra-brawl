import {
  musicPulse,
  sfxClear,
  sfxCounter,
  sfxFight,
  sfxHit,
  sfxHold,
  sfxKo,
  sfxLock,
  sfxMove,
  sfxRotate,
} from "./audio.ts";
import { Cpu } from "./cpu.ts";
import {
  Board,
  COLS,
  boardToSnap,
  emptyView,
  type BoardView,
  type Snap,
  type StepResult,
} from "./engine.ts";
import { fighterById, type FighterId } from "./fighters.ts";
import { layoutFor, type Callout, type Particle, type Scene } from "./draw.ts";
import type { ClearKind } from "./kinds.ts";

export interface Pad {
  left: boolean;
  right: boolean;
  soft: boolean;
  rotCW: number;
  rotCCW: number;
  hard: number;
  hold: number;
  nudge: number;
}

export function emptyPad(): Pad {
  return { left: false, right: false, soft: false, rotCW: 0, rotCCW: 0, hard: 0, hold: 0, nudge: 0 };
}

export interface Outcome {
  winner: "you" | "rival" | "draw";
  reason: string;
}

export interface OutHit {
  id: number;
  n: number;
  kind: string;
}

export interface InHit {
  id: number;
  n: number;
  kind: string;
}

interface Env {
  w: number;
  h: number;
  paused: boolean;
  reduced: boolean;
  remoteKo: boolean;
  inbound: InHit[];
  link: string;
}

const ATTACK = 0.48;
const DAS = 0.13;
const ARR = 0.02;

export class Sim {
  readonly mode: "cpu" | "online";
  readonly you: Board;
  readonly rivalBoard: Board | null;
  readonly youId: FighterId;
  readonly rivalId: FighterId;
  readonly youName: string;
  readonly rivalName: string;
  private readonly cpu: Cpu | null;
  private countdown = 3.3;
  private matchTime = 0;
  private time = 0;
  private shake = 0;
  private hitstop = 0;
  private winner: Outcome["winner"] | null = null;
  private reason = "";
  private reported = false;
  private pending: Outcome | null = null;
  private youAttack = 0;
  private youHit = 0;
  private rivalAttack = 0;
  private rivalHit = 0;
  private callouts: Callout[] = [];
  private particles: Particle[] = [];
  private dasDir = 0;
  private dasTimer = 0;
  private arrTimer = 0;
  private hitId = 1;
  private seen = new Set<number>();
  private youSerial = -1;
  private rivalSerial = -1;
  private fought = false;

  constructor(opts: {
    mode: "cpu" | "online";
    you: FighterId;
    youName: string;
    rival: FighterId;
    rivalName: string;
    seed?: number;
  }) {
    this.mode = opts.mode;
    this.youId = opts.you;
    this.rivalId = opts.rival;
    this.youName = opts.youName;
    this.rivalName = opts.rivalName;
    const seed = opts.seed ?? (Math.floor(Math.random() * 1e9) >>> 0);
    this.you = new Board(mulberry(seed));
    if (opts.mode === "cpu") {
      this.rivalBoard = new Board(mulberry(seed ^ 0x9e3779b9));
      this.cpu = new Cpu();
    } else {
      this.rivalBoard = null;
      this.cpu = null;
    }
    this.youSerial = this.you.spawnSerial;
  }

  snap(): Snap {
    return boardToSnap(this.you);
  }

  scene(opts: { reduced: boolean; link: string; paused: boolean; remote: BoardView | null }): Scene {
    return {
      time: this.time,
      shake: this.shake,
      countdown: Math.max(0, this.countdown),
      paused: opts.paused && !this.winner,
      winner: this.winner,
      reason: this.reason,
      you: {
        name: this.youName,
        fighter: this.youId,
        view: this.you.toView(),
        attack: this.youAttack,
        hit: this.youHit,
      },
      rival: {
        name: this.rivalName,
        fighter: this.rivalId,
        view: opts.remote ?? (this.rivalBoard ? this.rivalBoard.toView() : emptyView()),
        attack: this.rivalAttack,
        hit: this.rivalHit,
      },
      callouts: this.callouts,
      particles: this.particles,
      reduced: opts.reduced,
      link: opts.link,
    };
  }

  update(dt: number, pad: Pad, env: Env): { outcome: Outcome | null; hits: OutHit[] } {
    const hits: OutHit[] = [];
    this.time += dt;
    this.decay(dt);
    this.shake = Math.max(0, this.shake - dt * 26);

    if (this.countdown > 0) {
      this.countdown -= dt;
      if (this.countdown <= 0 && !this.fought) {
        this.fought = true;
        sfxFight();
      }
      swallow(pad);
      return { outcome: null, hits };
    }
    if (this.winner) {
      swallow(pad);
      return { outcome: this.pending, hits };
    }
    if (env.paused) {
      swallow(pad);
      return { outcome: null, hits };
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      swallow(pad);
      return { outcome: null, hits };
    }

    this.matchTime += dt;
    if (this.mode === "online") this.absorb(env.inbound, env);
    this.you.soft = pad.soft;
    const moved = this.steer(pad, dt);
    if (moved) sfxMove();
    if (pad.rotCW > 0) {
      if (this.you.rotate(1)) sfxRotate();
      pad.rotCW = 0;
    } else if (pad.rotCCW > 0) {
      if (this.you.rotate(-1)) sfxRotate();
      pad.rotCCW = 0;
    }
    let youEv: StepResult | null = null;
    if (pad.hard > 0) {
      youEv = this.you.hardDrop();
      pad.hard = 0;
    }
    if (pad.hold > 0) {
      const before = this.you.hold;
      this.you.doHold();
      if (this.you.hold !== before) sfxHold();
      pad.hold = 0;
    }
    const ticked = this.you.tick(dt, this.matchTime);
    if (!youEv) youEv = ticked;
    if (this.you.spawnSerial !== this.youSerial) {
      this.youSerial = this.you.spawnSerial;
      if (!youEv?.lines) sfxLock();
    }

    let rivalEv: StepResult | null = null;
    if (this.rivalBoard && this.cpu) {
      const fromCpu = this.cpu.act(dt, this.rivalBoard);
      const fromTick = this.rivalBoard.tick(dt, this.matchTime);
      rivalEv = fromCpu ?? fromTick;
      if (this.rivalBoard.spawnSerial !== this.rivalSerial) this.rivalSerial = this.rivalBoard.spawnSerial;
    }

    if (youEv?.lines) {
      if (this.rivalBoard) this.rivalBoard.incoming += youEv.outgoing;
      this.react("you", youEv, env);
      if (this.mode === "online" && youEv.kind) {
        hits.push({ id: this.hitId, n: youEv.outgoing, kind: youEv.kind });
        this.hitId += 1;
      }
    }
    if (rivalEv?.lines) {
      this.you.incoming += rivalEv.outgoing;
      this.react("rival", rivalEv, env);
    }

    musicPulse();
    this.finishIfNeeded(env.remoteKo);
    const outcome = this.pending;
    this.pending = null;
    return { outcome, hits };
  }

  private absorb(inbound: InHit[], env: Env) {
    for (let i = inbound.length - 1; i >= 0; i -= 1) {
      const hit = inbound[i];
      if (!hit || this.seen.has(hit.id)) {
        inbound.splice(i, 1);
        continue;
      }
      this.seen.add(hit.id);
      inbound.splice(i, 1);
      this.you.incoming += Math.max(0, hit.n);
      this.rivalAttack = ATTACK;
      this.youHit = 0.32;
      const kind = (hit.kind as ClearKind) || "jab";
      this.shake = Math.max(this.shake, amp(kind));
      this.burst(env, "rival", kind);
      if (hit.n > 0) sfxHit();
      if (kind === "super" || kind === "crush") {
        const move = moveName(this.rivalId, kind);
        this.pushCallout(move, kind === "super");
      }
    }
  }

  private react(who: "you" | "rival", ev: StepResult, env: Env) {
    const kind = ev.kind ?? "jab";
    if (who === "you") {
      this.youAttack = ATTACK;
      this.rivalHit = 0.32;
    } else {
      this.rivalAttack = ATTACK;
      this.youHit = 0.32;
    }
    this.shake = Math.max(this.shake, amp(kind));
    if (kind === "super") this.hitstop = Math.max(this.hitstop, 0.09);
    else if (kind === "crush") this.hitstop = Math.max(this.hitstop, 0.045);
    if (ev.cancelled > 0 && ev.outgoing === 0) {
      this.pushCallout("COUNTER", false);
      sfxCounter();
    } else if (ev.combo >= 3) this.pushCallout(`CHAIN ${ev.combo}`, false);
    else this.pushCallout(moveName(who === "you" ? this.youId : this.rivalId, kind), kind === "super");
    sfxClear(kind);
    if (ev.outgoing > 0) sfxHit();
    this.burst(env, who, kind);
  }

  private burst(env: Env, who: "you" | "rival", kind: ClearKind) {
    const layout = layoutFor(env.w, env.h);
    const from = who === "you" ? layout.you : layout.rival;
    const foot = who === "you" ? layout.rivalFoot : layout.youFoot;
    const color = fighterById(who === "you" ? this.youId : this.rivalId).color;
    const n = kind === "super" ? 28 : kind === "crush" ? 16 : 8;
    for (let i = 0; i < n; i += 1) {
      const col = Math.floor(Math.random() * COLS);
      const row = Math.floor(Math.random() * 6);
      this.particles.push({
        x: from.x + col * from.cell,
        y: from.y + row * from.cell,
        vx: (foot.x - from.x) * (0.6 + Math.random()) + (Math.random() - 0.5) * 80,
        vy: -40 - Math.random() * 160,
        life: 0.35 + Math.random() * 0.3,
        max: 0.65,
        color,
        size: 2 + Math.random() * 3,
      });
    }
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 90 + Math.random() * 220;
      this.particles.push({
        x: foot.x,
        y: foot.y - layout.fighterH * 0.45,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.25,
        max: 0.5,
        color: i % 2 ? "#f3efe6" : color,
        size: 2 + Math.random() * 4,
      });
    }
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }

  private pushCallout(text: string, big: boolean) {
    this.callouts.push({ text, life: big ? 1.05 : 0.75, max: big ? 1.05 : 0.75, big });
    if (this.callouts.length > 4) this.callouts.shift();
  }

  private steer(pad: Pad, dt: number): boolean {
    let moved = false;
    while (pad.nudge !== 0) {
      const dir = pad.nudge > 0 ? 1 : -1;
      pad.nudge -= dir;
      moved = this.you.shift(dir) || moved;
    }
    const dir = (pad.left ? -1 : 0) + (pad.right ? 1 : 0);
    if (dir === 0 || (pad.left && pad.right)) {
      this.dasDir = 0;
      this.dasTimer = 0;
      this.arrTimer = 0;
      return moved;
    }
    if (moved) {
      this.dasDir = dir;
      this.dasTimer = 0;
      this.arrTimer = 0;
      return true;
    }
    if (dir !== this.dasDir) {
      this.dasDir = dir;
      this.dasTimer = 0;
      this.arrTimer = 0;
      return this.you.shift(dir);
    }
    this.dasTimer += dt;
    if (this.dasTimer < DAS) return false;
    this.arrTimer += dt;
    while (this.arrTimer >= ARR) {
      this.arrTimer -= ARR;
      moved = this.you.shift(dir) || moved;
    }
    return moved;
  }

  private decay(dt: number) {
    this.youAttack = Math.max(0, this.youAttack - dt);
    this.youHit = Math.max(0, this.youHit - dt);
    this.rivalAttack = Math.max(0, this.rivalAttack - dt);
    this.rivalHit = Math.max(0, this.rivalHit - dt);
    for (const c of this.callouts) c.life -= dt;
    this.callouts = this.callouts.filter((c) => c.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 520 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private finishIfNeeded(remoteKo: boolean) {
    if (this.winner) return;
    const youDead = this.you.ko;
    const rivalDead = this.mode === "cpu" ? !!this.rivalBoard?.ko : remoteKo;
    if (youDead && rivalDead) this.finish("draw", "Both wells filled.");
    else if (youDead) this.finish("rival", "Your well filled up.");
    else if (rivalDead) this.finish("you", "Their well filled up.");
  }

  private finish(winner: Outcome["winner"], reason: string) {
    this.winner = winner;
    this.reason = reason;
    this.shake = Math.max(this.shake, 18);
    sfxKo();
    if (!this.reported) {
      this.reported = true;
      this.pending = { winner, reason };
    }
  }
}

function swallow(pad: Pad) {
  pad.rotCW = 0;
  pad.rotCCW = 0;
  pad.hard = 0;
  pad.hold = 0;
  pad.nudge = 0;
}

function amp(kind: ClearKind): number {
  if (kind === "super") return 16;
  if (kind === "crush") return 9;
  if (kind === "rush") return 6;
  return 3;
}

function moveName(id: FighterId, kind: ClearKind): string {
  const moves = fighterById(id).moves;
  if (kind === "super") return moves.super;
  if (kind === "crush") return moves.crush;
  if (kind === "rush") return moves.rush;
  return moves.jab;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
