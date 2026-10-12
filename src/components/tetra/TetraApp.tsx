import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Link2, Swords, Volume2, VolumeX } from "lucide-react";
import { BattleCanvas } from "@/components/tetra/BattleCanvas";
import { loadFighterArt } from "@/game/art";
import { FIGHTERS, fighterById, isFighterId, type FighterId } from "@/game/fighters";
import { unlockAudio, setMuted } from "@/game/audio";
import type { Snap } from "@/game/engine";
import { useP2PRoom } from "@/lib/multiplayer/use-p2p-room";
import { emptyPad, type InHit, type Outcome, type OutHit, type Pad } from "@/game/sim";

type Save = { name: string; fighter: FighterId; muted: boolean };

type Screen =
  | { kind: "title" }
  | { kind: "select"; intent: "cpu" | "host" | "join"; code: string }
  | { kind: "cpu"; fighter: FighterId; name: string; rival: FighterId; round: number }
  | { kind: "online"; fighter: FighterId; name: string; code: string };

const SAVE_KEY = "tetrabrawl-v1";

function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (!parsed || !isFighterId(parsed.fighter)) return null;
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.slice(0, 14) : "Player",
      fighter: parsed.fighter,
      muted: !!parsed.muted,
    };
  } catch {
    return null;
  }
}

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function otherFighter(id: FighterId): FighterId {
  const rest = FIGHTERS.filter((fighter) => fighter.id !== id);
  return rest[Math.floor(Math.random() * rest.length)]?.id ?? "volt";
}

export function TetraApp() {
  const [screen, setScreen] = useState<Screen>({ kind: "title" });
  const [name, setName] = useState("Player");
  const [fighter, setFighter] = useState<FighterId>("kage");
  const [muted, setMutedState] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    loadFighterArt();
    const save = loadSave();
    if (!save) return;
    setName(save.name);
    setFighter(save.fighter);
    setMutedState(save.muted);
    setMuted(save.muted);
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ name, fighter, muted } satisfies Save));
    setMuted(muted);
  }, [name, fighter, muted]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const toggleMute = () => setMutedState((value) => !value);

  return (
    <div className="relative min-h-dvh bg-ink text-paper">
      <div className="pointer-events-none absolute inset-0 scan" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-heat" />
      {screen.kind === "title" && (
        <Title
          muted={muted}
          onMute={toggleMute}
          showCode={showCode}
          codeDraft={codeDraft}
          onCode={setCodeDraft}
          onToggleCode={() => setShowCode((value) => !value)}
          onSpar={() => setScreen({ kind: "select", intent: "cpu", code: "" })}
          onHost={() => setScreen({ kind: "select", intent: "host", code: makeCode() })}
          onJoin={() => {
            const code = codeDraft.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
            if (code.length < 4) return;
            setScreen({ kind: "select", intent: "join", code });
          }}
        />
      )}
      {screen.kind === "select" && (
        <Select
          name={name}
          fighter={fighter}
          intent={screen.intent}
          onName={setName}
          onFighter={setFighter}
          onBack={() => setScreen({ kind: "title" })}
          onContinue={() => {
            const handle = name.trim() || "Player";
            if (screen.intent === "cpu") {
              setScreen({ kind: "cpu", fighter, name: handle, rival: otherFighter(fighter), round: 1 });
              return;
            }
            setScreen({ kind: "online", fighter, name: handle, code: screen.code });
          }}
        />
      )}
      {screen.kind === "cpu" && (
        <CpuFight
          key={screen.round}
          fighter={screen.fighter}
          name={screen.name}
          rival={screen.rival}
          muted={muted}
          onMute={toggleMute}
          onLeave={() => setScreen({ kind: "title" })}
          onRematch={() =>
            setScreen({
              kind: "cpu",
              fighter: screen.fighter,
              name: screen.name,
              rival: screen.rival,
              round: screen.round + 1,
            })
          }
        />
      )}
      {screen.kind === "online" && (
        <OnlineMatch
          fighter={screen.fighter}
          name={screen.name}
          code={screen.code}
          muted={muted}
          onMute={toggleMute}
          onLeave={() => setScreen({ kind: "title" })}
        />
      )}
    </div>
  );
}

