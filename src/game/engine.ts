import { attackOf, clearKind, resolveAttack, type ClearKind, type Spin } from "./kinds.ts";

export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 2;
export const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
export const GARBAGE = 8;
export const SPAWN_X = 3;

export type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export const PIECE_INDEX: Record<PieceId, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

type Mino = readonly [number, number];
type Kick = readonly [number, number];

const ROT: Record<PieceId, readonly (readonly Mino[])[]> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

// Wall kicks are y-up (SRS). Callers on this y-down grid negate y.
const KICK_JLSTZ: Record<string, readonly Kick[]> = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const KICK_I: Record<string, readonly Kick[]> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

export interface PiecePose {
  id: PieceId;
  r: number;
  x: number;
  y: number;
}

export interface BoardView {
  grid: Uint8Array;
  piece: PiecePose | null;
  hold: PieceId | null;
  holdLocked: boolean;
  next: PieceId[];
  incoming: number;
  clearing: number[];
  score: number;
  lines: number;
  ko: boolean;
}

export interface StepResult {
  lines: number;
  outgoing: number;
  cancelled: number;
  kind: ClearKind | null;
  ko: boolean;
  combo: number;
  spin: Spin;
}

export interface Snap {
  g: string;
  p: PiecePose | null;
  h: PieceId | null;
  hu: boolean;
  n: PieceId[];
  i: number;
  c: number[];
  s: number;
  l: number;
  k: boolean;
}

type Phase =
  | { kind: "live" }
  | { kind: "clear"; timer: number }
  | { kind: "garbage"; timer: number }
  | { kind: "ko" };

const QUIET_KO: StepResult = {
  lines: 0,
  outgoing: 0,
  cancelled: 0,
  kind: null,
  ko: true,
  combo: 0,
  spin: "none",
};

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextBag(rng: () => number): PieceId[] {
  const bag: PieceId[] = ["I", "O", "T", "S", "Z", "J", "L"];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  return bag;
}

export function minos(id: PieceId, rot: number, x: number, y: number): Array<[number, number]> {
  const src = ROT[id][((rot % 4) + 4) % 4]!;
  const out: Array<[number, number]> = [];
  for (const [mx, my] of src) out.push([x + mx, y + my]);
  return out;
}

export function blocked(grid: Uint8Array, id: PieceId, rot: number, x: number, y: number): boolean {
  for (const [cx, cy] of minos(id, rot, x, y)) {
    if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
    if (cy >= 0 && grid[cy * COLS + cx] !== 0) return true;
  }
  return false;
}

export function clearLines(grid: Uint8Array): number {
  const kept: number[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    let full = true;
    for (let x = 0; x < COLS; x += 1) {
      if (grid[y * COLS + x] === 0) {
        full = false;
        break;
      }
    }
    if (!full) kept.push(y);
  }
  const cleared = ROWS - kept.length;
  if (!cleared) return 0;
  const next = new Uint8Array(grid.length);
  const offset = cleared;
  for (let i = 0; i < kept.length; i += 1) {
    const y = kept[i]!;
    next.set(grid.subarray(y * COLS, y * COLS + COLS), (i + offset) * COLS);
  }
  grid.set(next);
  return cleared;
}

export function fullRows(grid: Uint8Array): number[] {
  const rows: number[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    let full = true;
    for (let x = 0; x < COLS; x += 1) {
      if (grid[y * COLS + x] === 0) {
        full = false;
        break;
      }
    }
    if (full) rows.push(y);
  }
  return rows;
}

/** Push one garbage row up from the floor. True if the stack is shoved off the ceiling. */
export function pushGarbage(grid: Uint8Array, hole: number): boolean {
  for (let x = 0; x < COLS; x += 1) {
    if (grid[x] !== 0) return true;
  }
  grid.copyWithin(0, COLS);
  const base = (ROWS - 1) * COLS;
  const gap = ((hole % COLS) + COLS) % COLS;
  for (let x = 0; x < COLS; x += 1) grid[base + x] = x === gap ? 0 : GARBAGE;
  return false;
}

