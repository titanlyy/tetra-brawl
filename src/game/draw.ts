import type { Sprite } from "./art.ts";
import {
  COLS,
  GARBAGE,
  HIDDEN_ROWS,
  PIECE_INDEX,
  VISIBLE_ROWS,
  ghostY,
  minos,
  stackDanger,
  type BoardView,
  type PieceId,
} from "./engine.ts";
import { fighterById, type FighterId } from "./fighters.ts";

const COLORS = ["", "#3ad7d7", "#f0c14a", "#c77dff", "#5dce6a", "#ff4d5e", "#5b8cff", "#ff8a3d", "#46506b"];

export interface WellBox {
  x: number;
  y: number;
  cell: number;
  previewX: number;
}

export interface Layout {
  wide: boolean;
  you: WellBox;
  rival: WellBox;
  youFoot: { x: number; y: number };
  rivalFoot: { x: number; y: number };
  fighterH: number;
  callout: { x: number; y: number };
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Callout {
  text: string;
  life: number;
  max: number;
  big: boolean;
}

export interface SideScene {
  name: string;
  fighter: FighterId;
  view: BoardView;
  attack: number;
  hit: number;
}

export interface Scene {
  time: number;
  shake: number;
  countdown: number;
  paused: boolean;
  winner: "you" | "rival" | "draw" | null;
  reason: string;
  you: SideScene;
  rival: SideScene;
  callouts: Callout[];
  particles: Particle[];
  reduced: boolean;
  link: string;
}

export function layoutFor(w: number, h: number): Layout {
  const wide = w >= 940 && h >= 540;
  if (wide) {
    const margin = 16;
    const preview = 78;
    const gap = Math.max(210, Math.min(460, Math.floor(w * 0.3)));
    const cell = Math.max(
      15,
      Math.min(28, Math.floor((h - 28) / VISIBLE_ROWS), Math.floor((w - margin * 2 - preview * 2 - gap) / 20)),
    );
    const bw = cell * 10;
    const bh = cell * VISIBLE_ROWS;
    const y = Math.max(24, Math.floor((h - bh) / 2));
    const youX = margin + preview;
    const rivalX = w - margin - preview - bw;
    const inner = rivalX - (youX + bw);
    const footY = y + bh - 4;
    return {
      wide: true,
      you: { x: youX, y, cell, previewX: margin },
      rival: { x: rivalX, y, cell, previewX: rivalX + bw + 10 },
      youFoot: { x: youX + bw + inner * 0.27, y: footY },
      rivalFoot: { x: youX + bw + inner * 0.73, y: footY },
      fighterH: Math.min(bh * 0.82, inner * 0.7),
      callout: { x: youX + bw + inner / 2, y: y + bh * 0.36 },
    };
  }
  const stage = Math.max(108, Math.floor(h * 0.26));
  const top = 58;
  const availH = Math.max(80, h - top - stage);
  const cell = Math.max(8, Math.min(20, Math.floor((w - 16) / 20), Math.floor(availH / VISIBLE_ROWS)));
  const bw = cell * 10;
  const bh = cell * VISIBLE_ROWS;
  const gap = 8;
  const x0 = Math.floor((w - (bw * 2 + gap)) / 2);
  const footY = Math.min(h - 6, top + bh + stage - 2);
  return {
    wide: false,
    you: { x: x0, y: top, cell, previewX: x0 },
    rival: { x: x0 + bw + gap, y: top, cell, previewX: x0 + bw + gap },
    youFoot: { x: w * 0.27, y: footY },
    rivalFoot: { x: w * 0.73, y: footY },
    fighterH: Math.max(78, footY - (top + bh) - 4),
    callout: { x: w / 2, y: top + bh * 0.42 },
  };
}

export function render(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: Scene,
  art: (id: FighterId) => Sprite | undefined,
) {
  const layout = layoutFor(w, h);
  ctx.save();
  if (!scene.reduced && scene.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * scene.shake, (Math.random() - 0.5) * scene.shake);
  }
  ctx.fillStyle = "#07080c";
  ctx.fillRect(-20, -20, w + 40, h + 40);
  ctx.fillStyle = "rgba(243,239,230,0.025)";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);

  drawWell(ctx, layout.you, scene.you, true, layout.wide, scene.time);
  drawWell(ctx, layout.rival, scene.rival, false, layout.wide, scene.time);
  drawFighter(ctx, scene.you, layout.youFoot, layout.fighterH, false, scene.time, art(scene.you.fighter));
  drawFighter(ctx, scene.rival, layout.rivalFoot, layout.fighterH, true, scene.time, art(scene.rival.fighter));

  ctx.strokeStyle = "rgba(255,77,46,0.85)";
  ctx.lineWidth = 2;
  const floorY = layout.youFoot.y + 2;
  ctx.beginPath();
  ctx.moveTo(layout.youFoot.x - 30, floorY);
  ctx.lineTo(layout.rivalFoot.x + 30, floorY);
  ctx.stroke();

  for (const p of scene.particles) {
    const alpha = Math.max(0, p.life / p.max);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const c of scene.callouts) {
    const alpha = Math.max(0, Math.min(1, c.life / 0.2, c.life));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = c.big ? "#ff4d2e" : "#f3efe6";
    ctx.font = `700 ${c.big ? 42 : 26}px "Chakra Petch", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.text, layout.callout.x, layout.callout.y - (c.max - c.life) * 18);
  }
  ctx.globalAlpha = 1;

  if (scene.link) {
    ctx.fillStyle = "#8b93a7";
    ctx.font = `600 12px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(scene.link, w / 2, 8);
  }

  if (scene.countdown > 0) {
    const label = scene.countdown > 2.4 ? "3" : scene.countdown > 1.4 ? "2" : scene.countdown > 0.45 ? "1" : "FIGHT";
    ctx.fillStyle = "rgba(7,8,12,0.35)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = label === "FIGHT" ? "#ff4d2e" : "#f3efe6";
    ctx.font = `700 ${Math.min(120, w * 0.16)}px "Chakra Petch", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, w / 2, h / 2);
  }

  if (scene.paused) {
    ctx.fillStyle = "rgba(7,8,12,0.55)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f3efe6";
    ctx.font = `700 ${Math.min(64, w * 0.1)}px "Chakra Petch", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", w / 2, h / 2);
  }

  if (scene.winner) {
    ctx.fillStyle = "rgba(7,8,12,0.5)";
    ctx.fillRect(0, 0, w, h);
    const title = scene.winner === "draw" ? "DRAW" : scene.winner === "you" ? "YOU WIN" : "YOU LOSE";
    ctx.fillStyle = scene.winner === "you" ? "#ff4d2e" : "#f3efe6";
    ctx.font = `700 ${Math.min(84, w * 0.12)}px "Chakra Petch", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, w / 2, h / 2 - 16);
    ctx.fillStyle = "#f3efe6";
    ctx.font = `600 ${Math.min(18, w * 0.04)}px Outfit, sans-serif`;
    ctx.fillText(scene.reason, w / 2, h / 2 + 36);
  }
  ctx.restore();
}

function drawWell(
  ctx: CanvasRenderingContext2D,
  well: WellBox,
  side: SideScene,
  yours: boolean,
  wide: boolean,
  time: number,
) {
  const { x, y, cell } = well;
  const bw = cell * COLS;
  const bh = cell * VISIBLE_ROWS;
  const danger = stackDanger(side.view.grid);
  ctx.fillStyle = "#10131c";
  ctx.fillRect(x - 6, y - 6, bw + 12, bh + 12);
  ctx.fillStyle = "#0c0e16";
  ctx.fillRect(x, y, bw, bh);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, bw, bh);
  ctx.clip();
  const view = side.view;
  const clearing = new Set(view.clearing);
  for (let row = 0; row < VISIBLE_ROWS; row += 1) {
    const gy = row + HIDDEN_ROWS;
    for (let col = 0; col < COLS; col += 1) {
      const kind = view.grid[gy * COLS + col] ?? 0;
      if (!kind) continue;
      drawCell(ctx, x + col * cell, y + row * cell, cell, kind, clearing.has(gy));
    }
  }
  if (view.piece) {
    const gy = ghostY(view.grid, view.piece.id, view.piece.r, view.piece.x, view.piece.y);
    paintMino(ctx, well, view.piece.id, view.piece.r, view.piece.x, gy, true, false);
    paintMino(ctx, well, view.piece.id, view.piece.r, view.piece.x, view.piece.y, false, false);
  }
  ctx.restore();

  ctx.strokeStyle = danger > 0 ? `rgba(255,77,46,${0.35 + danger * (0.35 + 0.25 * Math.sin(time * 8))})` : "#2c3348";
  ctx.lineWidth = danger > 0 ? 3 : 1;
  ctx.strokeRect(x - 0.5, y - 0.5, bw + 1, bh + 1);

  const meta = `${viewScore(side.view.score)} · ${side.view.lines}`;
  const nameSize = Math.max(12, Math.min(18, cell));
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  ctx.fillStyle = yours ? "#f3efe6" : "#8b93a7";
  ctx.font = yours
    ? `700 ${nameSize}px "Chakra Petch", sans-serif`
    : `600 11px Outfit, sans-serif`;
  ctx.fillText(yours ? side.name : meta, x, y - 8);
  ctx.textAlign = "right";
  ctx.fillStyle = yours ? "#8b93a7" : "#f3efe6";
  ctx.font = yours
    ? `600 11px Outfit, sans-serif`
    : `700 ${nameSize}px "Chakra Petch", sans-serif`;
  ctx.fillText(yours ? meta : side.name, x + bw, y - 8);

  drawIncoming(ctx, well, side.view.incoming, yours);
  if (wide) drawPreviews(ctx, well, side.view, true);
  else drawPreviews(ctx, well, side.view, false);
}

function viewScore(score: number): string {
  return score.toLocaleString("en-US");
}

function drawIncoming(ctx: CanvasRenderingContext2D, well: WellBox, count: number, yours: boolean) {
  if (count <= 0) return;
  const shown = Math.min(count, 16);
  const x = yours ? well.x + well.cell * COLS + 6 : well.x - 12;
  ctx.fillStyle = "#ff4d2e";
  for (let i = 0; i < shown; i += 1) {
    const py = well.y + well.cell * VISIBLE_ROWS - 8 - i * 8;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, py, 6, 5);
  }
  ctx.globalAlpha = 1;
  if (count > 16) {
    ctx.fillStyle = "#f3efe6";
    ctx.font = `700 11px "Chakra Petch", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(String(count), x + 3, well.y + 14);
  }
}