function MuteButton({ muted, onMute }: { muted: boolean; onMute: () => void }) {
  return (
    <button type="button" className="btn btn-ghost h-11 px-3" onClick={onMute} aria-label={muted ? "Unmute" : "Mute"}>
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  );
}

function Title(props: {
  muted: boolean;
  onMute: () => void;
  showCode: boolean;
  codeDraft: string;
  onCode: (value: string) => void;
  onToggleCode: () => void;
  onSpar: () => void;
  onHost: () => void;
  onJoin: () => void;
}) {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <p className="font-display text-xs tracking-[0.22em] text-mute">ARCADE 1V1</p>
        <MuteButton muted={props.muted} onMute={props.onMute} />
      </header>
      <div className="flex flex-1 flex-col justify-center py-10">
        <p className="text-sm text-heat">Two wells. One knockout.</p>
        <h1 className="wordmark mt-3 text-6xl text-paper sm:text-8xl">
          Tetra
          <span className="block text-heat">Brawl</span>
        </h1>
        <p className="mt-5 max-w-md text-lg text-mute">
          Clear lines and your fighter strikes. Garbage climbs from the floor. Fill the well and you lose.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-heat" onClick={props.onSpar}>
            <Swords className="size-4" />
            Spar a rival
          </button>
          <button type="button" className="btn btn-ghost" onClick={props.onHost}>
            <Link2 className="size-4" />
            Open a ring
          </button>
        </div>
        <div className="mt-4">
          <button type="button" className="text-sm text-mute underline-offset-4 hover:text-paper hover:underline" onClick={props.onToggleCode}>
            I have a code
          </button>
          {props.showCode && (
            <form
              className="mt-3 flex max-w-sm gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                props.onJoin();
              }}
            >
              <input
                className="field font-display tracking-[0.28em] uppercase"
                value={props.codeDraft}
                maxLength={4}
                autoCapitalize="characters"
                aria-label="Ring code"
                placeholder="CODE"
                onChange={(event) => props.onCode(event.target.value.toUpperCase())}
              />
              <button type="submit" className="btn btn-heat" disabled={props.codeDraft.replace(/[^A-Z0-9]/g, "").length < 4}>
                Enter
              </button>
            </form>
          )}
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            ["Stack", "Arrows or A D move. Z and X rotate. C holds. Space drops."],
            ["Strike", "One line jabs. Two sends a row. Four lines is a super."],
            ["Survive", "Clear before garbage locks in. A full counter erases the hit."],
          ].map(([title, copy]) => (
            <article key={title} className="plate p-4">
              <h2 className="font-display text-sm tracking-widest">{title}</h2>
              <p className="mt-2 text-sm text-mute">{copy}</p>
            </article>
          ))}
        </div>
      </div>
      <p className="pb-16 text-xs text-mute">Friend rings are a direct link between two browsers. No accounts, no ladder.</p>
    </main>
  );
}

function Select(props: {
  name: string;
  fighter: FighterId;
  intent: "cpu" | "host" | "join";
  onName: (value: string) => void;
  onFighter: (id: FighterId) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const picked = fighterById(props.fighter);
  const label = props.intent === "cpu" ? "Spar" : props.intent === "host" ? "Open ring" : "Join ring";
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <button type="button" className="btn btn-ghost h-11" onClick={props.onBack}>
          Back
        </button>
        <p className="font-display text-xs tracking-[0.22em] text-mute">CHOOSE</p>
      </header>
      <div className="mt-4 grid gap-4 lg:mt-6 lg:flex-1 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
        <Portrait id={picked.id} name={picked.name} />
        <div className="flex flex-col">
          <h1 className="wordmark text-4xl">{picked.name}</h1>
          <p className="mt-2 text-heat">{picked.epithet}</p>
          <p className="mt-3 text-mute">{picked.line}</p>
          <ul className="mt-4 hidden grid-cols-2 gap-2 text-sm sm:grid">
            <li className="plate px-3 py-2">Jab · {picked.moves.jab}</li>
            <li className="plate px-3 py-2">Rush · {picked.moves.rush}</li>
            <li className="plate px-3 py-2">Crush · {picked.moves.crush}</li>
            <li className="plate px-3 py-2">Super · {picked.moves.super}</li>
          </ul>
          <div className="mt-5 grid gap-2">
            {FIGHTERS.map((fighter) => {
              const selected = fighter.id === props.fighter;
              return (
                <button
                  key={fighter.id}
                  type="button"
                  className={`plate flex min-h-10 items-center justify-between px-3 text-left lg:min-h-12 ${selected ? "border-heat" : ""}`}
                  onClick={() => props.onFighter(fighter.id)}
                >
                  <span className="font-display tracking-widest">{fighter.name}</span>
                  <span className="text-sm text-mute">{fighter.epithet}</span>
                </button>
              );
            })}
          </div>
          <label className="mt-5 text-sm text-mute" htmlFor="handle">
            Name on the marquee
          </label>
          <input
            id="handle"
            className="field mt-2"
            value={props.name}
            maxLength={14}
            onChange={(event) => props.onName(event.target.value)}
          />
          <button type="button" className="btn btn-heat mt-4" onClick={props.onContinue}>
            {label}
          </button>
        </div>
      </div>
    </main>
  );
}

