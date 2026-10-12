export type Spin = "none" | "mini" | "full";
export type ClearKind = "jab" | "rush" | "crush" | "super";

export function attackOf(lines: number, spin: Spin, combo: number, b2b: boolean): number {
  if (lines <= 0) return 0;
  let base = 0;
  if (spin === "full") base = lines === 1 ? 2 : lines === 2 ? 4 : 6;
  else if (spin === "mini") base = 1;
  else base = [0, 0, 1, 2, 4][lines] ?? 4;
  let extra = 0;
  if (combo >= 2) extra += Math.min(4, combo - 1);
  if (b2b && (lines >= 4 || spin !== "none")) extra += 1;
  return base + extra;
}

export function clearKind(lines: number, spin: Spin, combo: number): ClearKind {
  if (lines >= 4 || (spin === "full" && lines >= 2)) return "super";
  if (lines === 3 || spin !== "none") return "crush";
  if (lines === 2 || combo >= 3) return "rush";
  return "jab";
}

export function resolveAttack(raw: number, incoming: number) {
  const cancelled = Math.min(raw, Math.max(0, incoming));
  return { cancelled, outgoing: raw - cancelled, incoming: incoming - cancelled };
}