export function simulateDrop(
  grid: Uint8Array,
  id: PieceId,
  rot: number,
  x: number,
): { grid: Uint8Array; lines: number } | null {
  if (blocked(grid, id, rot, x, 0)) return null;
  let y = 0;
  while (!blocked(grid, id, rot, x, y + 1)) y += 1;
  const next = grid.slice();
  const value = PIECE_INDEX[id];
  for (const [cx, cy] of minos(id, rot, x, y)) {
    if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) next[cy * COLS + cx] = value;
  }
  const lines = clearLines(next);
  return { grid: next, lines };
}

export function ghostY(grid: Uint8Array, id: PieceId, rot: number, x: number, y: number): number {
  let gy = y;
  while (!blocked(grid, id, rot, x, gy + 1)) gy += 1;
  return gy;
}

export function stackDanger(grid: Uint8Array): number {
  for (let y = HIDDEN_ROWS; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (grid[y * COLS + x] !== 0) {
        const fromTop = y - HIDDEN_ROWS;
        if (fromTop <= 3) return 1;
        if (fromTop <= 6) return 0.55;
        return 0;
      }
    }
  }
  return 0;
}

export function emptyView(): BoardView {
  return {
    grid: new Uint8Array(ROWS * COLS),
    piece: null,
    hold: null,
    holdLocked: false,
    next: [],
    incoming: 0,
    clearing: [],
    score: 0,
    lines: 0,
    ko: false,
  };
}

function fallInterval(matchTime: number): number {
  return Math.max(0.085, 0.8 - matchTime * 0.011);
}

function kicksFor(id: PieceId, from: number, to: number): readonly Kick[] {
  if (id === "O") return [[0, 0]];
  const table = id === "I" ? KICK_I : KICK_JLSTZ;
  return table[`${from}>${to}`] ?? [[0, 0]];
}

function cornerSolid(grid: Uint8Array, x: number, y: number): boolean {
  if (x < 0 || x >= COLS || y >= ROWS) return true;
  if (y < 0) return false;
  return grid[y * COLS + x] !== 0;
}

function spinOf(
  grid: Uint8Array,
  id: PieceId,
  rot: number,
  x: number,
  y: number,
  last: string,
): import("./kinds").Spin {
  if (id !== "T" || last !== "rotate") return "none";
  const corners = [
    cornerSolid(grid, x, y),
    cornerSolid(grid, x + 2, y),
    cornerSolid(grid, x, y + 2),
    cornerSolid(grid, x + 2, y + 2),
  ];
  const count = corners.reduce((sum, on) => sum + (on ? 1 : 0), 0);
  if (count < 3) return "none";
  const fronts = rot === 0 ? [0, 1] : rot === 1 ? [1, 3] : rot === 2 ? [2, 3] : [0, 2];
  return corners[fronts[0]!] && corners[fronts[1]!] ? "full" : "mini";
}

