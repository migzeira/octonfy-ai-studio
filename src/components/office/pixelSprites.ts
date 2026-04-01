import Konva from "konva";

// Pixel size for the sprite grid
const PX = 3;

// ──────────────────────────────────────────────
// COLOR HELPERS
// ──────────────────────────────────────────────

function darken(hex: string, amount = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * (1 - amount))},${Math.floor(g * (1 - amount))},${Math.floor(b * (1 - amount))})`;
}

function lighten(hex: string, amount = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, Math.floor(r + (255 - r) * amount))},${Math.min(255, Math.floor(g + (255 - g) * amount))},${Math.min(255, Math.floor(b + (255 - b) * amount))})`;
}

// ──────────────────────────────────────────────
// SPRITE DRAWING — draws a grid of colored pixels
// ──────────────────────────────────────────────

type SpriteGrid = (string | null)[][];

function drawSpriteGrid(
  ctx: Konva.Context,
  grid: SpriteGrid,
  offsetX = 0,
  offsetY = 0,
  pixelSize = PX
) {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const color = grid[row][col];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + col * pixelSize, offsetY + row * pixelSize, pixelSize, pixelSize);
    }
  }
}

// ──────────────────────────────────────────────
// CHARACTER SPRITES
// ──────────────────────────────────────────────

const SKIN = "#fcd5b0";
const SKIN_DARK = "#dba97a";
const HAIR = "#3a2a1a";
const SHOE = "#222222";

// Standing character facing down — 12 wide x 18 tall pixels
function makeCharStanding(bodyColor: string): SpriteGrid {
  const B = bodyColor;
  const BD = darken(bodyColor);
  const S = SKIN;
  const H = HAIR;
  const SH = SHOE;
  const _ = null;
  return [
    // Row 0-2: Hair/Head
    [_, _, _, _, H, H, H, H, _, _, _, _],
    [_, _, _, H, H, H, H, H, H, _, _, _],
    [_, _, _, H, S, S, S, S, H, _, _, _],
    // Row 3-4: Face
    [_, _, _, S, S, S, S, S, S, _, _, _],
    [_, _, _, S, "#333", S, S, "#333", S, _, _, _],
    // Row 5: Neck
    [_, _, _, _, S, S, S, S, _, _, _, _],
    // Row 6-10: Body/Shirt
    [_, _, _, B, B, B, B, B, B, _, _, _],
    [_, _, B, B, B, B, B, B, B, B, _, _],
    [_, S, B, B, B, B, B, B, B, B, S, _],
    [_, _, B, B, B, BD, BD, B, B, B, _, _],
    [_, _, _, B, B, B, B, B, B, _, _, _],
    // Row 11-13: Pants
    [_, _, _, BD, BD, BD, BD, BD, BD, _, _, _],
    [_, _, _, BD, BD, _, _, BD, BD, _, _, _],
    [_, _, _, BD, BD, _, _, BD, BD, _, _, _],
    // Row 14-15: Shoes
    [_, _, SH, SH, SH, _, _, SH, SH, SH, _, _],
  ];
}

// Walking frame 1 — left leg forward
function makeCharWalk1(bodyColor: string): SpriteGrid {
  const B = bodyColor;
  const BD = darken(bodyColor);
  const S = SKIN;
  const H = HAIR;
  const SH = SHOE;
  const _ = null;
  return [
    [_, _, _, _, H, H, H, H, _, _, _, _],
    [_, _, _, H, H, H, H, H, H, _, _, _],
    [_, _, _, H, S, S, S, S, H, _, _, _],
    [_, _, _, S, S, S, S, S, S, _, _, _],
    [_, _, _, S, "#333", S, S, "#333", S, _, _, _],
    [_, _, _, _, S, S, S, S, _, _, _, _],
    [_, _, _, B, B, B, B, B, B, _, _, _],
    [_, _, B, B, B, B, B, B, B, B, _, _],
    [_, S, B, B, B, B, B, B, B, B, S, _],
    [_, _, B, B, B, BD, BD, B, B, B, _, _],
    [_, _, _, B, B, B, B, B, B, _, _, _],
    [_, _, _, BD, BD, BD, BD, BD, BD, _, _, _],
    [_, _, BD, BD, _, _, _, _, BD, BD, _, _],
    [_, SH, SH, _, _, _, _, _, _, BD, _, _],
    [_, _, _, _, _, _, _, _, SH, SH, SH, _],
  ];
}

