/**
 * OfficeCanvas.tsx
 * Pixel-art 2D virtual office canvas for Octonfy.
 *
 * Engine architecture adapted from pablodelucca/pixel-agents:
 *   - requestAnimationFrame game loop with capped delta time
 *   - BFS pathfinding so agents walk around desks/furniture
 *   - Character FSM: TYPE (working) ↔ WALK ↔ IDLE (wander)
 *
 * Sprites are drawn with the HTML Canvas 2D API (no external assets).
 */

import { useRef, useEffect, useCallback } from "react";
import type { Agent } from "@/hooks/useRealtimeAgents";
import { startGameLoop } from "./engine/gameLoop";
import {
  TILE,
  COLS,
  ROWS,
  buildTileMap,
  getWalkableTiles,
  findPath,
  getDeskPx,
  DESK_SEATS,
  MEETING_SEATS,
} from "./engine/tileMap";

/* ─── CANVAS SIZE ─────────────────────────────────────────── */
const CANVAS_W = COLS * TILE; // 1240
const CANVAS_H = ROWS * TILE; // 660

/* ─── SPRITE CONSTANTS ───────────────────────────────────── */
const PX   = 3;   // 1 sprite pixel = 3 canvas pixels
const SPR_W = 10; // sprite width in sprite pixels
const SPR_H = 20;
const CHAR_W = SPR_W * PX; // 30
const CHAR_H = SPR_H * PX; // 60

// Colour keys (used in number[][] sprite data)
const T = 0, SK = 1, HR = 2, SH = 3, PT = 4, BT = 5, EY = 6;