function Portrait({ id, name }: { id: FighterId; name: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className="plate relative h-32 overflow-hidden sm:h-56 lg:h-auto lg:min-h-80">
      {ok ? (
        <img
          src={`/fighters/${id}.png`}
          alt={name}
          className="h-full w-full object-contain object-bottom lg:max-h-[70vh]"
          onError={() => setOk(false)}
        />
      ) : (
        <div className="flex h-full min-h-80 items-end p-6">
          <span className="wordmark text-7xl text-line">{name.slice(0, 1)}</span>
        </div>
      )}
    </div>
  );
}

function CpuFight(props: {
  fighter: FighterId;
  name: string;
  rival: FighterId;
  muted: boolean;
  onMute: () => void;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const padRef = useRef<Pad>(emptyPad());
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const rival = fighterById(props.rival);
  return (
    <Arena
      mode="cpu"
      you={props.fighter}
      youName={props.name}
      rival={props.rival}
      rivalName={rival.name}
      padRef={padRef}
      paused={paused}
      link="Sparring"
      muted={props.muted}
      onMute={props.onMute}
      onLeave={props.onLeave}
      outcome={outcome}
      onOutcome={setOutcome}
      onRematch={() => {
        setOutcome(null);
        props.onRematch();
      }}
      onTogglePause={() => setPaused((value) => !value)}
    />
  );
}

function OnlineMatch(props: {
  fighter: FighterId;
  name: string;
  code: string;
  muted: boolean;
  onMute: () => void;
  onLeave: () => void;
}) {
  const room = `brawl-${props.code}`;
  const p2p = useP2PRoom({ room, name: props.name });
  const [phase, setPhase] = useState<"lobby" | "fight" | "result">("lobby");
  const [ready, setReady] = useState(false);
  const [remote, setRemote] = useState<{ name: string; fighter: FighterId; ready: boolean } | null>(null);
  const [round, setRound] = useState(1);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [copied, setCopied] = useState(false);
  const [slow, setSlow] = useState(false);
  const padRef = useRef<Pad>(emptyPad());
  const snapRef = useRef<Snap | null>(null);
  const inboundRef = useRef<InHit[]>([]);
  const remoteKoRef = useRef(false);
  const startedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const opponent = p2p.peers.find((peer) => peer.connectionState === "connected") ?? p2p.peers[0] ?? null;

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const send = () => {
      p2p.send({
        t: "lobby",
        fighter: props.fighter,
        name: props.name,
        ready: readyRef.current && phaseRef.current === "lobby",
      });
    };
    send();
    const timer = window.setInterval(send, 1000);
    return () => window.clearInterval(timer);
  }, [p2p.send, props.fighter, props.name, ready, phase]);

  useEffect(() => {
    return p2p.onMessage((from, data, channel) => {
      if (!data || typeof data !== "object") return;
      const msg = data as { t?: string; g?: string; id?: number; n?: number; kind?: string; fighter?: unknown; name?: string; ready?: boolean };
      if (channel === "state" && typeof msg.g === "string") {
        snapRef.current = data as Snap;
        return;
      }
      if (msg.t === "lobby" && isFighterId(msg.fighter)) {
        setRemote({ name: (msg.name || "Rival").slice(0, 14), fighter: msg.fighter, ready: !!msg.ready });
        return;
      }
      if (msg.t === "go") {
        startedRef.current = true;
        remoteKoRef.current = false;
        setOutcome(null);
        setPhase("fight");
        return;
      }
      if (msg.t === "hit" && typeof msg.id === "number") {
        inboundRef.current.push({ id: msg.id, n: Number(msg.n) || 0, kind: String(msg.kind || "jab") });
        return;
      }
      if (msg.t === "ko") remoteKoRef.current = true;
      void from;
    });
  }, [p2p.onMessage]);

  useEffect(() => {
    if (phase !== "lobby" || !ready || !remote?.ready || !opponent) return;
    if (p2p.selfId < opponent.id && !startedRef.current) {
      startedRef.current = true;
      p2p.send({ t: "go" });
      remoteKoRef.current = false;
      setOutcome(null);
      setPhase("fight");
    }
  }, [phase, ready, remote, opponent, p2p.selfId, p2p.send]);

  const link =
    opponent?.connectionState === "connected"
      ? opponent.rttMs != null
        ? `${opponent.rttMs} ms`
        : "Linked"
      : "Linking";

  const rivalId = remote?.fighter ?? "volt";
  const rivalName = remote?.name ?? "Rival";

  return (
    <div className="relative flex h-dvh flex-col">
      {phase === "lobby" && (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-6">
          <header className="flex items-center justify-between">
            <button type="button" className="btn btn-ghost h-11" onClick={props.onLeave}>
              Leave
            </button>
            <MuteButton muted={props.muted} onMute={props.onMute} />
          </header>
          <p className="mt-8 text-sm text-heat">Give them this code</p>
          <div className="mt-2 flex items-end gap-3">
            <p className="wordmark text-6xl tracking-[0.18em]">{props.code}</p>
            <button
              type="button"
              className="btn btn-ghost h-11"
              onClick={() => {
                void navigator.clipboard?.writeText(props.code).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1200);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <article className="plate p-4">
              <p className="text-xs tracking-widest text-mute">YOU</p>
              <p className="font-display mt-2 text-2xl">{fighterById(props.fighter).name}</p>
              <p className="text-mute">{props.name}</p>
              <p className="mt-3 text-sm">{ready ? "Ready" : "Not ready"}</p>
            </article>
            <article className="plate p-4">
              <p className="text-xs tracking-widest text-mute">RIVAL</p>
              {remote ? (
                <>
                  <p className="font-display mt-2 text-2xl">{fighterById(remote.fighter).name}</p>
                  <p className="text-mute">{remote.name}</p>
                  <p className="mt-3 text-sm">{remote.ready ? "Ready" : "Still lacing up"}</p>
                </>
              ) : (
                <p className="mt-3 text-mute">{p2p.joined ? "Waiting for a rival…" : "Opening the ring…"}</p>
              )}
            </article>
          </div>
          {opponent?.connectionState === "failed" && (
            <p className="mt-4 text-sm text-mute">
              Can't open a direct link. Same Wi-Fi usually works. Some networks block it — spar a rival instead.
            </p>
          )}
          {!p2p.joined && slow && (
            <p className="mt-4 text-sm text-mute">The ring is taking too long. Sparring still works offline.</p>
          )}
          {p2p.peers.length > 1 && <p className="mt-4 text-sm text-mute">This ring is 1v1. Extra tabs should leave.</p>}
          <button type="button" className="btn btn-heat mt-6 w-full sm:w-auto" onClick={() => setReady((value) => !value)} disabled={!opponent}>
            {ready ? "Cancel ready" : "Ready"}
          </button>
        </main>
      )}
      {phase !== "lobby" && (
        <Arena
          key={round}
          mode="online"
          you={props.fighter}
          youName={props.name}
          rival={rivalId}
          rivalName={rivalName}
          padRef={padRef}
          paused={false}
          link={link}
          muted={props.muted}
          onMute={props.onMute}
          onLeave={props.onLeave}
          outcome={outcome}
          remoteSnapRef={snapRef}
          inboundRef={inboundRef}
          remoteKoRef={remoteKoRef}
          onHit={(hit: OutHit) => p2p.send({ t: "hit", ...hit })}
          onSnap={(snap) => p2p.broadcast(snap)}
          onOutcome={(next) => {
            setOutcome(next);
            setPhase("result");
            if (next.winner === "rival") p2p.send({ t: "ko" });
          }}
          onRematch={() => {
            startedRef.current = false;
            remoteKoRef.current = false;
            snapRef.current = null;
            inboundRef.current = [];
            setOutcome(null);
            setReady(false);
            setRound((value) => value + 1);
            setPhase("lobby");
          }}
        />
      )}
    </div>
  );
}