// Walking frame 2 — right leg forward
function makeCharWalk2(bodyColor: string): SpriteGrid {
  const B = bodyColor;
  const BD = darken(bodyColor);
  const S = SKIN;
  const H = HAIR;
  const SH = SHOE;
  const _ = null;
  return [
    [_, _, _, _, H, H, H, H, _, _, _, _],
    [_, _, _, H, H, H, H, H, H, _, _, _],
    [_, _, _, H, S, S, S, S, H, _, _, _],
    [_, _, _, S, S, S, S, S, S, _, _, _],
    [_, _, _, S, "#333", S, S, "#333", S, _, _, _],
    [_, _, _, _, S, S, S, S, _, _, _, _],
    [_, _, _, B, B, B, B, B, B, _, _, _],
    [_, _, B, B, B, B, B, B, B, B, _, _],
    [_, S, B, B, B, B, B, B, B, B, S, _],
    [_, _, B, B, B, BD, BD, B, B, B, _, _],
    [_, _, _, B, B, B, B, B, B, _, _, _],
    [_, _, _, BD, BD, BD, BD, BD, BD, _, _, _],
    [_, _, BD, BD, _, _, _, _, BD, BD, _, _],
    [_, _, BD, _, _, _, _, _, _, SH, SH, _],
    [_, SH, SH, SH, _, _, _, _, _, _, _, _],
  ];
}

// Sitting (at desk / typing) — shorter since legs are hidden
function makeCharSitting(bodyColor: string, frame: number): SpriteGrid {
  const B = bodyColor;
  const BD = darken(bodyColor);
  const S = SKIN;
  const H = HAIR;
  const _ = null;
  // frame 0: arms down, frame 1: arms up (typing)
  const armL = frame === 0 ? S : _;
  const armR = frame === 0 ? S : _;
  const armLUp = frame === 1 ? S : _;
  const armRUp = frame === 1 ? S : _;
  return [
    [_, _, _, _, H, H, H, H, _, _, _, _],
    [_, _, _, H, H, H, H, H, H, _, _, _],
    [_, _, _, H, S, S, S, S, H, _, _, _],
    [_, _, _, S, S, S, S, S, S, _, _, _],
    [_, _, _, S, "#333", S, S, "#333", S, _, _, _],
    [_, _, _, _, S, S, S, S, _, _, _, _],
    [_, _, _, B, B, B, B, B, B, _, _, _],
    [_, armLUp, B, B, B, B, B, B, B, B, armRUp, _],
    [_, armL, B, B, B, B, B, B, B, B, armR, _],
    [_, S, B, B, B, BD, BD, B, B, B, S, _],
    [_, _, _, B, B, B, B, B, B, _, _, _],
    [_, _, _, BD, BD, BD, BD, BD, BD, _, _, _],
  ];
}

// ──────────────────────────────────────────────
// FURNITURE
// ──────────────────────────────────────────────

const DESK_COLOR = "#5c3d2e";
const DESK_TOP = "#7a5240";
const MONITOR = "#1a1a2e";
const MONITOR_SCREEN = "#0e2240";
const MONITOR_LIGHT = "#3b82f6";

function drawDesk(ctx: Konva.Context, x: number, y: number) {
  const p = PX;
  // Desk surface
  ctx.fillStyle = DESK_TOP;
  ctx.fillRect(x, y, 30 * p, 3 * p);
  ctx.fillStyle = DESK_COLOR;
  ctx.fillRect(x, y + 3 * p, 30 * p, 2 * p);
  // Legs
  ctx.fillRect(x + 2 * p, y + 5 * p, 2 * p, 8 * p);
  ctx.fillRect(x + 26 * p, y + 5 * p, 2 * p, 8 * p);
  // Monitor
  ctx.fillStyle = MONITOR;
  ctx.fillRect(x + 10 * p, y - 10 * p, 10 * p, 8 * p);
  ctx.fillStyle = MONITOR_SCREEN;
  ctx.fillRect(x + 11 * p, y - 9 * p, 8 * p, 6 * p);
  // Screen glow line
  ctx.fillStyle = MONITOR_LIGHT;
  ctx.fillRect(x + 12 * p, y - 7 * p, 6 * p, p);
  ctx.fillRect(x + 12 * p, y - 5 * p, 4 * p, p);
  // Monitor stand
  ctx.fillStyle = "#444";
  ctx.fillRect(x + 14 * p, y - 2 * p, 2 * p, 2 * p);
  // Keyboard
  ctx.fillStyle = "#333";
  ctx.fillRect(x + 11 * p, y + 1 * p, 8 * p, 2 * p);
}