/* ─── SPRITE DATA ────────────────────────────────────────── */
const SPRITE_STAND: number[][] = [
  [T,T,T,HR,HR,T,T,T,T,T],
  [T,T,HR,HR,HR,HR,T,T,T,T],
  [T,HR,HR,SK,SK,HR,HR,T,T,T],
  [T,T,SK,SK,SK,SK,T,T,T,T],
  [T,T,SK,EY,EY,SK,T,T,T,T],
  [T,T,SK,SK,SK,SK,T,T,T,T],
  [T,SH,SH,SH,SH,SH,SH,T,T,T],
  [SH,SH,SH,SH,SH,SH,SH,SH,T,T],
  [SH,SH,SH,SH,SH,SH,SH,SH,T,T],
  [T,SH,SH,SH,SH,SH,SH,T,T,T],
  [T,PT,PT,T,T,PT,PT,T,T,T],
  [T,PT,PT,T,T,PT,PT,T,T,T],
  [T,PT,PT,T,T,PT,PT,T,T,T],
  [T,BT,BT,T,T,BT,BT,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
];

const SPRITE_WALK_A: number[][] = [
  [T,T,T,HR,HR,T,T,T,T,T],
  [T,T,HR,HR,HR,HR,T,T,T,T],
  [T,HR,HR,SK,SK,HR,HR,T,T,T],
  [T,T,SK,SK,SK,SK,T,T,T,T],
  [T,T,SK,EY,EY,SK,T,T,T,T],
  [T,T,SK,SK,SK,SK,T,T,T,T],
  [T,SH,SH,SH,SH,SH,SH,T,T,T],
  [SH,SH,SH,SH,SH,SH,SH,SH,T,T],
  [SH,SH,SH,SH,SH,SH,SH,SH,T,T],
  [T,SH,SH,SH,SH,SH,SH,T,T,T],
  [T,T,PT,PT,PT,PT,T,T,T,T],
  [T,PT,PT,T,T,PT,PT,T,T,T],
  [T,PT,PT,T,T,T,T,T,T,T],
  [T,BT,BT,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
];

const SPRITE_WALK_B: number[][] = [
  [T,T,T,HR,HR,T,T,T,T,T],
  [T,T,HR,HR,HR,HR,T,T,T,T],
  [T,HR,HR,SK,SK,HR,HR,T,T,T],
  [T,T,SK,SK,SK,SK,T,T,T,T],
  [T,T,SK,EY,EY,SK,T,T,T,T],
  [T,T,SK,SK,SK,SK,T,T,T,T],
  [T,SH,SH,SH,SH,SH,SH,T,T,T],
  [SH,SH,SH,SH,SH,SH,SH,SH,T,T],
  [SH,SH,SH,SH,SH,SH,SH,SH,T,T],
  [T,SH,SH,SH,SH,SH,SH,T,T,T],
  [T,T,PT,PT,PT,PT,T,T,T,T],
  [T,PT,PT,T,T,PT,PT,T,T,T],
  [T,T,T,T,T,PT,PT,T,T,T],
  [T,T,T,T,T,BT,BT,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
];

const SPRITE_SIT: number[][] = [
  [T,T,T,HR,HR,T,T,T,T,T],
  [T,T,HR,HR,HR,HR,T,T,T,T],
  [T,HR,HR,SK,SK,HR,HR,T,T,T],
  [T,T,SK,SK,SK,SK,T,T,T,T],
  [T,T,SK,EY,EY,SK,T,T,T,T],
  [T,T,SK,SK,SK,SK,T,T,T,T],
  [T,SH,SH,SH,SH,SH,SH,T,T,T],
  [SH,SH,SH,SH,SH,SH,SH,SH,T,T],
  [T,SH,PT,PT,PT,PT,SH,T,T,T],
  [T,PT,PT,PT,PT,PT,PT,T,T,T],
  [T,BT,BT,T,T,BT,BT,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
];

// Back-facing sprite (UP direction — shows hair from behind)
const SPRITE_BACK: number[][] = [
  [T,T,T,HR,HR,T,T,T,T,T],
  [T,T,HR,HR,HR,HR,T,T,T,T],
  [T,HR,HR,HR,HR,HR,HR,T,T,T],
  [T,T,HR,HR,HR,HR,T,T,T,T],
  [T,T,HR,HR,HR,HR,T,T,T,T],
  [T,T,HR,HR,HR,HR,T,T,T,T],
  [T,SH,SH,SH,SH,SH,SH,T,T,T],
  [SH,SH,SH,SH,SH,SH,SH,SH,T,T],
  [SH,SH,SH,SH,SH,SH,SH,SH,T,T],
  [T,SH,SH,SH,SH,SH,SH,T,T,T],
  [T,PT,PT,T,T,PT,PT,T,T,T],
  [T,PT,PT,T,T,PT,PT,T,T,T],
  [T,PT,PT,T,T,PT,PT,T,T,T],
  [T,BT,BT,T,T,BT,BT,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T],
];

const HAIR_COLORS = [
  "#1a0a00", "#3d2106", "#c8860a",
  "#e0d060", "#8b0000", "#1a1a3e",
];
const SKIN_TONES = [
  "#f5c5a3", "#d4956a", "#8b5e3c",
  "#fddbb4", "#c68642",
];

function makeColors(
  shirtHex: string,
  hairIdx: number,
  skinIdx: number,
): Record<number, string> {
  return {
    [SK]: SKIN_TONES[skinIdx % SKIN_TONES.length],
    [HR]: HAIR_COLORS[hairIdx % HAIR_COLORS.length],
    [SH]: shirtHex,
    [PT]: "#2c3e6b",
    [BT]: "#111",
    [EY]: "#111",
  };
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: number[][],
  x: number,
  y: number,
  colors: Record<number, string>,
  flipX: boolean,
) {
  ctx.save();
  if (flipX) {
    ctx.translate(x + CHAR_W, y);
    ctx.scale(-1, 1);
    ctx.translate(-x, -y);
  }
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const v = sprite[row][col];
      if (v === T) continue;
      ctx.fillStyle = colors[v] ?? "#ff00ff";
      ctx.fillRect(x + col * PX, y + row * PX, PX, PX);
    }
  }
  ctx.restore();
}

/* ─── CHARACTER STATE MACHINE ────────────────────────────── */

const DIR = { DOWN: 0, LEFT: 1, RIGHT: 2, UP: 3 } as const;
type Dir = (typeof DIR)[keyof typeof DIR];

const ST = { TYPE: "type", WALK: "walk", IDLE: "idle" } as const;
type State = (typeof ST)[keyof typeof ST];

const WALK_SPD        = 70;   // px/sec
const WALK_FRAME_DUR  = 0.15; // sec per walk animation frame
const TYPE_FRAME_DUR  = 0.3;  // sec per typing frame
const WANDER_MIN      = 2.5;  // sec before next wander step
const WANDER_MAX      = 10.0;
const WANDER_MOVES_LIMIT = 4; // wander steps before returning to desk

const TYPING_CHARS = ["{}", "</>", "01", "fn()", "...", "[]", "=>"];

interface Char {
  id:            string;
  state:         State;
  dir:           Dir;
  x:             number; // pixel x (tile center)
  y:             number; // pixel y (tile center)
  tileCol:       number;
  tileRow:       number;
  path:          Array<{ col: number; row: number }>;
  moveProgress:  number;
  frame:         number;
  frameTimer:    number;
  wanderTimer:   number;
  wanderCount:   number;
  wanderLimit:   number;
  isActive:      boolean; // working/thinking
  inMeeting:     boolean;
  isOffline:     boolean;
  seatIdx:       number;  // desk seat index (0-5)
  hairIdx:       number;
  skinIdx:       number;
  typingChar:    string;
  typingAlpha:   number;
}

function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function createChar(id: string, seatIdx: number): Char {
  const seat = DESK_SEATS[seatIdx % DESK_SEATS.length];
  const { x, y } = tileCenter(seat.col, seat.row);
  return {
    id,
    state:        ST.TYPE,
    dir:          DIR.DOWN,
    x, y,
    tileCol:      seat.col,
    tileRow:      seat.row,
    path:         [],
    moveProgress: 0,
    frame:        0,
    frameTimer:   0,
    wanderTimer:  WANDER_MIN + Math.random() * WANDER_MAX,
    wanderCount:  0,
    wanderLimit:  2 + Math.floor(Math.random() * WANDER_MOVES_LIMIT),
    isActive:     true,
    inMeeting:    false,
    isOffline:    false,
    seatIdx,
    hairIdx:      seatIdx % HAIR_COLORS.length,
    skinIdx:      seatIdx % SKIN_TONES.length,
    typingChar:   "{}",
    typingAlpha:  0,
  };
}

function startWalk(
  ch: Char,
  targetCol: number,
  targetRow: number,
  map: number[][],
): void {
  if (ch.tileCol === targetCol && ch.tileRow === targetRow) {
    ch.path = [];
    return;
  }
  const path = findPath(ch.tileCol, ch.tileRow, targetCol, targetRow, map);
  if (path.length > 0) {
    ch.path = path;
    ch.moveProgress = 0;
    ch.state = ST.WALK;
    ch.frame = 0;
    ch.frameTimer = 0;
  }
}

function updateChar(
  ch: Char,
  dt: number,
  map: number[][],
  walkable: Array<{ col: number; row: number }>,
): void {
  const deskSeat = DESK_SEATS[ch.seatIdx % DESK_SEATS.length];
  const meetSeat = MEETING_SEATS[ch.seatIdx % MEETING_SEATS.length];

  ch.frameTimer += dt;

  switch (ch.state) {
    /* ── Sitting / typing at a seat ── */
    case ST.TYPE: {
      if (ch.frameTimer >= TYPE_FRAME_DUR) {
        ch.frameTimer -= TYPE_FRAME_DUR;
        ch.frame = (ch.frame + 1) % 2;
        if (Math.random() > 0.85)
          ch.typingChar =
            TYPING_CHARS[Math.floor(Math.random() * TYPING_CHARS.length)];
      }
      // Fade in typing text
      ch.typingAlpha = Math.min(1, ch.typingAlpha + dt * 2);

      if (ch.inMeeting) {
        // Should be at meeting seat
        if (
          ch.tileCol !== meetSeat.col ||
          ch.tileRow !== meetSeat.row
        ) {
          startWalk(ch, meetSeat.col, meetSeat.row, map);
        }
      } else if (!ch.isActive && !ch.isOffline) {
        // Go idle — start wandering after a brief rest
        ch.state = ST.IDLE;
        ch.wanderTimer = 1 + Math.random() * 3;
        ch.typingAlpha = 0;
        ch.frame = 0;
        ch.frameTimer = 0;
      } else if (
        (ch.isActive || ch.isOffline) &&
        (ch.tileCol !== deskSeat.col || ch.tileRow !== deskSeat.row)
      ) {
        startWalk(ch, deskSeat.col, deskSeat.row, map);
      }
      break;
    }

    /* ── Idle wandering ── */
    case ST.IDLE: {
      ch.frame = 0;
      ch.typingAlpha = Math.max(0, ch.typingAlpha - dt * 3);

      if (ch.inMeeting) {
        startWalk(ch, meetSeat.col, meetSeat.row, map);
        break;
      }
      if (ch.isActive || ch.isOffline) {
        startWalk(ch, deskSeat.col, deskSeat.row, map);
        break;
      }

      ch.wanderTimer -= dt;
      if (ch.wanderTimer <= 0) {
        ch.wanderTimer =
          WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);

        if (ch.wanderCount >= ch.wanderLimit) {
          // Return to desk for a rest
          startWalk(ch, deskSeat.col, deskSeat.row, map);
          ch.wanderCount = 0;
          ch.wanderLimit = 2 + Math.floor(Math.random() * WANDER_MOVES_LIMIT);
        } else if (walkable.length > 0) {
          const target =
            walkable[Math.floor(Math.random() * walkable.length)];
          startWalk(ch, target.col, target.row, map);
          ch.wanderCount++;
        }
      }
      break;
    }

    /* ── Walking along a BFS path ── */
    case ST.WALK: {
      if (ch.frameTimer >= WALK_FRAME_DUR) {
        ch.frameTimer -= WALK_FRAME_DUR;
        ch.frame = (ch.frame + 1) % 4;
      }

      if (ch.path.length === 0) {
        // Arrived at destination
        const { x, y } = tileCenter(ch.tileCol, ch.tileRow);
        ch.x = x; ch.y = y;

        const atDesk =
          ch.tileCol === deskSeat.col && ch.tileRow === deskSeat.row;
        const atMeet =
          ch.tileCol === meetSeat.col && ch.tileRow === meetSeat.row;

        if (ch.inMeeting && atMeet) {
          ch.state = ST.TYPE;
          ch.dir   = meetSeat.dir as Dir;
        } else if ((ch.isActive || ch.isOffline) && atDesk) {
          ch.state = ST.TYPE;
          ch.dir   = deskSeat.dir as Dir;
        } else {
          ch.state      = ST.IDLE;
          ch.wanderTimer = 1 + Math.random() * 3;
        }
        ch.frame = 0;
        ch.frameTimer = 0;
        break;
      }

      // Step toward next tile
      const next = ch.path[0];
      const dc   = next.col - ch.tileCol;
      const dr   = next.row - ch.tileRow;
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
        ch.tileCol     = next.col;
        ch.tileRow     = next.row;
        ch.x           = to.x;
        ch.y           = to.y;
        ch.moveProgress = 0;
        ch.path.shift();
      }

      // Re-route if destination changed mid-walk
      if (ch.inMeeting) {
        const last = ch.path[ch.path.length - 1];
        if (!last || last.col !== meetSeat.col || last.row !== meetSeat.row)
          startWalk(ch, meetSeat.col, meetSeat.row, map);
      } else if (ch.isActive || ch.isOffline) {
        const last = ch.path[ch.path.length - 1];
        if (!last || last.col !== deskSeat.col || last.row !== deskSeat.row)
          startWalk(ch, deskSeat.col, deskSeat.row, map);
      }
      break;
    }
  }
}

