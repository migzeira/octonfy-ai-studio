/**
 * OfficeCanvas.tsx — Octonfy virtual office with pixel-agents visual style.
 *
 * Character sprites loaded directly from pablodelucca/pixel-agents GitHub CDN.
 * Each char_N.png is 112×96 px: 7 frames × 3 direction-rows of 16×32 px.
 *   Row 0 = DOWN  (frames 0-6)
 *   Row 1 = UP    (frames 0-6)
 *   Row 2 = RIGHT (frames 0-6; LEFT is the mirror)
 * Frame indices: 0-2 = walk, 3-4 = typing, 5-6 = reading/idle
 *
 * Floor / wall / furniture assets also from pixel-agents CDN.
 * Movement engine: BFS pathfinding + TYPE/WALK/IDLE FSM (from previous engine).
 */

import { useRef, useEffect, useCallback } from "react";
import type { Agent } from "@/hooks/useRealtimeAgents";
import { startGameLoop } from "./engine/gameLoop";
import {
  TILE, COLS, ROWS,
  buildTileMap, getWalkableTiles, findPath,
  DESK_SEATS, MEETING_SEATS, DESK_CONFIGS,
  WORK_W, MEET_X, BREAK_Y,
} from "./engine/tileMap";

/* ─── CANVAS SIZE ────────────────────────────────────────────── */
const CANVAS_W = COLS * TILE; // 1216
const CANVAS_H = ROWS * TILE; // 640

/* ─── PIXEL-AGENTS ASSET URLs (GitHub raw CDN) ─────────────────
   char_N.png: 112×96 px  — 7 cols × 3 rows, each frame 16×32 px
   floor_N.png: 16×16 px  — single tile pattern (grayscale, tinted)
   furniture PNGs: variable sizes
*/
const CDN = "https://raw.githubusercontent.com/pablodelucca/pixel-agents/main/webview-ui/public/assets";

const CHAR_URLS = [0, 1, 2, 3, 4, 5].map((n) => `${CDN}/characters/char_${n}.png`);

const FLOOR_WARM  = `${CDN}/floors/floor_1.png`; // work area — warm tan
const FLOOR_COOL  = `${CDN}/floors/floor_4.png`; // meeting   — cool blue
const FLOOR_GREEN = `${CDN}/floors/floor_6.png`; // break     — soft green

// Key furniture sprites
const DESK_URL     = `${CDN}/furniture/DESK/desk_front.png`;          // 48×32 px (3×2 tiles)
const CHAIR_URL    = `${CDN}/furniture/CUSHIONED_CHAIR/cushioned_chair_front.png`; // 16×16 px
const BOOKSHELF_URL= `${CDN}/furniture/BOOKSHELF/bookshelf_front.png`;
const PLANT_URL    = `${CDN}/furniture/PLANT/plant_front.png`;
const SOFA_URL     = `${CDN}/furniture/SOFA/sofa_back.png`;
const PC_URL       = `${CDN}/furniture/PC/pc_front_off.png`;          // 16×32 px  (1×2 tiles)
const COFFEE_URL   = `${CDN}/furniture/COFFEE/coffee_front.png`;

/* ─── SPRITE SHEET CONSTANTS ─────────────────────────────────── */
const SRC_CHAR_W = 16;  // source frame width  (px in PNG)
const SRC_CHAR_H = 32;  // source frame height (px in PNG)
const CHAR_SCALE = 2;   // upscale factor → renders at 32×64 px
const CHAR_DW    = SRC_CHAR_W * CHAR_SCALE; // 32
const CHAR_DH    = SRC_CHAR_H * CHAR_SCALE; // 64

// Walk animation cycles 4 frames via indices [0,1,2,1]
const WALK_CYCLE = [0, 1, 2, 1] as const;

/* ─── CHARACTER STATE MACHINE ────────────────────────────────── */
const DIR = { DOWN: 0, UP: 1, RIGHT: 2, LEFT: 3 } as const;
type Dir = (typeof DIR)[keyof typeof DIR];

