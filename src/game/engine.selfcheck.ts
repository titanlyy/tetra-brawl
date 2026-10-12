import { Cpu } from "./cpu.ts";
import { Board, COLS, GARBAGE, ROWS, clearLines, mulberry32, pushGarbage } from "./engine.ts";
import { attackOf, resolveAttack } from "./kinds.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function bagCheck() {
  const board = new Board(mulberry32(7));
  const deal = board.debugDeal();
  assert(deal.length === 7, `deal length ${deal.length}`);
  assert(new Set(deal).size === 7, "bag not unique");
}

function lineCheck() {
  const grid = new Uint8Array(ROWS * COLS);
  grid[(ROWS - 2) * COLS] = 4;
  for (let x = 0; x < COLS; x += 1) grid[(ROWS - 1) * COLS + x] = 1;
  const n = clearLines(grid);
  assert(n === 1, "expected 1 line");
  assert(grid[(ROWS - 1) * COLS] === 4, "block should fall to the floor");
  assert(grid[0] === 0, "top stays empty");
}

function garbageCheck() {
  const grid = new Uint8Array(ROWS * COLS);
  grid[(ROWS - 1) * COLS] = 3;
  assert(pushGarbage(grid, 5) === false, "garbage should fit");
  assert(grid[(ROWS - 2) * COLS] === 3, "block should rise");
  assert(grid[(ROWS - 1) * COLS + 5] === 0, "hole missing");
  assert(grid[(ROWS - 1) * COLS + 4] === GARBAGE, "garbage missing");
  const full = new Uint8Array(ROWS * COLS);
  full[0] = 1;
  assert(pushGarbage(full, 1) === true, "ceiling should kill");
}

function attackCheck() {
  assert(attackOf(1, "none", 1, false) === 0, "single sends 0");
  assert(attackOf(2, "none", 1, false) === 1, "double");
  assert(attackOf(3, "none", 1, false) === 2, "triple");
  assert(attackOf(4, "none", 1, false) === 4, "quad");
  assert(attackOf(4, "none", 1, true) === 5, "b2b quad");
  assert(attackOf(2, "full", 1, false) === 4, "tspin double");
  const resolved = resolveAttack(4, 3);
  assert(resolved.outgoing === 1 && resolved.cancelled === 3 && resolved.incoming === 0, "counter math");
}

function playCheck() {
  const board = new Board(mulberry32(3));
  assert(board.rotate(1) || board.current?.id === "O", "rotate");
  let guard = 0;
  while (board.shift(-1) && guard < 20) guard += 1;
  assert(board.shift(-1) === false, "wall should stop the piece");
  const fresh = new Board(mulberry32(4));
  fresh.hardDrop();
  let blocks = 0;
  for (let i = 0; i < fresh.grid.length; i += 1) if (fresh.grid[i]) blocks += 1;
  assert(blocks === 4, `hard drop left ${blocks} blocks`);
  let steps = 0;
  while (!fresh.ko && steps < 100) {
    fresh.hardDrop();
    fresh.tick(0.2, 30);
    steps += 1;
  }
  assert(fresh.ko, "stack should top out");
}

function cpuCheck() {
  const player = new Board(mulberry32(9));
  const rival = new Board(mulberry32(11));
  const cpu = new Cpu();
  for (let i = 0; i < 40; i += 1) {
    cpu.act(0.05, rival);
    rival.tick(0.05, i * 0.05);
    player.tick(0.05, i * 0.05);
  }
  assert(rival.score >= 0 && player.lines >= 0, "cpu ran");
}

bagCheck();
lineCheck();
garbageCheck();
attackCheck();
playCheck();
cpuCheck();
console.log("engine selfcheck ok");
