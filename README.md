# TETRA BRAWL

A 1v1 Tetris brawl inspired by Super Puzzle Fighter. Two wells, five original fighters, and a knockout when a stack hits the ceiling. No accounts.

Clear lines and your fighter strikes. Garbage climbs from the floor. Fill the well and you lose.


## Play

- **Spar a rival** — fight the CPU right away
- **Open a ring** — get a 4-letter code and share it
- **I have a code** — join a friend's ring

Friend rings are a direct link between two browsers (WebRTC). Both players open the same deployed site. Same Wi-Fi usually works if a network blocks the connection. This is casual friend play, not a ranked ladder.

## Fighters

| Fighter | Epithet | Style |
|---|---|---|
| KAGE | Night Edge | Masked swordsman. Chains turn into a storm of cuts. |
| VOLT | Storm Guard | Boxer with a grin that hits first. |
| EMBER | Ash Fist | Close-range fire. Punishes every gap. |
| LUMEN | Glass Lance | Precise, cold, and hard to crowd. |
| BRICK | Gold Wall | Heavyweight. Your garbage becomes his floor. |

## Rules

Guideline-ish Tetris: 10×20 visible, 7-bag randomizer, SRS kicks, hold, ghost, hard and soft drop.

| Clear | Attack |
|---|---|
| Single | Jab only. Sends 0 garbage. |
| Double | 1 row |
| Triple | 2 rows |
| SUPER (4 lines) | 4 rows |
| T-spin double | 4 rows |
| T-spin triple | 6 rows |

Combos and back-to-back add a little more. Incoming garbage cancels outgoing — a full cancel is a COUNTER. Garbage inserts from the floor, one row at a time, with a random hole.

## Controls

| Action | Desktop | Phone |
|---|---|---|
| Move | Arrows or A / D | Left / Right |
| Rotate CCW | Z, Q, or Ctrl | Z |
| Rotate CW | X, W, or Up | X |
| Soft drop | S or Down | Soft |
| Hard drop | Space | Drop |
| Hold | C or Shift | Hold |
| Pause | P or Esc (CPU only) | — |

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on `http://localhost:8080`.

## Deploy

The build targets Vercel.

```bash
npm run build
```

On Vercel, set `DATABASE_URL` so friend-ring signaling has a database. Without it, local preview falls back to an embedded Postgres for the relay only. The match itself is peer-to-peer — each player is authoritative for their own board.

## Stack

TanStack Start, React 19, Canvas 2D boards, generated fighter art, WebRTC friend rooms.

## License

MIT. Copyright (c) 2026 Titan Lee.