const ST = { TYPE: "type", WALK: "walk", IDLE: "idle" } as const;
type State = (typeof ST)[keyof typeof ST];

const WALK_SPD       = 80;   // px / sec
const WALK_FRAME_DUR = 0.15; // sec per walk frame
const TYPE_FRAME_DUR = 0.3;  // sec per typing frame
const WANDER_MIN     = 2.5;
const WANDER_MAX     = 10.0;
const WANDER_LIMIT   = 4;

interface Char {
  id:           string;
  state:        State;
  dir:          Dir;
  x:            number;  // pixel x (tile center)
  y:            number;  // pixel y (tile center)
  tileCol:      number;
  tileRow:      number;
  path:         Array<{ col: number; row: number }>;
  moveProgress: number;
  frame:        number;
  frameTimer:   number;
  wanderTimer:  number;
  wanderCount:  number;
  wanderLimit:  number;
  isActive:     boolean;
  inMeeting:    boolean;
  isOffline:    boolean;
  seatIdx:      number;  // 0-5
  typingChar:   string;
  typingAlpha:  number;
}

function tileCenter(col: number, row: number) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function createChar(id: string, seatIdx: number): Char {
  const seat = DESK_SEATS[seatIdx % DESK_SEATS.length];
  const { x, y } = tileCenter(seat.col, seat.row);
  return {
    id, state: ST.TYPE, dir: DIR.DOWN,
    x, y, tileCol: seat.col, tileRow: seat.row,
    path: [], moveProgress: 0,
    frame: 0, frameTimer: 0,
    wanderTimer: 2 + Math.random() * 5,
    wanderCount: 0,
    wanderLimit: 2 + Math.floor(Math.random() * WANDER_LIMIT),
    isActive: true, inMeeting: false, isOffline: false,
    seatIdx,
    typingChar: "{}",
    typingAlpha: 0,
  };
}

const TYPING_CHARS = ["{}", "</>", "fn()", "01", "=>", "[]", "..."];

function startWalk(ch: Char, tc: number, tr: number, map: number[][]): void {
  if (ch.tileCol === tc && ch.tileRow === tr) { ch.path = []; return; }
  const p = findPath(ch.tileCol, ch.tileRow, tc, tr, map);
  if (p.length > 0) {
    ch.path = p; ch.moveProgress = 0;
    ch.state = ST.WALK; ch.frame = 0; ch.frameTimer = 0;
  }
}