/* ─── CHOOSE SPRITE BY STATE / DIRECTION ────────────────── */
function getSprite(ch: Char): { sprite: number[][]; flipX: boolean } {
  if (ch.state === ST.TYPE) {
    return {
      sprite: ch.inMeeting ? SPRITE_STAND : SPRITE_SIT,
      flipX:  ch.dir === DIR.RIGHT,
    };
  }
  if (ch.state === ST.IDLE) {
    const s = ch.dir === DIR.UP ? SPRITE_BACK : SPRITE_STAND;
    return { sprite: s, flipX: ch.dir === DIR.RIGHT };
  }
  // WALK
  const walkSprite =
    ch.frame < 2 ? SPRITE_WALK_A : SPRITE_WALK_B;
  if (ch.dir === DIR.UP) {
    return { sprite: SPRITE_BACK, flipX: false };
  }
  return { sprite: walkSprite, flipX: ch.dir === DIR.RIGHT };
}

/* ─── OFFICE BACKGROUND DRAWING ──────────────────────────── */
function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6b3e1e";
  ctx.fillRect(x, y, 160, 90);
  ctx.fillStyle = "#8b5e3e";
  ctx.fillRect(x + 3, y + 3, 154, 9);
  // Monitor
  ctx.fillStyle = "#0a0a18";
  ctx.fillRect(x + 38, y + 10, 84, 56);
  ctx.fillStyle = "#1a2a60";
  ctx.fillRect(x + 42, y + 14, 76, 48);
  // Screen glow
  ctx.fillStyle = "rgba(80,160,255,0.6)";
  ctx.fillRect(x + 46, y + 18, 40, 3);
  ctx.fillStyle = "rgba(80,220,120,0.5)";
  ctx.fillRect(x + 46, y + 26, 55, 3);
  ctx.fillStyle = "rgba(80,160,255,0.4)";
  ctx.fillRect(x + 46, y + 34, 30, 3);
  ctx.fillRect(x + 46, y + 42, 48, 3);
  // Keyboard
  ctx.fillStyle = "#222230";
  ctx.fillRect(x + 32, y + 72, 96, 14);
  // Chair
  ctx.fillStyle = "#2a2a3a";
  ctx.beginPath();
  ctx.arc(x + 80, y + 125, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a3a4a";
  ctx.beginPath();
  ctx.arc(x + 80, y + 125, 15, 0, Math.PI * 2);
  ctx.fill();
}

function drawShelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#4a2e10";
  ctx.fillRect(x, y, 88, 26);
  const bc = ["#c0392b","#2980b9","#27ae60","#8e44ad","#e67e22","#16a085"];
  for (let b = 0; b < 7; b++) {
    ctx.fillStyle = bc[b % bc.length];
    ctx.fillRect(x + 3 + b * 12, y + 3, 10, 20);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + 3 + b * 12 + 8, y + 3, 2, 20);
  }
  ctx.fillStyle = "#3a2010";
  ctx.fillRect(x, y + 22, 88, 4);
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#b05030";
  ctx.fillRect(x + 2, y + 20, 20, 18);
  ctx.fillStyle = "#206030";
  ctx.beginPath(); ctx.arc(x + 12, y + 10, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#309040";
  ctx.beginPath(); ctx.arc(x + 4, y + 6, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 20, y + 5, 9, 0, Math.PI * 2); ctx.fill();
}

const MEETING_CENTER = { x: 820, y: 260 };

function drawOffice(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Floor
  ctx.fillStyle = "#b89a72";
  ctx.fillRect(0, 0, W, H);
  // Checkerboard
  for (let tx = 0; tx < W; tx += 48) {
    for (let ty = 0; ty < H; ty += 48) {
      if ((Math.floor(tx / 48) + Math.floor(ty / 48)) % 2 === 0) {
        ctx.fillStyle = "#a88a62";
        ctx.fillRect(tx, ty, 48, 48);
      }
    }
  }

  // ── Work area ──
  ctx.fillStyle = "rgba(40,25,10,0.12)";
  ctx.fillRect(40, 48, 680, 580);
  ctx.fillStyle = "rgba(180,140,80,0.35)";
  ctx.font = "bold 10px monospace";
  ctx.fillText("ÁREA DE TRABALHO", 48, 65);

  // Bookshelves
  for (let bx = 48; bx < 700; bx += 96) drawShelf(ctx, bx, 20);

  // Desks
  for (let i = 0; i < 6; i++) {
    const { x, y } = getDeskPx(i);
    drawDesk(ctx, x, y);
  }

  // ── Meeting room ──
  ctx.fillStyle = "rgba(30,50,120,0.13)";
  ctx.fillRect(760, 48, 460, 320);
  ctx.save();
  ctx.strokeStyle = "rgba(80,120,255,0.45)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(760, 48, 460, 320);
  ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = "rgba(80,130,255,0.6)";
  ctx.font = "bold 10px monospace";
  ctx.fillText("SALA DE REUNIÃO", 770, 65);

  // Meeting table
  ctx.fillStyle = "#7b4f2e";
  ctx.beginPath();
  ctx.ellipse(
    MEETING_CENTER.x, MEETING_CENTER.y,
    110, 65, 0, 0, Math.PI * 2,
  );
  ctx.fill();
  ctx.strokeStyle = "#5c3820";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,220,160,0.15)";
  ctx.beginPath();
  ctx.ellipse(
    MEETING_CENTER.x - 20, MEETING_CENTER.y - 15,
    65, 32, -0.3, 0, Math.PI * 2,
  );
  ctx.fill();

  // ── Break area ──
  ctx.fillStyle = "rgba(30,100,50,0.12)";
  ctx.fillRect(760, 400, 460, 240);
  ctx.save();
  ctx.strokeStyle = "rgba(40,140,60,0.3)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(760, 400, 460, 240);
  ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = "rgba(40,160,60,0.55)";
  ctx.font = "bold 10px monospace";
  ctx.fillText("ÁREA DE DESCANSO", 770, 418);

  // Couch
  ctx.fillStyle = "#3d7a50";
  ctx.fillRect(780, 450, 200, 70);
  ctx.fillStyle = "#2d6040";
  ctx.fillRect(780, 450, 200, 16);
  ctx.fillRect(780, 450, 14, 70);
  ctx.fillRect(966, 450, 14, 70);

  // Plants
  drawPlant(ctx, 720, 550);
  drawPlant(ctx, 1175, 70);
  drawPlant(ctx, 1175, 380);
  drawPlant(ctx, 40, 560);
}

