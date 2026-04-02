/**
 * tileMap.ts — Adapted from pablodelucca/pixel-agents
 * Tile grid definitions, blocked-area builder, and BFS pathfinding.
 */

export const TILE = 20;   // pixels per tile
export const COLS = 62;   // 62 × 20 = 1240 px (canvas width)
export const ROWS = 33;   // 33 × 20 = 660  px (canvas height)

export const FLOOR   = 1;
export const BLOCKED = 0;

/* ─── DESK / ZONE HELPERS ─────────────────────────────────── */

/** Returns the top-left pixel of desk surface i (0-5). */
export function getDeskPx(i: number): { x: number; y: number } {
  return { x: 80 + (i % 3) * 220, y: 110 + Math.floor(i / 3) * 200 };
}

/**
 * Seat tile for each desk (where the agent stands when working).
 * Pixel offset +68,+112 from desk top-left → tile col/row.
 */
export const DESK_SEATS = [0, 1, 2, 3, 4, 5].map((i) => {
  const { x, y } = getDeskPx(i);
  return {
    col: Math.floor((x + 68) / TILE),
    row: Math.floor((y + 112) / TILE),
    dir: 0, // DIR.DOWN — agent faces desk monitor
  };
});

/**
 * Six meeting seats around the oval table.
 * dir: 0=DOWN, 1=LEFT, 2=RIGHT, 3=UP
 */
export const MEETING_SEATS = [
  { col: 46, row: 13, dir: 1 }, // right, facing left
  { col: 44, row: 10, dir: 0 }, // top-right, facing down
  { col: 38, row: 10, dir: 0 }, // top-left, facing down
  { col: 36, row: 13, dir: 2 }, // left, facing right
  { col: 38, row: 16, dir: 3 }, // bottom-left, facing up
  { col: 44, row: 16, dir: 3 }, // bottom-right, facing up
];

/* ─── TILE MAP BUILDER ────────────────────────────────────── */

/**
 * Builds the static 2-D tile map for the Octonfy office.
 * 1 = walkable floor, 0 = blocked obstacle.
 */
export function buildTileMap(): number[][] {
  // Start with everything walkable
  const map: number[][] = Array.from({ length: ROWS }, () =>
    Array(COLS).fill(FLOOR),
  );

  const block = (c: number, r: number) => {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) map[r][c] = BLOCKED;
  };

  const blockRect = (
    cStart: number,
    cEnd: number,
    rStart: number,
    rEnd: number,
  ) => {
    for (let r = rStart; r <= rEnd; r++)
      for (let c = cStart; c <= cEnd; c++) block(c, r);
  };

  // ── Bookshelves along the top wall (row 0-1, col 2-35) ──
  blockRect(2, 35, 0, 1);

  // ── Desk surfaces (6 desks, 8 cols × 5 rows each) ──
  // getDeskPx(i) = { x: 80+(i%3)*220, y: 110+floor(i/3)*200 }
  // Desk size 160×90 px → 8 cols (4-11, 15-22, 26-33) × rows below row 0-1
  for (let i = 0; i < 6; i++) {
    const { x, y } = getDeskPx(i);
    const cStart = Math.floor(x / TILE);
    const cEnd   = Math.floor((x + 159) / TILE);
    const rStart = Math.floor(y / TILE);
    const rEnd   = Math.floor((y + 89) / TILE);
    blockRect(cStart, cEnd, rStart, rEnd);
  }

  // ── Meeting table oval center (col 39-43, row 12-14) ──
  blockRect(39, 43, 12, 14);

  // ── Couch in break area (col 39-49, row 22-25) ──
  blockRect(39, 49, 22, 25);

  // Ensure all DESK_SEATS and MEETING_SEATS are walkable
  // (in case any overlap calculation blocked them)
  for (const s of DESK_SEATS)    map[s.row][s.col] = FLOOR;
  for (const s of MEETING_SEATS) map[s.row][s.col] = FLOOR;

  return map;
}

/* ─── WALKABLE TILE LIST ──────────────────────────────────── */

export function getWalkableTiles(
  map: number[][],
): Array<{ col: number; row: number }> {
  const tiles: Array<{ col: number; row: number }> = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (map[r][c] === FLOOR) tiles.push({ col: c, row: r });
  return tiles;
}

/* ─── BFS PATHFINDING ─────────────────────────────────────── */
// Adapted verbatim from pablodelucca/pixel-agents tileMap.ts

function isWalkable(c: number, r: number, map: number[][]): boolean {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
  return map[r][c] === FLOOR;
}

/**
 * BFS pathfinding on a 4-connected grid (no diagonals).
 * Returns path excluding start tile, including end tile.
 * Returns [] if already at destination or no path found.
 */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  map: number[][],
): Array<{ col: number; row: number }> {
  if (startCol === endCol && startRow === endRow) return [];
  if (!isWalkable(endCol, endRow, map)) return [];

  const key = (c: number, r: number) => `${c},${r}`;
  const startKey = key(startCol, startRow);
  const endKey   = key(endCol, endRow);

  const visited = new Set<string>([startKey]);
  const parent  = new Map<string, string>();
  const queue: Array<{ col: number; row: number }> = [
    { col: startCol, row: startRow },
  ];

  const dirs = [
    { dc: 0, dr: -1 }, // up
    { dc: 0, dr: 1 },  // down
    { dc: -1, dr: 0 }, // left
    { dc: 1, dr: 0 },  // right
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const ck   = key(curr.col, curr.row);

    if (ck === endKey) {
      // Reconstruct path
      const path: Array<{ col: number; row: number }> = [];
      let k = endKey;
      while (k !== startKey) {
        const [c, r] = k.split(",").map(Number);
        path.unshift({ col: c, row: r });
        k = parent.get(k)!;
      }
      return path;
    }

    for (const d of dirs) {
      const nc = curr.col + d.dc;
      const nr = curr.row + d.dr;
      const nk = key(nc, nr);
      if (visited.has(nk) || !isWalkable(nc, nr, map)) continue;
      visited.add(nk);
      parent.set(nk, ck);
      queue.push({ col: nc, row: nr });
    }
  }

  return []; // no path found
}