function updateChar(
  ch: Char, dt: number,
  map: number[][], walkable: Array<{ col: number; row: number }>,
): void {
  const desk = DESK_SEATS[ch.seatIdx % DESK_SEATS.length];
  const meet = MEETING_SEATS[ch.seatIdx % MEETING_SEATS.length];
  ch.frameTimer += dt;

  switch (ch.state) {
    case ST.TYPE: {
      if (ch.frameTimer >= TYPE_FRAME_DUR) {
        ch.frameTimer -= TYPE_FRAME_DUR;
        ch.frame = (ch.frame + 1) % 2;
        if (Math.random() > 0.85)
          ch.typingChar = TYPING_CHARS[Math.floor(Math.random() * TYPING_CHARS.length)];
      }
      ch.typingAlpha = Math.min(1, ch.typingAlpha + dt * 2);

      if (ch.inMeeting && (ch.tileCol !== meet.col || ch.tileRow !== meet.row)) {
        startWalk(ch, meet.col, meet.row, map);
      } else if (!ch.isActive && !ch.isOffline) {
        ch.state = ST.IDLE; ch.wanderTimer = 1 + Math.random() * 3;
        ch.typingAlpha = 0; ch.frame = 0; ch.frameTimer = 0;
      } else if ((ch.isActive || ch.isOffline) &&
        (ch.tileCol !== desk.col || ch.tileRow !== desk.row)) {
        startWalk(ch, desk.col, desk.row, map);
      }
      break;
    }

    case ST.IDLE: {
      ch.frame = 0;
      ch.typingAlpha = Math.max(0, ch.typingAlpha - dt * 3);
      if (ch.inMeeting) { startWalk(ch, meet.col, meet.row, map); break; }
      if (ch.isActive || ch.isOffline) { startWalk(ch, desk.col, desk.row, map); break; }
      ch.wanderTimer -= dt;
      if (ch.wanderTimer <= 0) {
        ch.wanderTimer = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
        if (ch.wanderCount >= ch.wanderLimit) {
          startWalk(ch, desk.col, desk.row, map);
          ch.wanderCount = 0;
          ch.wanderLimit = 2 + Math.floor(Math.random() * WANDER_LIMIT);
        } else if (walkable.length > 0) {
          const t = walkable[Math.floor(Math.random() * walkable.length)];
          startWalk(ch, t.col, t.row, map);
          ch.wanderCount++;
        }
      }
      break;
    }

    case ST.WALK: {
      if (ch.frameTimer >= WALK_FRAME_DUR) {
        ch.frameTimer -= WALK_FRAME_DUR;
        ch.frame = (ch.frame + 1) % 4;
      }
      if (ch.path.length === 0) {
        const { x, y } = tileCenter(ch.tileCol, ch.tileRow);
        ch.x = x; ch.y = y;
        const atDesk = ch.tileCol === desk.col && ch.tileRow === desk.row;
        const atMeet = ch.tileCol === meet.col && ch.tileRow === meet.row;
        if      (ch.inMeeting && atMeet)              { ch.state = ST.TYPE; ch.dir = meet.dir as Dir; }
        else if ((ch.isActive || ch.isOffline) && atDesk) { ch.state = ST.TYPE; ch.dir = DIR.DOWN; }
        else    { ch.state = ST.IDLE; ch.wanderTimer = 1 + Math.random() * 3; }
        ch.frame = 0; ch.frameTimer = 0;
        break;
      }
      const next = ch.path[0];
      const dc = next.col - ch.tileCol, dr = next.row - ch.tileRow;
      if      (dc > 0) ch.dir = DIR.RIGHT;
      else if (dc < 0) ch.dir = DIR.LEFT;
      else if (dr > 0) ch.dir = DIR.DOWN;
      else             ch.dir = DIR.UP;

      ch.moveProgress += (WALK_SPD / TILE) * dt;
      const from = tileCenter(ch.tileCol, ch.tileRow);
      const to   = tileCenter(next.col, next.row);
      const t    = Math.min(ch.moveProgress, 1);
      ch.x = from.x + (to.x - from.x) * t;
      ch.y = from.y + (to.y - from.y) * t;
      if (ch.moveProgress >= 1) {
        ch.tileCol = next.col; ch.tileRow = next.row;
        ch.x = to.x; ch.y = to.y;
        ch.moveProgress = 0; ch.path.shift();
      }
      // Re-route if destination changed mid-walk
      if (ch.inMeeting) {
        const last = ch.path[ch.path.length - 1];
        if (!last || last.col !== meet.col || last.row !== meet.row)
          startWalk(ch, meet.col, meet.row, map);
      } else if (ch.isActive || ch.isOffline) {
        const last = ch.path[ch.path.length - 1];
        if (!last || last.col !== desk.col || last.row !== desk.row)
          startWalk(ch, desk.col, desk.row, map);
      }
      break;
    }
  }
}

