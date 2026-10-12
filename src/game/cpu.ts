import { Board, COLS, ROWS, simulateDrop, stackDanger, type StepResult } from "./engine.ts";

function evaluate(grid: Uint8Array, lines: number): number {
  const heights = new Array<number>(COLS).fill(0);
  let holes = 0;
  let agg = 0;
  for (let x = 0; x < COLS; x += 1) {
    let seen = false;
    for (let y = 0; y < ROWS; y += 1) {
      const filled = grid[y * COLS + x] !== 0;
      if (filled && !seen) {
        heights[x] = ROWS - y;
        seen = true;
      } else if (!filled && seen) holes += 1;
    }
    agg += heights[x] ?? 0;
  }
  let bump = 0;
  for (let x = 0; x < COLS - 1; x += 1) bump += Math.abs((heights[x] ?? 0) - (heights[x + 1] ?? 0));
  const maxH = Math.max(...heights);
  let well = 0;
  for (let x = 0; x < COLS; x += 1) {
    const left = x === 0 ? 99 : (heights[x - 1] ?? 0);
    const right = x === COLS - 1 ? 99 : (heights[x + 1] ?? 0);
    if (Math.min(left, right) - (heights[x] ?? 0) >= 3) well += 1.6;
  }
  let score = lines * 7.5 + (lines === 4 ? 12 : 0) + well;
  score -= holes * 8.5;
  score -= agg * 0.32;
  score -= bump * 0.38;
  if (maxH > 12) score -= (maxH - 12) * 2.4;
  return score;
}

function bestMove(board: Board): { rot: number; x: number } {
  const cur = board.current;
  if (!cur) return { rot: 0, x: 3 };
  let best = { rot: cur.r, x: cur.x, score: -1e9 };
  for (let rot = 0; rot < 4; rot += 1) {
    for (let x = -2; x < COLS; x += 1) {
      const sim = simulateDrop(board.grid, cur.id, rot, x);
      if (!sim) continue;
      const score = evaluate(sim.grid, sim.lines) + (Math.random() - 0.5) * 1.3;
      if (score > best.score) best = { rot, x, score };
    }
  }
  return { rot: best.rot, x: best.x };
}

/** A beatable sparring partner. Slides, then hard-drops. Speeds up when buried. */
export class Cpu {
  private target: { serial: number; rot: number; x: number } | null = null;
  private timer = 0.1;

  act(dt: number, board: Board): StepResult | null {
    if (!board.isLive() || !board.current) {
      this.target = null;
      return null;
    }
    const danger = stackDanger(board.grid) >= 1;
    if (!this.target || this.target.serial !== board.spawnSerial) {
      const move = bestMove(board);
      this.target = { serial: board.spawnSerial, rot: move.rot, x: move.x };
      this.timer = danger ? 0.02 : 0.1;
      return null;
    }
    this.timer -= dt;
    if (this.timer > 0) return null;
    this.timer = danger ? 0.03 : 0.055;
    const cur = board.current;
    if (cur.r !== this.target.rot) {
      if (!board.rotate(1)) return board.hardDrop();
      return null;
    }
    if (cur.x !== this.target.x) {
      const dir = cur.x < this.target.x ? 1 : -1;
      if (!board.shift(dir)) return board.hardDrop();
      return null;
    }
    this.target = null;
    return board.hardDrop();
  }
}
