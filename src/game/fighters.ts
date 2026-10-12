export type FighterId = "kage" | "volt" | "ember" | "lumen" | "brick";

export interface Fighter {
  id: FighterId;
  name: string;
  epithet: string;
  line: string;
  moves: { jab: string; rush: string; crush: string; super: string };
  color: string;
}

export const FIGHTERS: Fighter[] = [
  {
    id: "kage",
    name: "KAGE",
    epithet: "Night Edge",
    line: "A quiet blade. Chains turn into a storm of cuts.",
    moves: { jab: "Flicker", rush: "Twin Fang", crush: "Shadow Arc", super: "Midnight Guillotine" },
    color: "#e23b4a",
  },
  {
    id: "volt",
    name: "VOLT",
    epithet: "Storm Guard",
    line: "Boxing footwork and a grin that hits first.",
    moves: { jab: "Spark Jab", rush: "Breaker", crush: "Overload", super: "Thunder Fist" },
    color: "#3ec6ff",
  },
  {
    id: "ember",
    name: "EMBER",
    epithet: "Ash Fist",
    line: "Close-range fire. She punishes every gap you leave.",
    moves: { jab: "Cinder Tap", rush: "Heat Rush", crush: "Furnace Knee", super: "Solar Break" },
    color: "#ff5a32",
  },
  {
    id: "lumen",
    name: "LUMEN",
    epithet: "Glass Lance",
    line: "Precise, cold, and impossible to crowd.",
    moves: { jab: "Needle", rush: "Glacier Step", crush: "Mirror Thrust", super: "Whiteout" },
    color: "#b9e4ff",
  },
  {
    id: "brick",
    name: "BRICK",
    epithet: "Gold Wall",
    line: "A heavyweight. Your garbage becomes his floor.",
    moves: { jab: "Palm", rush: "Shoulder", crush: "Pile Driver", super: "Bedrock" },
    color: "#e0a04a",
  },
];

export function fighterById(id: FighterId): Fighter {
  return FIGHTERS.find((f) => f.id === id) ?? FIGHTERS[0]!;
}

export function isFighterId(value: unknown): value is FighterId {
  return FIGHTERS.some((f) => f.id === value);
}