/* ─── ASSET LOADER ───────────────────────────────────────────── */
interface Assets {
  chars:     (HTMLImageElement | null)[];
  floorWarm: HTMLImageElement | null;
  floorCool: HTMLImageElement | null;
  floorGreen:HTMLImageElement | null;
  desk:      HTMLImageElement | null;
  pc:        HTMLImageElement | null;
  chair:     HTMLImageElement | null;
  bookshelf: HTMLImageElement | null;
  plant:     HTMLImageElement | null;
  sofa:      HTMLImageElement | null;
  coffee:    HTMLImageElement | null;
  loaded:    boolean;
}

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadAssets(): Promise<Assets> {
  const [chars, floorWarm, floorCool, floorGreen,
         desk, pc, chair, bookshelf, plant, sofa, coffee] = await Promise.all([
    Promise.all(CHAR_URLS.map(loadImg)),
    loadImg(FLOOR_WARM),
    loadImg(FLOOR_COOL),
    loadImg(FLOOR_GREEN),
    loadImg(DESK_URL),
    loadImg(PC_URL),
    loadImg(CHAIR_URL),
    loadImg(BOOKSHELF_URL),
    loadImg(PLANT_URL),
    loadImg(SOFA_URL),
    loadImg(COFFEE_URL),
  ]);
  return { chars, floorWarm, floorCool, floorGreen,
           desk, pc, chair, bookshelf, plant, sofa, coffee, loaded: true };
}

/* ─── FLOOR RENDERER ─────────────────────────────────────────── */
function drawFloorZone(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  fallback: string,
  x: number, y: number, w: number, h: number,
) {
  if (img) {
    const pat = ctx.createPattern(img, "repeat");
    if (pat) {
      // Scale up the 16px tile to TILE=32px
      const m = new DOMMatrix().scale(CHAR_SCALE, CHAR_SCALE);
      pat.setTransform(m);
      ctx.fillStyle = pat;
      ctx.fillRect(x, y, w, h);
      return;
    }
  }
  // Fallback: solid checkerboard
  const ts = TILE;
  for (let tx = 0; tx < w; tx += ts) {
    for (let ty = 0; ty < h; ty += ts) {
      const alt = ((Math.floor(tx / ts) + Math.floor(ty / ts)) % 2) === 0;
      ctx.fillStyle = alt ? fallback : shadeColor(fallback, -10);
      ctx.fillRect(x + tx, y + ty, Math.min(ts, w - tx), Math.min(ts, h - ty));
    }
  }
}

function shadeColor(hex: string, pct: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + pct));
  const g = Math.max(0, Math.min(255, ((n >> 8)  & 0xff) + pct));
  const b = Math.max(0, Math.min(255, ((n)        & 0xff) + pct));
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

/* ─── WALL / GRID RENDERER ───────────────────────────────────── */
function drawWalls(ctx: CanvasRenderingContext2D) {
  const WALL = "#3A3A5C"; // pixel-agents wall colour
  ctx.fillStyle = WALL;
  // Top bookshelf wall
  ctx.fillRect(0, 0, WORK_W, TILE);
  // Right room top wall
  ctx.fillRect(MEET_X, 0, CANVAS_W - MEET_X, TILE);
  // Divider between work and meeting
  ctx.fillRect(MEET_X - TILE, 0, TILE, CANVAS_H);
  // Horizontal divider at break area
  ctx.fillRect(MEET_X, BREAK_Y - TILE / 2, CANVAS_W - MEET_X, TILE / 2);
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * TILE, 0);
    ctx.lineTo(c * TILE, CANVAS_H);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * TILE);
    ctx.lineTo(CANVAS_W, r * TILE);
    ctx.stroke();
  }
}

/* ─── FURNITURE RENDERER ─────────────────────────────────────── */
function drawFurnitureImg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  col: number, row: number,
  tilesW: number, tilesH: number,   // display size in tiles
  srcW: number, srcH: number,       // source PNG size
) {
  if (!img) return;
  const dx = col * TILE;
  const dy = row * TILE;
  const dw = tilesW * TILE;
  const dh = tilesH * TILE;
  ctx.drawImage(img, 0, 0, srcW, srcH, dx, dy, dw, dh);
}

