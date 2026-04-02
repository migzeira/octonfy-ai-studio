/**
 * tileMap.ts — Tile grid + BFS pathfinding for Octonfy office canvas.
 * Layout adapted from pablodelucca/pixel-agents default office (21×22 tiles).
 * Scaled to TILE=32px so assets render at 2× (pixel-perfect upscale).
 */

export const TILE = 32;  // display pixels per tile (2× the 16px source)
export const COLS = 38;  // 38 × 32 = 1216 px
export const ROWS = 20;  // 20 × 32 = 640 px

export const FLOOR   = 1;
export const BLOCKED = 0;

/* ─── ZONE PIXEL BOUNDARIES ─────────────────────────────────── */
export const WORK_W  = 22 * TILE; // col 0-21 = work area (704px)
export const MEET_X  = 22 * TILE; // col 22 = meeting/break start
export const BREAK_Y = 13 * TILE; // row 13 = break area start

/* ─── DESK CONFIGURATIONS ────────────────────────────────────── */
// Each desk: 3 cols × 2 rows in tiles (= 96×64px at TILE=32)
// deskCol/Row = top-left corner;  seatCol/Row = where agent stands
export const DESK_CONFIGS = [
  { deskCol:  1, deskRow:  2, seatCol:  2, seatRow: 5  }, // desk 0
  { deskCol:  6, deskRow:  2, seatCol:  7, seatRow: 5  }, // desk 1
  { deskCol: 11, deskRow:  2, seatCol: 12, seatRow: 5  }, // desk 2
  { deskCol: 16, deskRow:  2, seatCol: 17, seatRow: 5  }, // desk 3
  { deskCol:  1, deskRow: 11, seatCol:  2, seatRow: 14 }, // desk 4
  { deskCol:  6, deskRow: 11, seatCol:  7, seatRow: 14 }, // desk 5
];

export const DESK_SEATS = DESK_CONFIGS.map((d) => ({
  col: d.seatCol,
  row: d.seatRow,
  dir: 0, // DIR.DOWN — agent faces monitor
}));

/* ─── MEETING SEATS ──────────────────────────────────────────── */
// 6 positions around the oval table centred at tile (30, 6)
// dir: 0=DOWN, 1=LEFT, 2=RIGHT, 3=UP
export const MEETING_SEATS = [
  { col: 36, row:  6, dir: 1 }, // right side, facing left
  { col: 34, row:  3, dir: 0 }, // top-right, facing down
  { col: 27, row:  3, dir: 0 }, // top-left, facing down
  { col: 23, row:  6, dir: 2 }, // left side, facing right
  { col: 27, row:  9, dir: 3 }, // bottom-left, facing up
  { col: 34, row:  9, dir: 3 }, // bottom-right, facing up
];

/* ─── TILE MAP BUILDER ───────────────────────────────────────── */
export function buildTileMap(): number[][] {
  const map: number[][] = Array.from({ length: ROWS }, () =>
    Array(COLS).fill(FLOOR),
  );

  const block = (c: number, r: number) => {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) map[r][c] = BLOCKED;
  };
  const blockRect = (c0: number, c1: number, r0: number, r1: number) => {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) block(c, r);
  };

  // ── Desk surfaces (3 cols × 2 rows each) ──
  for (const d of DESK_CONFIGS)
    blockRect(d.deskCol, d.deskCol + 2, d.deskRow, d.deskRow + 1);

  // ── Bookshelves on top wall (col 0-20, row 0) ──
  blockRect(0, 20, 0, 0);

  // ── Meeting table oval centre (col 27-33, row 5-7) ──
  blockRect(27, 33, 5, 7);

  // ── Couch in break area (col 23-32, row 14-16) ──
  blockRect(23, 32, 14, 16);

  // Ensure all seat tiles are walkable
  for (const s of DESK_SEATS)    map[s.row][s.col] = FLOOR;
  for (const s of MEETING_SEATS) map[s.row][s.col] = FLOOR;

  return map;
}

/* ─── WALKABLE TILE LIST ─────────────────────────────────────── */
export function getWalkableTiles(
  map: number[][],
): Array<{ col: number; row: number }> {
  const out: Array<{ col: number; row: number }> = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (map[r][c] === FLOOR) out.push({ col: c, row: r });
  return out;
}

/* ─── BFS PATHFINDING ────────────────────────────────────────── */
// Verbatim from pablodelucca/pixel-agents tileMap.ts (4-connected BFS)

function isWalkable(c: number, r: number, map: number[][]): boolean {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
  return map[r][c] === FLOOR;
}

export function findPath(
  sc: number, sr: number,
  ec: number, er: number,
  map: number[][],
): Array<{ col: number; row: number }> {
  if (sc === ec && sr === er) return [];
  if (!isWalkable(ec, er, map)) return [];

  const key = (c: number, r: number) => `${c},${r}`;
  const sKey = key(sc, sr);
  const eKey = key(ec, er);

  const visited = new Set<string>([sKey]);
  const parent  = new Map<string, string>();
  const queue   = [{ col: sc, row: sr }];

  const D = [{dc:0,dr:-1},{dc:0,dr:1},{dc:-1,dr:0},{dc:1,dr:0}];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const ck  = key(cur.col, cur.row);
    if (ck === eKey) {
      const path: Array<{ col: number; row: number }> = [];
      let k = eKey;
      while (k !== sKey) {
        const [c, r] = k.split(",").map(Number);
        path.unshift({ col: c, row: r });
        k = parent.get(k)!;
      }
      return path;
    }
    for (const d of D) {
      const nc = cur.col + d.dc, nr = cur.row + d.dr;
      const nk = key(nc, nr);
      if (visited.has(nk) || !isWalkable(nc, nr, map)) continue;
      visited.add(nk);
      parent.set(nk, ck);
      queue.push({ col: nc, row: nr });
    }
  }
  return [];
}