function Arena(props: {
  mode: "cpu" | "online";
  you: FighterId;
  youName: string;
  rival: FighterId;
  rivalName: string;
  padRef: MutableRefObject<Pad>;
  paused: boolean;
  link: string;
  muted: boolean;
  onMute: () => void;
  onLeave: () => void;
  outcome: Outcome | null;
  onOutcome: (outcome: Outcome) => void;
  onRematch: () => void;
  onTogglePause?: () => void;
  remoteSnapRef?: MutableRefObject<Snap | null>;
  inboundRef?: MutableRefObject<InHit[]>;
  remoteKoRef?: MutableRefObject<boolean>;
  onHit?: (hit: OutHit) => void;
  onSnap?: (snap: Snap) => void;
}) {
  const pad = props.padRef;
  return (
    <div className="flex h-dvh flex-col bg-ink">
      <header className="flex h-12 shrink-0 items-center justify-between px-3">
        <button type="button" className="btn btn-ghost h-10 px-3" onClick={props.onLeave}>
          Leave
        </button>
        <p className="font-display text-xs tracking-[0.18em] text-mute">{props.link}</p>
        <div className="flex gap-2">
          {props.mode === "cpu" && (
            <button type="button" className="btn btn-ghost h-10 px-3" onClick={props.onTogglePause}>
              {props.paused ? "Resume" : "Pause"}
            </button>
          )}
          <MuteButton muted={props.muted} onMute={props.onMute} />
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <BattleCanvas
          mode={props.mode}
          you={props.you}
          youName={props.youName}
          rival={props.rival}
          rivalName={props.rivalName}
          padRef={props.padRef}
          paused={props.paused}
          link=""
          remoteSnapRef={props.remoteSnapRef}
          inboundRef={props.inboundRef}
          remoteKoRef={props.remoteKoRef}
          onHit={props.onHit}
          onSnap={props.onSnap}
          onOutcome={props.onOutcome}
          onTogglePause={props.onTogglePause}
        />
        {props.outcome && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-3 p-4">
            <button type="button" className="pointer-events-auto btn btn-heat" onClick={props.onRematch}>
              Rematch
            </button>
            <button type="button" className="pointer-events-auto btn btn-ghost" onClick={props.onLeave}>
              Exit
            </button>
          </div>
        )}
      </div>
      <div className="touch-controls shrink-0 grid-cols-4 gap-2 p-2">
        <Hold label="Left" onDown={() => (pad.current.left = true)} onUp={() => (pad.current.left = false)} />
        <Hold label="Right" onDown={() => (pad.current.right = true)} onUp={() => (pad.current.right = false)} />
        <Tap label="Z" onPress={() => (pad.current.rotCCW += 1)} />
        <Tap label="X" onPress={() => (pad.current.rotCW += 1)} />
        <Tap label="Hold" onPress={() => (pad.current.hold += 1)} />
        <Hold label="Soft" onDown={() => (pad.current.soft = true)} onUp={() => (pad.current.soft = false)} />
        <button
          type="button"
          className="btn btn-heat col-span-2 h-14"
          onPointerDown={(event) => {
            event.preventDefault();
            pad.current.hard += 1;
          }}
        >
          Drop
        </button>
      </div>
      <p className="hidden px-3 pb-2 text-center text-xs text-mute md:block">Arrows move · Z/X rotate · C hold · Space drop · P pause</p>
    </div>
  );
}

function Hold({ label, onDown, onUp }: { label: string; onDown: () => void; onUp: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-ghost h-14 touch-none"
      onPointerDown={(event) => {
        event.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    >
      {label}
    </button>
  );
}

function Tap({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-ghost h-14 touch-none"
      onPointerDown={(event) => {
        event.preventDefault();
        onPress();
      }}
    >
      {label}
    </button>
  );
}