function drawOfficeFurniture(ctx: CanvasRenderingContext2D, assets: Assets) {
  // ── Desks + PCs ──
  for (const d of DESK_CONFIGS) {
    // Desk: 48×32 px source → 3×2 tiles display
    drawFurnitureImg(ctx, assets.desk,  d.deskCol, d.deskRow, 3, 2, 48, 32);
    // PC on desk: 16×32 px source → 1×2 tiles
    drawFurnitureImg(ctx, assets.pc,    d.deskCol + 1, d.deskRow - 1, 1, 2, 16, 32);
    // Chair below desk: 16×16 → 1×1 tile
    drawFurnitureImg(ctx, assets.chair, d.deskCol + 1, d.deskRow + 3, 1, 1, 16, 16);
  }

  // ── Bookshelves along top wall (col 0-20, row 0) ──
  if (assets.bookshelf) {
    for (let c = 0; c < 20; c += 2) {
      drawFurnitureImg(ctx, assets.bookshelf, c, 0, 2, 1, 32, 16);
    }
  }

  // ── Meeting room ──
  // Oval table drawn with canvas API (no PNG needed)
  const mx = 30 * TILE, my = 6 * TILE;
  ctx.fillStyle = "#7B4F2E";
  ctx.beginPath();
  ctx.ellipse(mx, my, 4 * TILE, 2.5 * TILE, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5C3820";
  ctx.lineWidth = 3;
  ctx.stroke();
  // Table shine
  ctx.fillStyle = "rgba(255,220,160,0.12)";
  ctx.beginPath();
  ctx.ellipse(mx - TILE, my - TILE / 2, 2.5 * TILE, 1.2 * TILE, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Meeting room label
  ctx.fillStyle = "rgba(80,130,255,0.55)";
  ctx.font = `bold 11px monospace`;
  ctx.textAlign = "left";
  ctx.fillText("SALA DE REUNIÃO", MEET_X + 4, TILE + 14);

  // ── Break area ──
  // Sofa: 32×16 → 2×1 tiles
  drawFurnitureImg(ctx, assets.sofa, 23, 14, 4, 2, 32, 16);
  // Coffee machine
  drawFurnitureImg(ctx, assets.coffee, 35, 14, 1, 1, 16, 16);
  // Plants
  drawFurnitureImg(ctx, assets.plant, 22, 18, 1, 1, 16, 16);
  drawFurnitureImg(ctx, assets.plant, 37, 18, 1, 1, 16, 16);
  // Break area label
  ctx.fillStyle = "rgba(40,180,80,0.55)";
  ctx.font = `bold 11px monospace`;
  ctx.textAlign = "left";
  ctx.fillText("ÁREA DE DESCANSO", MEET_X + 4, BREAK_Y + 14);

  // ── Work area label ──
  ctx.fillStyle = "rgba(200,160,80,0.4)";
  ctx.font = `bold 11px monospace`;
  ctx.textAlign = "left";
  ctx.fillText("ÁREA DE TRABALHO", 4, TILE + 14);
}

/* ─── CHARACTER RENDERER ─────────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
  idle: "#94a3b8", working: "#6366f1", thinking: "#3b82f6",
  in_meeting: "#22c55e", messaging: "#f59e0b", offline: "#4b5563",
};

function getCharFrameIdx(ch: Char): number {
  if (ch.state === ST.WALK) return WALK_CYCLE[ch.frame % 4];
  if (ch.state === ST.TYPE) return 3 + (ch.frame % 2);
  return 0; // idle: stand frame
}

function drawCharSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  ch: Char,
) {
  if (!img) return;
  const frameIdx = getCharFrameIdx(ch);
  const isLeft = ch.dir === DIR.LEFT;
  // Map direction to PNG row: DOWN=0, UP=1, RIGHT/LEFT=2
  const srcRow = ch.dir === DIR.DOWN ? 0 : ch.dir === DIR.UP ? 1 : 2;
  const srcX = frameIdx * SRC_CHAR_W;
  const srcY = srcRow * SRC_CHAR_H;

  const dx = Math.round(ch.x - CHAR_DW / 2);
  const dy = Math.round(ch.y - CHAR_DH);

  ctx.save();
  ctx.globalAlpha = ch.isOffline ? 0.4 : 1.0;
  if (isLeft) {
    // Mirror: flip canvas around character center X
    ctx.translate(dx + CHAR_DW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, srcX, srcY, SRC_CHAR_W, SRC_CHAR_H, 0, dy, CHAR_DW, CHAR_DH);
  } else {
    ctx.drawImage(img, srcX, srcY, SRC_CHAR_W, SRC_CHAR_H, dx, dy, CHAR_DW, CHAR_DH);
  }
  ctx.restore();
}

function drawCharacterHUD(
  ctx: CanvasRenderingContext2D,
  ch: Char,
  agent: Agent,
  selected: boolean,
) {
  const status = agent.status ?? "idle";
  const dx = Math.round(ch.x - CHAR_DW / 2);
  const dy = Math.round(ch.y - CHAR_DH);

  // Selection ring
  if (selected) {
    ctx.save();
    ctx.strokeStyle = agent.avatar_color ?? "#6366f1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ch.x, ch.y + 2, CHAR_DW / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Ground shadow
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(ch.x, ch.y + 3, CHAR_DW / 2 + 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Name label
  ctx.save();
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  const lbl = agent.name.split(" ")[0];
  const tw  = ctx.measureText(lbl).width;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(ch.x - tw / 2 - 3, dy - 16, tw + 6, 13);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "bottom";
  ctx.fillText(lbl, ch.x, dy - 3);
  ctx.restore();

  // Status dot
  ctx.fillStyle = STATUS_COLOR[status] ?? "#94a3b8";
  ctx.beginPath();
  ctx.arc(dx + CHAR_DW + 4, dy + 4, 4, 0, Math.PI * 2);
  ctx.fill();

  // Typing effect (working)
  if (ch.isActive && ch.typingAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = ch.typingAlpha * 0.85;
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#88bbff";
    ctx.textAlign = "center";
    ctx.fillText(ch.typingChar, ch.x, dy - 24);
    ctx.restore();
  }

  // Thought bubble (thinking)
  if (status === "thinking") {
    const bx = dx + CHAR_DW + 4, by = dy + 4;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(bx + 12, by - 4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", bx + 12, by - 4);
    [0, 1, 2].forEach((d) => {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.arc(bx + d * 5, by + 9 + d * 4, 2.2 - d * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}

/* ─── MAIN OFFICE RENDERER ───────────────────────────────────── */
function renderFrame(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  chars: Map<string, Char>,
  agentsRef: React.MutableRefObject<Agent[]>,
  selectedId: string | null,
) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // ── Floor zones ──
  drawFloorZone(ctx, assets.floorWarm,  "#8B7355", 0,      TILE, MEET_X,            CANVAS_H - TILE,  );
  drawFloorZone(ctx, assets.floorCool,  "#4A5C7A", MEET_X, TILE, CANVAS_W - MEET_X, BREAK_Y - TILE,   );
  drawFloorZone(ctx, assets.floorGreen, "#4A6A52", MEET_X, BREAK_Y, CANVAS_W - MEET_X, CANVAS_H - BREAK_Y);

  // ── Grid overlay ──
  drawGrid(ctx);

  // ── Walls + separators ──
  drawWalls(ctx);

  // ── Furniture (drawn BELOW characters) ──
  drawOfficeFurniture(ctx, assets);

  // ── Characters — z-sorted by Y ──
  const sorted = [...chars.values()].sort((a, b) => a.y - b.y);
  for (const ch of sorted) {
    const agent = agentsRef.current.find((a) => a.id === ch.id);
    if (!agent) continue;
    const charImg = assets.chars[ch.seatIdx % assets.chars.length] ?? null;
    drawCharSprite(ctx, charImg, ch);
    drawCharacterHUD(ctx, ch, agent, selectedId === ch.id);
  }
}

/* ─── REACT COMPONENT ────────────────────────────────────────── */
interface OfficeCanvasProps {
  agents:              Agent[];
  onAgentClick:        (agent: Agent, pos: { x: number; y: number }) => void;
  selectedAgentId:     string | null;
  meetingParticipants: string[];
  containerWidth:      number;
  containerHeight:     number;
}

export default function OfficeCanvas({
  agents, onAgentClick, selectedAgentId,
  meetingParticipants, containerWidth, containerHeight,
}: OfficeCanvasProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const charsRef    = useRef<Map<string, Char>>(new Map());
  const agentsRef   = useRef<Agent[]>(agents);
  const meetsRef    = useRef<string[]>(meetingParticipants);
  const selectedRef = useRef<string | null>(selectedAgentId);
  const assetsRef   = useRef<Assets>({
    chars: [], floorWarm: null, floorCool: null, floorGreen: null,
    desk: null, pc: null, chair: null, bookshelf: null,
    plant: null, sofa: null, coffee: null, loaded: false,
  });

  const tileMapRef  = useRef(buildTileMap());
  const walkableRef = useRef(getWalkableTiles(tileMapRef.current));

  // Keep refs current
  agentsRef.current  = agents;
  meetsRef.current   = meetingParticipants;
  selectedRef.current = selectedAgentId;

  // Init characters for new agents
  useEffect(() => {
    agents.forEach((agent, i) => {
      if (!charsRef.current.has(agent.id))
        charsRef.current.set(agent.id, createChar(agent.id, i));
    });
    for (const id of charsRef.current.keys())
      if (!agents.find((a) => a.id === id)) charsRef.current.delete(id);
  }, [agents]);

  // Load assets once on mount
  useEffect(() => {
    loadAssets().then((a) => { assetsRef.current = a; });
  }, []);

  // Click hit-test
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width  / rect.width;
      const sy = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * sx;
      const my = (e.clientY - rect.top)  * sy;
      for (const [id, ch] of charsRef.current) {
        const ax = ch.x - CHAR_DW / 2, ay = ch.y - CHAR_DH;
        if (mx >= ax && mx <= ax + CHAR_DW && my >= ay && my <= ay + CHAR_DH) {
          const agent = agentsRef.current.find((a) => a.id === id);
          if (agent) onAgentClick(agent, { x: e.clientX, y: e.clientY });
          return;
        }
      }
    },
    [onAgentClick],
  );

  // Game loop — starts once, reads all data via refs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const map      = tileMapRef.current;
    const walkable = walkableRef.current;

    const stop = startGameLoop(canvas, {
      update(dt) {
        const meets = meetsRef.current;
        for (const [id, ch] of charsRef.current) {
          const agent = agentsRef.current.find((a) => a.id === id);
          if (!agent) continue;
          const status    = agent.status ?? "idle";
          const isWorking = status === "working" || status === "thinking";
          const inMeeting = meets.includes(id) || status === "in_meeting";
          const isOffline = !agent.is_active || status === "offline";
          ch.isActive  = isWorking && !inMeeting;
          ch.inMeeting = inMeeting;
          ch.isOffline = isOffline;
          updateChar(ch, dt, map, walkable);
        }
      },
      render(ctx) {
        renderFrame(ctx, assetsRef.current, charsRef.current, agentsRef, selectedRef.current);
      },
    });
    return stop;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#1a1a2e" }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleClick}
        className="cursor-pointer"
        style={{
          imageRendering: "pixelated",
          width:  containerWidth  > 0 ? containerWidth  : "100%",
          height: containerHeight > 0 ? containerHeight : "100%",
        }}
      />

      {/* Status legend */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 text-[10px] font-mono bg-black/60 rounded-lg px-3 py-2 border border-white/10">
        {[
          ["#6366f1","Trabalhando"], ["#3b82f6","Pensando"],
          ["#22c55e","Em reunião"],  ["#f59e0b","Mensagens"],
          ["#94a3b8","Ocioso"],      ["#4b5563","Offline"],
        ].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
            <span className="text-white/70">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