export class Board {
  readonly grid = new Uint8Array(ROWS * COLS);
  bag: PieceId[] = [];
  queue: PieceId[] = [];
  current: PiecePose | null = null;
  hold: PieceId | null = null;
  holdUsed = false;
  incoming = 0;
  combo = 0;
  b2b = false;
  score = 0;
  lines = 0;
  ko = false;
  soft = false;
  clearing: number[] = [];
  spawnSerial = 0;
  phase: Phase = { kind: "live" };
  private lockTimer = 0;
  private lockResets = 0;
  private fallAcc = 0;
  private lastAction: "none" | "rotate" | "shift" = "none";
  private readonly rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.spawn(false);
  }

  isLive(): boolean {
    return this.phase.kind === "live" && this.current !== null && !this.ko;
  }

  debugDeal(): PieceId[] {
    return [...(this.current ? [this.current.id] : []), ...this.queue, ...this.bag];
  }

  toView(): BoardView {
    return {
      grid: this.grid,
      piece: this.current ? { ...this.current } : null,
      hold: this.hold,
      holdLocked: this.holdUsed,
      next: this.queue.slice(0, 5),
      incoming: this.incoming,
      clearing: this.clearing,
      score: this.score,
      lines: this.lines,
      ko: this.ko,
    };
  }

  shift(dx: number): boolean {
    if (!this.isLive() || !this.current || dx === 0) return false;
    const nx = this.current.x + dx;
    if (blocked(this.grid, this.current.id, this.current.r, nx, this.current.y)) return false;
    this.current.x = nx;
    this.lastAction = "shift";
    if (this.grounded()) this.bumpLock();
    return true;
  }

  rotate(dir: 1 | -1): boolean {
    if (!this.isLive() || !this.current) return false;
    const from = this.current.r;
    const to = (from + (dir === 1 ? 1 : 3)) % 4;
    const before = cellKey(this.current.id, from, this.current.x, this.current.y);
    for (const [kx, ky] of kicksFor(this.current.id, from, to)) {
      const nx = this.current.x + kx;
      const ny = this.current.y - ky;
      if (blocked(this.grid, this.current.id, to, nx, ny)) continue;
      this.current.r = to;
      this.current.x = nx;
      this.current.y = ny;
      const after = cellKey(this.current.id, to, nx, ny);
      if (after !== before) {
        this.lastAction = "rotate";
        if (this.grounded()) this.bumpLock();
      }
      return true;
    }
    return false;
  }

  doHold(): void {
    if (!this.isLive() || !this.current || this.holdUsed) return;
    const curId = this.current.id;
    if (this.hold) {
      const swapped = this.hold;
      this.hold = curId;
      this.current = { id: swapped, r: 0, x: SPAWN_X, y: 0 };
      this.holdUsed = true;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.fallAcc = 0;
      this.lastAction = "none";
      if (blocked(this.grid, swapped, 0, SPAWN_X, 0)) {
        this.current = null;
        this.ko = true;
        this.phase = { kind: "ko" };
      }
      return;
    }
    this.hold = curId;
    this.current = null;
    this.spawn(true);
  }

  hardDrop(): StepResult | null {
    if (!this.isLive() || !this.current) return null;
    let dist = 0;
    while (this.fallOne()) dist += 1;
    this.score += dist * 2;
    this.fallAcc = 0;
    return this.lock();
  }

  tick(dt: number, matchTime: number): StepResult | null {
    if (this.ko || this.phase.kind === "ko") return null;
    if (this.phase.kind === "clear") {
      this.phase.timer -= dt;
      if (this.phase.timer <= 0) {
        clearLines(this.grid);
        this.clearing = [];
        if (this.incoming > 0) this.phase = { kind: "garbage", timer: 0 };
        else {
          this.spawn(false);
          if (this.ko) return { ...QUIET_KO };
        }
      }
      return null;
    }
    if (this.phase.kind === "garbage") {
      this.phase.timer -= dt;
      if (this.phase.timer <= 0 && this.incoming > 0) {
        const hole = Math.floor(this.rng() * COLS);
        const died = pushGarbage(this.grid, hole);
        this.incoming -= 1;
        this.phase = { kind: "garbage", timer: 0.075 };
        if (died) {
          this.ko = true;
          this.current = null;
          this.phase = { kind: "ko" };
          return { ...QUIET_KO };
        }
      }
      if (this.phase.kind === "garbage" && this.incoming <= 0 && this.phase.timer <= 0) {
        this.spawn(false);
        if (this.ko) return { ...QUIET_KO };
      }
      return null;
    }
    if (!this.current) return null;
    const interval = this.soft ? Math.max(0.012, fallInterval(matchTime) / 16) : fallInterval(matchTime);
    this.fallAcc += dt;
    let steps = 0;
    while (this.fallAcc >= interval && steps < 24) {
      this.fallAcc -= interval;
      steps += 1;
      if (!this.fallOne()) break;
      if (this.soft) this.score += 1;
    }
    if (this.grounded()) {
      this.lockTimer += dt;
      if (this.lockTimer >= 0.5) return this.lock();
    } else {
      this.lockTimer = 0;
    }
    return null;
  }

  private bumpLock() {
    if (this.lockResets < 15) {
      this.lockTimer = 0;
      this.lockResets += 1;
    }
  }

  private grounded(): boolean {
    if (!this.current) return false;
    return blocked(this.grid, this.current.id, this.current.r, this.current.x, this.current.y + 1);
  }

  private fallOne(): boolean {
    if (!this.current) return false;
    if (blocked(this.grid, this.current.id, this.current.r, this.current.x, this.current.y + 1)) return false;
    this.current.y += 1;
    return true;
  }

  private fillQueue() {
    while (this.queue.length < 5) {
      if (this.bag.length === 0) this.bag = nextBag(this.rng);
      const id = this.bag.pop();
      if (id) this.queue.push(id);
    }
  }

  private spawn(keepHold: boolean) {
    this.fillQueue();
    const id = this.queue.shift();
    if (!id) return;
    this.fillQueue();
    this.current = { id, r: 0, x: SPAWN_X, y: 0 };
    this.holdUsed = keepHold;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.fallAcc = 0;
    this.lastAction = "none";
    this.clearing = [];
    this.spawnSerial += 1;
    this.phase = { kind: "live" };
    if (blocked(this.grid, id, 0, SPAWN_X, 0)) {
      this.current = null;
      this.ko = true;
      this.phase = { kind: "ko" };
    }
  }

  private lock(): StepResult | null {
    const cur = this.current;
    if (!cur) return null;
    const spin = spinOf(this.grid, cur.id, cur.r, cur.x, cur.y, this.lastAction);
    const cells = minos(cur.id, cur.r, cur.x, cur.y);
    let anyVisible = false;
    const value = PIECE_INDEX[cur.id];
    for (const [cx, cy] of cells) {
      if (cy >= HIDDEN_ROWS) anyVisible = true;
      if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) this.grid[cy * COLS + cx] = value;
    }
    this.current = null;
    this.lockTimer = 0;
    this.lockResets = 0;
    if (!anyVisible) {
      this.ko = true;
      this.phase = { kind: "ko" };
      return { ...QUIET_KO };
    }
    const rows = fullRows(this.grid);
    const lines = rows.length;
    if (lines > 0) {
      this.combo += 1;
      const raw = attackOf(lines, spin, this.combo, this.b2b);
      const resolved = resolveAttack(raw, this.incoming);
      this.incoming = resolved.incoming;
      const kind = clearKind(lines, spin, this.combo);
      this.b2b = lines >= 4 || spin !== "none";
      const level = 1 + Math.floor(this.lines / 10);
      const table = [0, 100, 300, 500, 800];
      const mult = spin === "full" ? 3 : spin === "mini" ? 2 : 1;
      this.score += (table[Math.min(4, lines)] ?? 800) * mult * level + Math.max(0, this.combo - 1) * 50;
      this.lines += lines;
      this.clearing = rows;
      this.phase = { kind: "clear", timer: 0.16 + lines * 0.045 };
      return {
        lines,
        outgoing: resolved.outgoing,
        cancelled: resolved.cancelled,
        kind,
        ko: false,
        combo: this.combo,
        spin,
      };
    }
    this.combo = 0;
    this.b2b = false;
    if (this.incoming > 0) {
      this.phase = { kind: "garbage", timer: 0 };
      return null;
    }
    this.spawn(false);
    if (this.ko) return { ...QUIET_KO };
    return null;
  }
}