function drawPreviews(ctx: CanvasRenderingContext2D, well: WellBox, view: BoardView, stacked: boolean) {
  const size = Math.max(8, Math.floor(well.cell * 0.55));
  if (stacked) {
    ctx.fillStyle = "#8b93a7";
    ctx.font = `700 10px "Chakra Petch", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("HOLD", well.previewX, well.y);
    if (view.hold) drawMini(ctx, view.hold, well.previewX + 28, well.y + 36, size, view.holdLocked);
    ctx.fillText("NEXT", well.previewX, well.y + 78);
    view.next.slice(0, 5).forEach((id, i) => {
      drawMini(ctx, id, well.previewX + 28, well.y + 112 + i * (size * 3 + 6), size, false);
    });
    return;
  }
  if (view.hold) drawMini(ctx, view.hold, well.x + 16, well.y - 28, Math.max(7, size - 2), view.holdLocked);
  const next = view.next[0];
  if (next) drawMini(ctx, next, well.x + well.cell * COLS - 16, well.y - 28, Math.max(7, size - 2), false);
}

function drawMini(
  ctx: CanvasRenderingContext2D,
  id: PieceId,
  ox: number,
  oy: number,
  size: number,
  dim: boolean,
) {
  const cells = minos(id, 0, 0, 0);
  let minX = 9;
  let minY = 9;
  let maxX = 0;
  let maxY = 0;
  for (const [cx, cy] of cells) {
    minX = Math.min(minX, cx);
    minY = Math.min(minY, cy);
    maxX = Math.max(maxX, cx);
    maxY = Math.max(maxY, cy);
  }
  const w = (maxX - minX + 1) * size;
  const h = (maxY - minY + 1) * size;
  ctx.save();
  ctx.globalAlpha = dim ? 0.35 : 1;
  for (const [cx, cy] of cells) {
    drawCell(ctx, ox - w / 2 + (cx - minX) * size, oy - h / 2 + (cy - minY) * size, size, PIECE_INDEX[id], false);
  }
  ctx.restore();
}

function paintMino(
  ctx: CanvasRenderingContext2D,
  well: WellBox,
  id: PieceId,
  rot: number,
  px: number,
  py: number,
  ghost: boolean,
  flash: boolean,
) {
  const kind = PIECE_INDEX[id];
  for (const [cx, cy] of minos(id, rot, px, py)) {
    if (cy < HIDDEN_ROWS || cy >= HIDDEN_ROWS + VISIBLE_ROWS) continue;
    const dx = well.x + cx * well.cell;
    const dy = well.y + (cy - HIDDEN_ROWS) * well.cell;
    if (ghost) {
      ctx.strokeStyle = COLORS[kind] ?? "#fff";
      ctx.globalAlpha = 0.45;
      ctx.strokeRect(dx + 2, dy + 2, well.cell - 5, well.cell - 5);
      ctx.globalAlpha = 1;
    } else drawCell(ctx, dx, dy, well.cell, kind, flash);
  }
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  kind: number,
  flash: boolean,
) {
  const color = flash ? "#f7f4ee" : (COLORS[kind] ?? "#888");
  const pad = Math.max(1, Math.floor(s * 0.08));
  ctx.fillStyle = color;
  ctx.beginPath();
  const r = Math.min(4, s * 0.18);
  if (typeof ctx.roundRect === "function") ctx.roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, r);
  else ctx.rect(x + pad, y + pad, s - pad * 2, s - pad * 2);
  ctx.fill();
  if (!flash && kind !== GARBAGE) {
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.fillRect(x + pad + 1, y + pad + 1, s - pad * 2 - 2, Math.max(2, s * 0.12));
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x + pad + 1, y + s - pad - Math.max(2, s * 0.14), s - pad * 2 - 2, Math.max(2, s * 0.12));
  }
  if (kind === GARBAGE && !flash) {
    ctx.strokeStyle = "rgba(243,239,230,0.28)";
    ctx.beginPath();
    ctx.moveTo(x + 4, y + s - 4);
    ctx.lineTo(x + s - 4, y + 4);
    ctx.stroke();
  }
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  side: SideScene,
  foot: { x: number; y: number },
  height: number,
  flip: boolean,
  time: number,
  sprite: Sprite | undefined,
) {
  const pose = attackPose(side.attack);
  const lunge = lungeOf(side.attack);
  const bob = Math.sin(time * 2.3 + (flip ? 1.2 : 0)) * 3;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(foot.x, foot.y + 4, height * 0.18, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(foot.x, foot.y + bob);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.translate(lunge - side.hit * 26, side.hit * 6);
  const sx = pose === "wind" ? 0.94 : pose === "strike" ? 1.06 : 1;
  const sy = pose === "wind" ? 1.05 : pose === "strike" ? 0.95 : 1;
  ctx.scale(sx, sy);
  if (side.hit > 0.2) ctx.filter = "brightness(2.1)";
  const img = pose === "strike" && sprite?.atk ? sprite.atk : sprite?.idle;
  if (img) {
    const ratio = img.width / img.height;
    const h = height;
    const w = h * ratio;
    ctx.drawImage(img, -w / 2, -h, w, h);
  } else {
    drawSilhouette(ctx, side.fighter, height, pose === "strike");
  }
  ctx.filter = "none";
  ctx.restore();
}

export function attackPose(attack: number): "idle" | "wind" | "strike" {
  if (attack <= 0) return "idle";
  const u = 1 - attack / 0.48;
  if (u < 0.18) return "wind";
  if (u < 0.62) return "strike";
  return "idle";
}

export function lungeOf(attack: number): number {
  if (attack <= 0) return 0;
  const u = 1 - attack / 0.48;
  if (u < 0.18) return -18 * (u / 0.18);
  if (u < 0.4) return -18 + 72 * ((u - 0.18) / 0.22);
  if (u < 0.62) return 54;
  return 54 * (1 - (u - 0.62) / 0.38);
}

function drawSilhouette(ctx: CanvasRenderingContext2D, id: FighterId, h: number, strike: boolean) {
  const fighter = fighterById(id);
  ctx.fillStyle = fighter.color;
  const reach = strike ? h * 0.18 : h * 0.04;
  ctx.fillRect(-h * 0.05, -h * 0.46, h * 0.045, h * 0.46);
  ctx.fillRect(h * 0.02, -h * 0.46, h * 0.045, h * 0.44);
  ctx.fillRect(-h * 0.09, -h * 0.78, h * 0.16, h * 0.34);
  ctx.beginPath();
  ctx.arc(h * 0.01, -h * 0.86, h * 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(h * 0.04, -h * 0.74, h * 0.12 + reach, h * 0.045);
  if (id === "kage") ctx.fillRect(h * 0.14 + reach, -h * 0.9, h * 0.02, h * 0.28);
  if (id === "lumen") ctx.fillRect(h * 0.16 + reach, -h * 0.96, h * 0.018, h * 0.5);
  if (id === "brick") ctx.fillRect(-h * 0.16, -h * 0.78, h * 0.1, h * 0.08);
  if (id === "ember") ctx.fillRect(h * 0.02, -h * 0.98, h * 0.03, h * 0.12);
  if (id === "volt") {
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.96);
    ctx.lineTo(h * 0.06, -h * 0.9);
    ctx.lineTo(-h * 0.02, -h * 0.9);
    ctx.fill();
  }
}
