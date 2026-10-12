import { useEffect, useRef, type MutableRefObject } from "react";
import { fighterSprite, loadFighterArt } from "@/game/art";
import { isSnap, snapToView, type Snap } from "@/game/engine";
import { render } from "@/game/draw";
import { Sim, emptyPad, type InHit, type Outcome, type OutHit, type Pad } from "@/game/sim";
import type { FighterId } from "@/game/fighters";

export interface BattleCanvasProps {
  mode: "cpu" | "online";
  you: FighterId;
  youName: string;
  rival: FighterId;
  rivalName: string;
  padRef: MutableRefObject<Pad>;
  paused: boolean;
  link: string;
  remoteSnapRef?: MutableRefObject<Snap | null>;
  inboundRef?: MutableRefObject<InHit[]>;
  remoteKoRef?: MutableRefObject<boolean>;
  onHit?: (hit: OutHit) => void;
  onSnap?: (snap: Snap) => void;
  onOutcome: (outcome: Outcome) => void;
  onTogglePause?: () => void;
}

export function BattleCanvas(props: BattleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    loadFighterArt();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sim = new Sim({
      mode: propsRef.current.mode,
      you: propsRef.current.you,
      youName: propsRef.current.youName,
      rival: propsRef.current.rival,
      rivalName: propsRef.current.rivalName,
    });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastSnap = 0;
    let raf = 0;
    let last = performance.now();

    const onKey = (event: KeyboardEvent) => {
      const pad = propsRef.current.padRef.current;
      const live = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "KeyA", "KeyD", "KeyS", "KeyW", "KeyZ", "KeyX", "KeyC", "KeyQ"];
      if (live.includes(event.code) || event.key === " ") event.preventDefault();
      if (event.repeat) return;
      if (event.code === "KeyP" || event.code === "Escape") {
        propsRef.current.onTogglePause?.();
        return;
      }
      if (event.type === "keydown") {
        if (event.code === "ArrowLeft" || event.code === "KeyA") {
          pad.left = true;
          pad.nudge -= 1;
        }
        if (event.code === "ArrowRight" || event.code === "KeyD") {
          pad.right = true;
          pad.nudge += 1;
        }
        if (event.code === "ArrowDown" || event.code === "KeyS") pad.soft = true;
        if (event.code === "ArrowUp" || event.code === "KeyX" || event.code === "KeyW") pad.rotCW += 1;
        if (event.code === "KeyZ" || event.code === "KeyQ" || event.code === "ControlLeft") pad.rotCCW += 1;
        if (event.code === "Space") pad.hard += 1;
        if (event.code === "KeyC" || event.code === "ShiftLeft") pad.hold += 1;
      } else {
        if (event.code === "ArrowLeft" || event.code === "KeyA") pad.left = false;
        if (event.code === "ArrowRight" || event.code === "KeyD") pad.right = false;
        if (event.code === "ArrowDown" || event.code === "KeyS") pad.soft = false;
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const current = propsRef.current;
      const snap = current.remoteSnapRef?.current;
      const remote = snap && isSnap(snap) ? snapToView(snap) : null;
      const result = sim.update(dt, current.padRef.current, {
        w: canvas.clientWidth,
        h: canvas.clientHeight,
        paused: current.paused,
        reduced,
        remoteKo: current.remoteKoRef?.current ?? false,
        inbound: current.inboundRef?.current ?? [],
        link: current.link,
      });
      if (result.outcome) current.onOutcome(result.outcome);
      for (const hit of result.hits) current.onHit?.(hit);
      if (current.mode === "online" && now - lastSnap > 100) {
        lastSnap = now;
        current.onSnap?.(sim.snap());
      }
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.max(1, Math.round(bounds.width * dpr));
      const bh = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(
        ctx,
        bounds.width,
        bounds.height,
        sim.scene({
          reduced,
          link: current.link,
          paused: current.paused,
          remote,
        }),
        fighterSprite,
      );
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      const pad = propsRef.current.padRef.current;
      Object.assign(pad, emptyPad());
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full touch-none" aria-label="Tetra Brawl match" />;
}
