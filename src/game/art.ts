import { FIGHTERS, type FighterId } from "./fighters.ts";

export interface Sprite {
  idle: HTMLImageElement | null;
  atk: HTMLImageElement | null;
}

const book: Partial<Record<FighterId, Sprite>> = {};
let started = false;

export function loadFighterArt() {
  if (started || typeof Image === "undefined") return;
  started = true;
  for (const fighter of FIGHTERS) {
    const slot: Sprite = { idle: null, atk: null };
    book[fighter.id] = slot;
    const idle = new Image();
    idle.onload = () => {
      slot.idle = idle;
    };
    idle.src = `/fighters/${fighter.id}.png`;
    const atk = new Image();
    atk.onload = () => {
      slot.atk = atk;
    };
    atk.src = `/fighters/${fighter.id}-atk.png`;
  }
}

export function fighterSprite(id: FighterId): Sprite | undefined {
  return book[id];
}