function drawMeetingTable(ctx: Konva.Context, cx: number, cy: number) {
  // Oval table
  ctx.fillStyle = "#4a3728";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 80, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5c4033";
  ctx.beginPath();
  ctx.ellipse(cx, cy - 3, 78, 38, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlant(ctx: Konva.Context, x: number, y: number) {
  const p = PX;
  // Pot
  ctx.fillStyle = "#8b4513";
  ctx.fillRect(x + 2 * p, y + 6 * p, 6 * p, 4 * p);
  ctx.fillRect(x + 1 * p, y + 5 * p, 8 * p, 2 * p);
  // Leaves
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(x + 3 * p, y + 2 * p, 4 * p, 4 * p);
  ctx.fillRect(x + 1 * p, y + 3 * p, 2 * p, 2 * p);
  ctx.fillRect(x + 7 * p, y + 3 * p, 2 * p, 2 * p);
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(x + 4 * p, y, 2 * p, 3 * p);
  ctx.fillRect(x + 2 * p, y + 1 * p, 2 * p, 2 * p);
  ctx.fillRect(x + 6 * p, y + 1 * p, 2 * p, 2 * p);
}

function drawSofa(ctx: Konva.Context, x: number, y: number) {
  const p = PX;
  ctx.fillStyle = "#4a3060";
  ctx.fillRect(x, y + 2 * p, 24 * p, 8 * p);
  ctx.fillStyle = "#5c3d7a";
  ctx.fillRect(x + 1 * p, y + 3 * p, 22 * p, 5 * p);
  // Back
  ctx.fillStyle = "#4a3060";
  ctx.fillRect(x, y, 24 * p, 3 * p);
  // Arms
  ctx.fillRect(x, y + 1 * p, 2 * p, 8 * p);
  ctx.fillRect(x + 22 * p, y + 1 * p, 2 * p, 8 * p);
}

function drawCoffeeMachine(ctx: Konva.Context, x: number, y: number) {
  const p = PX;
  ctx.fillStyle = "#555";
  ctx.fillRect(x, y, 6 * p, 10 * p);
  ctx.fillStyle = "#333";
  ctx.fillRect(x + 1 * p, y + 1 * p, 4 * p, 4 * p);
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(x + 2 * p, y + 6 * p, 2 * p, p);
  // Cup
  ctx.fillStyle = "#ddd";
  ctx.fillRect(x + 1 * p, y + 8 * p, 3 * p, 2 * p);
}

// ──────────────────────────────────────────────
// FLOOR TILES
// ──────────────────────────────────────────────

function drawWoodFloor(ctx: Konva.Context, x: number, y: number, w: number, h: number) {
  const tileW = 24;
  const tileH = 12;
  const colors = ["#3d2b1f", "#4a3628", "#352418", "#3d2b1f"];
  for (let ty = y; ty < y + h; ty += tileH) {
    const offset = (Math.floor((ty - y) / tileH) % 2) * (tileW / 2);
    for (let tx = x - tileW; tx < x + w + tileW; tx += tileW) {
      const ci = (Math.floor((tx + offset) / tileW) + Math.floor(ty / tileH)) % colors.length;
      ctx.fillStyle = colors[ci];
      const drawX = Math.max(x, tx + offset);
      const drawW = Math.min(tx + offset + tileW, x + w) - drawX;
      if (drawW <= 0) continue;
      ctx.fillRect(drawX, ty, drawW, tileH);
    }
    // Subtle line between rows
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(x, ty, w, 1);
  }
}

function drawTileFloor(ctx: Konva.Context, x: number, y: number, w: number, h: number, c1: string, c2: string) {
  const tile = 18;
  for (let ty = y; ty < y + h; ty += tile) {
    for (let tx = x; tx < x + w; tx += tile) {
      ctx.fillStyle = ((tx - x) / tile + (ty - y) / tile) % 2 === 0 ? c1 : c2;
      ctx.fillRect(tx, ty, tile, tile);
    }
  }
}

// ──────────────────────────────────────────────
// WALLS
// ──────────────────────────────────────────────

function drawWall(ctx: Konva.Context, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(x, y, w, h);
  // Brick pattern
  const bw = 16;
  const bh = 8;
  for (let by = y; by < y + h; by += bh) {
    const offset = (Math.floor((by - y) / bh) % 2) * (bw / 2);
    for (let bx = x; bx < x + w; bx += bw) {
      ctx.strokeStyle = "rgba(99,102,241,0.08)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx + offset, by, bw, bh);
    }
  }
}

// ──────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────

export const sprites = {
  standing: makeCharStanding,
  walk1: makeCharWalk1,
  walk2: makeCharWalk2,
  sitting: makeCharSitting,
};

export const furniture = {
  drawDesk,
  drawMeetingTable,
  drawPlant,
  drawSofa,
  drawCoffeeMachine,
};

export const environment = {
  drawWoodFloor,
  drawTileFloor,
  drawWall,
};

export { drawSpriteGrid, PX, SKIN, darken, lighten };
export type { SpriteGrid };