/* ─── CHARACTER RENDERER ─────────────────────────────────── */

const STATUS_COLOR: Record<string, string> = {
  idle:       "#94a3b8",
  working:    "#6366f1",
  thinking:   "#3b82f6",
  in_meeting: "#22c55e",
  messaging:  "#f59e0b",
  offline:    "#4b5563",
};

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  ch: Char,
  agent: Agent,
  selected: boolean,
) {
  const status = agent.status ?? "idle";
  const { sprite, flipX } = getSprite(ch);
  const colors = makeColors(
    agent.avatar_color ?? "#6366f1",
    ch.hairIdx,
    ch.skinIdx,
  );

  const cx = Math.round(ch.x - CHAR_W / 2);
  const cy = Math.round(ch.y - CHAR_H);

  // Selection ring
  if (selected) {
    ctx.save();
    ctx.strokeStyle = agent.avatar_color ?? "#6366f1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ch.x, ch.y + 2, CHAR_W / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Ground shadow
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(ch.x, ch.y + 3, CHAR_W / 2 + 1, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sprite
  ctx.save();
  if (ch.isOffline) ctx.globalAlpha = 0.4;
  drawSprite(ctx, sprite, cx, cy, colors, flipX);
  ctx.restore();

  // Name label
  ctx.save();
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  const lbl = agent.name.split(" ")[0];
  const tw  = ctx.measureText(lbl).width;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(ch.x - tw / 2 - 3, cy - 15, tw + 6, 12);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "bottom";
  ctx.fillText(lbl, ch.x, cy - 3);
  ctx.restore();

  // Status dot
  ctx.fillStyle = STATUS_COLOR[status] ?? "#94a3b8";
  ctx.beginPath();
  ctx.arc(cx + CHAR_W + 3, cy + 4, 4, 0, Math.PI * 2);
  ctx.fill();

  // Typing effect (working agents)
  if (ch.isActive && ch.typingAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = ch.typingAlpha * 0.85;
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#88bbff";
    ctx.textAlign = "center";
    ctx.fillText(ch.typingChar, ch.x, cy - 22);
    ctx.restore();
  }

  // Thought bubble (thinking)
  if (status === "thinking") {
    const bx = cx + CHAR_W + 4, by = cy + 4;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(bx + 12, by - 4, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", bx + 12, by - 4);
    [0, 1, 2].forEach((d) => {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(bx + d * 5, by + 8 + d * 4, 2 - d * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Meeting indicator
  if (status === "in_meeting") {
    ctx.save();
    ctx.fillStyle = "rgba(34,197,94,0.9)";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("📋", ch.x, cy - 22);
    ctx.restore();
  }
}

/* ─── COMPONENT PROPS ────────────────────────────────────── */
interface OfficeCanvasProps {
  agents:              Agent[];
  onAgentClick:        (agent: Agent, pos: { x: number; y: number }) => void;
  selectedAgentId:     string | null;
  meetingParticipants: string[];
  containerWidth:      number;
  containerHeight:     number;
}

/* ─── COMPONENT ──────────────────────────────────────────── */
export default function OfficeCanvas({
  agents,
  onAgentClick,
  selectedAgentId,
  meetingParticipants,
  containerWidth,
  containerHeight,
}: OfficeCanvasProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const charsRef      = useRef<Map<string, Char>>(new Map());
  const agentsRef     = useRef<Agent[]>(agents);
  const meetsRef      = useRef<string[]>(meetingParticipants);
  const selectedRef   = useRef<string | null>(selectedAgentId);

  // Static engine data (built once)
  const tileMapRef    = useRef<number[][]>(buildTileMap());
  const walkableRef   = useRef(getWalkableTiles(tileMapRef.current));

  // Keep refs current
  agentsRef.current  = agents;
  meetsRef.current   = meetingParticipants;
  selectedRef.current = selectedAgentId;

  // Initialise a Char for each new agent
  useEffect(() => {
    agents.forEach((agent, i) => {
      if (!charsRef.current.has(agent.id)) {
        charsRef.current.set(agent.id, createChar(agent.id, i));
      }
    });
    // Remove chars whose agents were deleted
    for (const id of charsRef.current.keys()) {
      if (!agents.find((a) => a.id === id)) charsRef.current.delete(id);
    }
  }, [agents]);

  // Click hit-test
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx   = canvas.width  / rect.width;
      const sy   = canvas.height / rect.height;
      const mx   = (e.clientX - rect.left) * sx;
      const my   = (e.clientY - rect.top)  * sy;

      for (const [id, ch] of charsRef.current) {
        const ax = ch.x - CHAR_W / 2;
        const ay = ch.y - CHAR_H;
        if (mx >= ax && mx <= ax + CHAR_W && my >= ay && my <= ay + CHAR_H) {
          const agent = agentsRef.current.find((a) => a.id === id);
          if (agent) onAgentClick(agent, { x: e.clientX, y: e.clientY });
          return;
        }
      }
    },
    [onAgentClick],
  );

  // Game loop — starts once, reads refs each frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const map      = tileMapRef.current;
    const walkable = walkableRef.current;

    const stop = startGameLoop(canvas, {
      /* ── UPDATE ── */
      update(dt) {
        const agents = agentsRef.current;
        const meets  = meetsRef.current;
        const chars  = charsRef.current;

        for (const [id, ch] of chars) {
          const agent = agents.find((a) => a.id === id);
          if (!agent) continue;

          const status    = agent.status ?? "idle";
          const isWorking = status === "working" || status === "thinking";
          const inMeeting =
            meets.includes(id) || status === "in_meeting";
          const isOffline =
            !agent.is_active || status === "offline";

          ch.isActive  = isWorking && !inMeeting;
          ch.inMeeting = inMeeting;
          ch.isOffline = isOffline;

          updateChar(ch, dt, map, walkable);
        }
      },

      /* ── RENDER ── */
      render(ctx) {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        drawOffice(ctx, CANVAS_W, CANVAS_H);

        // Z-sort characters by Y so front ones draw on top
        const sorted = [...charsRef.current.values()].sort(
          (a, b) => a.y - b.y,
        );
        for (const ch of sorted) {
          const agent = agentsRef.current.find((a) => a.id === ch.id);
          if (agent) {
            drawCharacter(ctx, ch, agent, selectedRef.current === ch.id);
          }
        }
      },
    });

    return stop;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — game loop runs forever, reads refs

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0a10]">
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
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 text-[10px] font-mono bg-black/50 rounded-lg px-3 py-2">
        {[
          ["#6366f1", "Trabalhando"],
          ["#3b82f6", "Pensando"],
          ["#22c55e", "Em reunião"],
          ["#f59e0b", "Mensagens"],
          ["#94a3b8", "Ocioso"],
          ["#4b5563", "Offline"],
        ].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            <span className="text-white/70">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