function cellKey(id: PieceId, rot: number, x: number, y: number): string {
  return minos(id, rot, x, y)
    .map(([cx, cy]) => `${cx},${cy}`)
    .sort()
    .join("|");
}

export function boardToSnap(board: Board): Snap {
  let g = "";
  for (let i = 0; i < board.grid.length; i += 1) g += String(board.grid[i] ?? 0);
  return {
    g,
    p: board.current ? { ...board.current } : null,
    h: board.hold,
    hu: board.holdUsed,
    n: board.queue.slice(0, 5),
    i: board.incoming,
    c: board.clearing.slice(),
    s: board.score,
    l: board.lines,
    k: board.ko,
  };
}

export function snapToView(snap: Snap): BoardView {
  const grid = new Uint8Array(ROWS * COLS);
  const n = Math.min(grid.length, snap.g.length);
  for (let i = 0; i < n; i += 1) grid[i] = (snap.g.charCodeAt(i) || 48) - 48;
  return {
    grid,
    piece: snap.p,
    hold: snap.h,
    holdLocked: !!snap.hu,
    next: Array.isArray(snap.n) ? snap.n : [],
    incoming: snap.i ?? 0,
    clearing: Array.isArray(snap.c) ? snap.c : [],
    score: snap.s ?? 0,
    lines: snap.l ?? 0,
    ko: !!snap.k,
  };
}

export function isSnap(data: unknown): data is Snap {
  if (!data || typeof data !== "object") return false;
  const g = (data as { g?: unknown }).g;
  return typeof g === "string" && g.length === ROWS * COLS;
}
