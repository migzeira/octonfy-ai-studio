/**
 * OfficeCanvas.tsx — Octonfy Virtual Office
 *
 * Visual style inspired by pablodelucca/pixel-agents.
 * Character sprites from pixel-agents GitHub CDN (char_0–5.png).
 * All floor tiles, walls and furniture drawn with Canvas 2D API
 * so nothing depends on CORS / external image loads.
 *
 * Engine: BFS pathfinding + TYPE / WALK / IDLE FSM.
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

/* ─── CANVAS ──────────────────────────────────────────────────── */
const CANVAS_W = COLS * TILE; // 1216
const CANVAS_H = ROWS * TILE; // 640

/* ─── CHAR SPRITE SHEET (pixel-agents CDN) ────────────────────── */
const CDN  = "https://raw.githubusercontent.com/pablodelucca/pixel-agents/main/webview-ui/public/assets";
const CHAR_URLS = [0,1,2,3,4,5].map(n => `${CDN}/characters/char_${n}.png`);

const SRC_W = 16, SRC_H = 32;    // source frame size in PNG
const SCALE = 2;                   // upscale factor
const CHAR_DW = SRC_W * SCALE;    // 32 px displayed
const CHAR_DH = SRC_H * SCALE;    // 64 px displayed
const WALK_CYCLE = [0,1,2,1] as const;

/* ─── PALETTE ─────────────────────────────────────────────────── */
const P = {
  // Floors
  workA:  "#8a6e44", workB:  "#7a5e34",
  meetA:  "#484d6c", meetB:  "#383d5c",
  breakA: "#485e48", breakB: "#384e38",
  // Walls / separators
  wall:   "#2a2840", wallHi: "#3c3860",
  // Desk (warm oak)
  deskTop:"#9c7828", deskEdT:"#b08c30", deskEdB:"#5c4012",
  // Monitor
  monBody:"#18181e", monScr: "#080c1a",
  // Chair
  chairS: "#2a3052", chairB: "#1e2545", chairHi:"#3a4068",
  // Bookshelf
  shelfW: "#3c2808", shelfB: "#5c4022",
  // Plants
  pot:    "#b45030", potRim: "#943020",
  leafD:  "#1a5020", leafM:  "#2a7030", leafL:  "#3a8040",
  // Table
  tableT: "#7b4f2e", tableE: "#5c3820",
  // Couch
  couchB: "#2d5a40", couchF: "#1d4a30",
  // Coffee machine
  coffB:  "#1a1a2a", coffSc: "#aa3010",
  // Status colors
  working:"#6366f1", thinking:"#3b82f6",
  meeting:"#22c55e", messaging:"#f59e0b",
  idle:   "#94a3b8", offline: "#4b5563",
};

/* ─── FLOOR TILE DRAWING ──────────────────────────────────────── */
function fillCheckerboard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  ca: string, cb: string,
) {
  const t = TILE;
  for (let tx = 0; tx < w; tx += t) {
    for (let ty = 0; ty < h; ty += t) {
      const alt = ((tx / t + ty / t) % 2) === 0;
      ctx.fillStyle = alt ? ca : cb;
      ctx.fillRect(x + tx, y + ty, Math.min(t, w - tx), Math.min(t, h - ty));
    }
  }
  // Subtle grid lines
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  for (let tx = 0; tx <= w; tx += t) {
    ctx.beginPath(); ctx.moveTo(x + tx, y); ctx.lineTo(x + tx, y + h); ctx.stroke();
  }
  for (let ty = 0; ty <= h; ty += t) {
    ctx.beginPath(); ctx.moveTo(x, y + ty); ctx.lineTo(x + w, y + ty); ctx.stroke();
  }
}

/* ─── FURNITURE DRAWING ───────────────────────────────────────── */

/** Desk: 3×2 tiles = 96×64 px (oak surface + monitor + keyboard) */
function drawDesk(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const dw = TILE * 3, dh = TILE * 2; // 96 × 64

  // Surface
  ctx.fillStyle = P.deskTop;
  ctx.fillRect(x, y, dw, dh);
  // Top edge highlight
  ctx.fillStyle = P.deskEdT;
  ctx.fillRect(x, y, dw, 4);
  ctx.fillRect(x, y, 4, dh);
  // Bottom / right shadow
  ctx.fillStyle = P.deskEdB;
  ctx.fillRect(x, y + dh - 4, dw, 4);
  ctx.fillRect(x + dw - 4, y, 4, dh);

  // Monitor body
  const mx = x + dw / 2 - 14;
  const my = y + 6;
  ctx.fillStyle = P.monBody;
  ctx.fillRect(mx, my, 28, 22);
  // Screen
  ctx.fillStyle = P.monScr;
  ctx.fillRect(mx + 2, my + 2, 24, 18);
  // Code lines glow
  ctx.fillStyle = "rgba(80,200,255,0.75)";
  ctx.fillRect(mx + 4, my + 4,  14, 2);
  ctx.fillStyle = "rgba(80,255,130,0.65)";
  ctx.fillRect(mx + 4, my + 8,  20, 2);
  ctx.fillStyle = "rgba(200,140,255,0.55)";
  ctx.fillRect(mx + 4, my + 12, 10, 2);
  ctx.fillStyle = "rgba(80,200,255,0.4)";
  ctx.fillRect(mx + 4, my + 16, 18, 2);
  // Monitor stand
  ctx.fillStyle = P.monBody;
  ctx.fillRect(mx + 11, my + 22, 6, 4);
  ctx.fillRect(mx + 7, my + 26, 14, 3);

  // Keyboard
  ctx.fillStyle = "#222238";
  ctx.fillRect(x + 14, y + dh - 14, 52, 10);
  ctx.fillStyle = "#3a3a52";
  for (let k = 0; k < 9; k++) ctx.fillRect(x + 16 + k * 5, y + dh - 12, 3, 6);

  // Mouse
  ctx.fillStyle = "#2a2a3c";
  ctx.beginPath();
  ctx.ellipse(x + dw - 15, y + dh - 9, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a3a4c";
  ctx.fillRect(x + dw - 17, y + dh - 12, 4, 3);
}

/** Chair: 1×1 tile = 32×32 px */
function drawChair(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE + 3, y = row * TILE + 2;
  const w = TILE - 6, h = TILE - 4;
  // Back
  ctx.fillStyle = P.chairB;
  ctx.fillRect(x, y, w, h * 0.4);
  ctx.fillStyle = "#2a2d48";
  ctx.fillRect(x + 2, y + 2, w - 4, h * 0.35 - 2);
  // Seat
  ctx.fillStyle = P.chairS;
  ctx.fillRect(x, y + h * 0.42, w, h * 0.4);
  ctx.fillStyle = P.chairHi;
  ctx.fillRect(x + 2, y + h * 0.44, w - 4, h * 0.15);
  // Legs
  ctx.fillStyle = "#1a1a28";
  ctx.fillRect(x + 2,     y + h * 0.82, 4, h * 0.18);
  ctx.fillRect(x + w - 6, y + h * 0.82, 4, h * 0.18);
  // Wheels
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(x + 4,     y + h, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w - 4, y + h, 3, 0, Math.PI * 2); ctx.fill();
}

/** Bookshelf: 2 tiles wide × 1 tall = 64×32 px */
function drawBookshelf(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const w = TILE * 2, h = TILE;
  // Frame
  ctx.fillStyle = P.shelfW;
  ctx.fillRect(x, y, w, h);
  // Shelf boards
  ctx.fillStyle = P.shelfB;
  ctx.fillRect(x, y, w, 5);
  ctx.fillRect(x, y + h - 5, w, 5);
  ctx.fillRect(x, y, 4, h);
  ctx.fillRect(x + w - 4, y, 4, h);
  // Books
  const bc = ["#c0392b","#2980b9","#27ae60","#8e44ad","#e67e22","#16a085","#e74c3c","#f39c12","#1abc9c","#d35400"];
  for (let b = 0; b < 8; b++) {
    const bx = x + 5 + b * 7;
    ctx.fillStyle = bc[b % bc.length];
    ctx.fillRect(bx, y + 5, 6, h - 10);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(bx, y + 5, 1, h - 10);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(bx + 5, y + 5, 1, h - 10);
  }
}

/** Plant: 1 tile wide × 2 tall = 32×64 px */
function drawPlant(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  // Pot
  ctx.fillStyle = P.potRim;
  ctx.fillRect(x + 8, y + 40, 16, 4);
  ctx.fillStyle = P.pot;
  ctx.fillRect(x + 9, y + 44, 14, 18);
  ctx.fillStyle = "#8a2810";
  ctx.fillRect(x + 11, y + 56, 10, 6);
  // Leaves
  ctx.fillStyle = P.leafD;
  ctx.beginPath(); ctx.arc(x + 16, y + 28, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.leafM;
  ctx.beginPath(); ctx.arc(x + 8,  y + 22, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 24, y + 20, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 16, y + 14, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.leafL;
  ctx.beginPath(); ctx.arc(x + 12, y + 22, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 20, y + 18, 5, 0, Math.PI * 2); ctx.fill();
}

/** Small plant: 1×1 tile */
function drawSmallPlant(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE + 4, y = row * TILE + 4;
  ctx.fillStyle = P.pot;
  ctx.fillRect(x + 4, y + 16, 12, 12);
  ctx.fillStyle = P.leafD;
  ctx.beginPath(); ctx.arc(x + 10, y + 10, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.leafM;
  ctx.beginPath(); ctx.arc(x + 5,  y + 7,  6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 16, y + 6,  6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.leafL;
  ctx.beginPath(); ctx.arc(x + 10, y + 4,  4, 0, Math.PI * 2); ctx.fill();
}

/** Meeting table: oval drawn via canvas API, centered at (col, row) pixel centre */
function drawMeetingTable(ctx: CanvasRenderingContext2D) {
  const cx = 30 * TILE, cy = 6 * TILE;
  const rx = TILE * 4, ry = TILE * 2.5;
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx + 6, cy + 8, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Table surface
  ctx.fillStyle = P.tableT;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.tableE;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Edge highlight
  ctx.strokeStyle = "rgba(255,200,140,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx - 12, cy - 8, rx * 0.65, ry * 0.55, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  // Wood grain lines
  ctx.strokeStyle = "rgba(90,50,10,0.3)";
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.8, ry * (0.2 + Math.abs(i) * 0.15), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Meeting chair: tiny version */
function drawMeetingChair(ctx: CanvasRenderingContext2D, col: number, row: number, dir: number) {
  const x = col * TILE + 4, y = row * TILE + 4;
  const w = TILE - 8, h = TILE - 8;
  ctx.fillStyle = P.chairB;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.chairS;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  // Direction indicator (small dot showing which way the chair faces)
  ctx.fillStyle = P.chairHi;
  const cx2 = x + w / 2, cy2 = y + h / 2;
  const offsets = [[0,-4],[0,4],[-4,0],[4,0]]; // DOWN, UP, LEFT, RIGHT — but dir is DOWN=0,LEFT=1,RIGHT=2,UP=3
  const [ox, oy] = offsets[Math.min(dir, 3)];
  ctx.beginPath(); ctx.arc(cx2 + ox, cy2 + oy, 3, 0, Math.PI * 2); ctx.fill();
}

/** Couch: 4×2 tiles = 128×64 px */
function drawCouch(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const w = TILE * 4, h = TILE * 2;
  // Body
  ctx.fillStyle = P.couchB;
  ctx.fillRect(x, y, w, h);
  // Backrest
  ctx.fillStyle = P.couchF;
  ctx.fillRect(x, y, w, TILE * 0.5);
  // Armrests
  ctx.fillRect(x, y, TILE * 0.4, h);
  ctx.fillRect(x + w - TILE * 0.4, y, TILE * 0.4, h);
  // Cushions (3)
  const cw = (w - TILE * 0.8 - 12) / 3;
  for (let i = 0; i < 3; i++) {
    const cx2 = x + TILE * 0.4 + 2 + i * (cw + 4);
    ctx.fillStyle = "#3a7050";
    ctx.fillRect(cx2, y + TILE * 0.5 + 2, cw, h - TILE * 0.5 - 4);
    ctx.fillStyle = "#4a8060";
    ctx.fillRect(cx2 + 2, y + TILE * 0.5 + 4, cw - 4, 8);
  }
  // Leg dots
  ctx.fillStyle = "#111";
  [[4,h-6],[w-8,h-6],[4,h-6],[w-8,h-6]].slice(0,2).forEach(([lx,ly])=>{
    ctx.beginPath(); ctx.arc(x+lx, y+ly, 4, 0, Math.PI*2); ctx.fill();
  });
}

/** Coffee machine: 1×2 tiles */
function drawCoffeeMachine(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE + 4, y = row * TILE + 2;
  const w = TILE - 8, h = TILE * 2 - 4;
  // Body
  ctx.fillStyle = "#1e1e2e";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#2a2a3a";
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  // Brand strip (red)
  ctx.fillStyle = "#c0300a";
  ctx.fillRect(x + 2, y + 4, w - 4, 6);
  // Display
  ctx.fillStyle = "#003a20";
  ctx.fillRect(x + 4, y + 14, w - 8, 8);
  ctx.fillStyle = "#00aa60";
  ctx.fillRect(x + 5, y + 15, 3, 6);
  // Buttons
  ctx.fillStyle = "#444454";
  for (let b = 0; b < 3; b++) ctx.fillRect(x + 3 + b * 6, y + 26, 5, 5);
  // Cup nozzle
  ctx.fillStyle = "#333340";
  ctx.fillRect(x + w/2 - 3, y + h - 14, 6, 8);
  // Cup
  ctx.fillStyle = "#f0e0c0";
  ctx.fillRect(x + w/2 - 5, y + h - 8, 10, 8);
  ctx.fillStyle = "#8b4400";
  ctx.fillRect(x + w/2 - 4, y + h - 7, 8, 2);
}

/** Small whiteboard on wall: 2×1 tiles */
function drawWhiteboard(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const w = TILE * 2, h = TILE;
  ctx.fillStyle = "#1a1a2a";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#e8e8f0";
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  // Marker lines
  ctx.fillStyle = "#2060c0";
  ctx.fillRect(x + 6, y + 8, 24, 2);
  ctx.fillStyle = "#c02020";
  ctx.fillRect(x + 6, y + 13, 18, 2);
  ctx.fillStyle = "#206020";
  ctx.fillRect(x + 6, y + 18, 28, 2);
  // Tray
  ctx.fillStyle = "#888";
  ctx.fillRect(x + 3, y + h - 6, w - 6, 3);
}

/** Clock on wall: 1×1 tile */
function drawClock(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const cx2 = col * TILE + TILE / 2, cy2 = row * TILE + TILE / 2;
  ctx.fillStyle = "#e8e0c8";
  ctx.beginPath(); ctx.arc(cx2, cy2, TILE/2 - 2, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#3a3020";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx2, cy2, TILE/2 - 2, 0, Math.PI*2); ctx.stroke();
  // Clock hands
  ctx.strokeStyle = "#1a1a2a";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2 + 5, cy2 - 7); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2 - 7, cy2 + 3); ctx.stroke();
  // Centre dot
  ctx.fillStyle = "#1a1a2a";
  ctx.beginPath(); ctx.arc(cx2, cy2, 2, 0, Math.PI*2); ctx.fill();
}

/* ─── FULL OFFICE BACKGROUND ─────────────────────────────────── */
function drawOffice(ctx: CanvasRenderingContext2D) {
  /* ── Floors ── */
  // Work area floor (col 0-21, row 1-19 → exclude wall row 0)
  fillCheckerboard(ctx, 0, TILE, WORK_W, CANVAS_H - TILE, P.workA, P.workB);
  // Meeting room floor
  fillCheckerboard(ctx, MEET_X, TILE, CANVAS_W - MEET_X, BREAK_Y - TILE, P.meetA, P.meetB);
  // Break area floor
  fillCheckerboard(ctx, MEET_X, BREAK_Y, CANVAS_W - MEET_X, CANVAS_H - BREAK_Y, P.breakA, P.breakB);

  /* ── Walls / separators ── */
  // Top wall (bookshelf wall)
  ctx.fillStyle = P.wall;
  ctx.fillRect(0, 0, CANVAS_W, TILE);
  // Right-zone top wall accent
  ctx.fillStyle = P.wallHi;
  ctx.fillRect(MEET_X, 0, CANVAS_W - MEET_X, 4);
  // Vertical wall between work and meeting/break
  ctx.fillStyle = P.wall;
  ctx.fillRect(MEET_X - TILE, 0, TILE, CANVAS_H);
  ctx.fillStyle = P.wallHi;
  ctx.fillRect(MEET_X - 4, 0, 4, CANVAS_H);
  // Horizontal separator: meeting ↔ break
  ctx.fillRect(MEET_X, BREAK_Y - TILE / 4, CANVAS_W - MEET_X, TILE / 4);

  /* ── Bookshelves (top wall, work area) ── */
  for (let c = 0; c < 20; c += 2) drawBookshelf(ctx, c, 0);

  /* ── Meeting room clock + whiteboard on top wall ── */
  drawWhiteboard(ctx, 25, 0);
  drawClock(ctx, 35, 0);

  /* ── Desks ── */
  for (const d of DESK_CONFIGS) {
    drawDesk(ctx, d.deskCol, d.deskRow);
    drawChair(ctx, d.deskCol + 1, d.deskRow + 3);
  }

  /* ── Corner plants (work area) ── */
  drawPlant(ctx, 0, 3);   // left edge near desk row 1
  drawPlant(ctx, 20, 3);  // right edge work area, row 1
  drawPlant(ctx, 0, 13);  // left edge near desk row 2
  drawPlant(ctx, 20, 13); // right edge, row 2

  /* ── Meeting room ── */
  drawMeetingTable(ctx);
  // Chairs around the table
  for (let i = 0; i < 6; i++) {
    const s = MEETING_SEATS[i];
    drawMeetingChair(ctx, s.col, s.row, s.dir);
  }
  // Plants in corners of meeting room
  drawSmallPlant(ctx, 22, 11);
  drawSmallPlant(ctx, 37, 1);

  /* ── Break area ── */
  drawCouch(ctx, 23, 14);
  drawCoffeeMachine(ctx, 36, 13);
  drawSmallPlant(ctx, 22, 18);
  drawSmallPlant(ctx, 37, 18);
  // Small coffee table in front of couch
  ctx.fillStyle = P.tableT;
  ctx.fillRect(23 * TILE + 8, 17 * TILE + 4, TILE * 3 - 16, TILE - 8);
  ctx.fillStyle = P.tableE;
  ctx.fillRect(23 * TILE + 8, 17 * TILE + 4, TILE * 3 - 16, 3);

  /* ── Zone labels ── */
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(220,170,80,0.55)";
  ctx.fillText("ÁREA DE TRABALHO", 4, TILE + 4);
  ctx.fillStyle = "rgba(100,140,255,0.6)";
  ctx.fillText("SALA DE REUNIÃO", MEET_X + 4, TILE + 4);
  ctx.fillStyle = "rgba(60,200,100,0.6)";
  ctx.fillText("ÁREA DE DESCANSO", MEET_X + 4, BREAK_Y + 4);
}

/* ─── CHARACTER STATE MACHINE ─────────────────────────────────── */
const DIR   = { DOWN: 0, UP: 1, RIGHT: 2, LEFT: 3 } as const;
type Dir    = (typeof DIR)[keyof typeof DIR];
const ST    = { TYPE: "type", WALK: "walk", IDLE: "idle" } as const;
type State  = (typeof ST)[keyof typeof ST];

const WALK_SPD       = 80;
const WALK_FRAME_DUR = 0.15;
const TYPE_FRAME_DUR = 0.3;
const WANDER_MIN     = 2.5;
const WANDER_MAX     = 10.0;
const WANDER_LIMIT   = 4;
const TYPING_CHARS   = ["{}", "</>", "fn()", "01", "=>", "[]", "..."];

interface Char {
  id: string; state: State; dir: Dir;
  x: number; y: number; tileCol: number; tileRow: number;
  path: Array<{col:number;row:number}>; moveProgress: number;
  frame: number; frameTimer: number;
  wanderTimer: number; wanderCount: number; wanderLimit: number;
  isActive: boolean; inMeeting: boolean; isOffline: boolean;
  seatIdx: number; typingChar: string; typingAlpha: number;
}

function tc(col: number, row: number) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function createChar(id: string, seatIdx: number): Char {
  const s = DESK_SEATS[seatIdx % DESK_SEATS.length];
  const {x, y} = tc(s.col, s.row);
  return {
    id, state: ST.TYPE, dir: DIR.DOWN, x, y,
    tileCol: s.col, tileRow: s.row,
    path: [], moveProgress: 0, frame: 0, frameTimer: 0,
    wanderTimer: 2 + Math.random() * 5, wanderCount: 0,
    wanderLimit: 2 + Math.floor(Math.random() * WANDER_LIMIT),
    isActive: true, inMeeting: false, isOffline: false,
    seatIdx, typingChar: "{}", typingAlpha: 0,
  };
}

function startWalk(ch: Char, tc2: number, tr: number, map: number[][]): void {
  if (ch.tileCol === tc2 && ch.tileRow === tr) { ch.path = []; return; }
  const p = findPath(ch.tileCol, ch.tileRow, tc2, tr, map);
  if (p.length > 0) { ch.path = p; ch.moveProgress = 0; ch.state = ST.WALK; ch.frame = 0; ch.frameTimer = 0; }
}

function updateChar(ch: Char, dt: number, map: number[][], walkable: Array<{col:number;row:number}>): void {
  const ds = DESK_SEATS[ch.seatIdx % DESK_SEATS.length];
  const ms = MEETING_SEATS[ch.seatIdx % MEETING_SEATS.length];
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
      if (ch.inMeeting && (ch.tileCol !== ms.col || ch.tileRow !== ms.row)) {
        startWalk(ch, ms.col, ms.row, map);
      } else if (!ch.isActive && !ch.isOffline) {
        ch.state = ST.IDLE; ch.wanderTimer = 1 + Math.random() * 3;
        ch.typingAlpha = 0; ch.frame = 0; ch.frameTimer = 0;
      } else if ((ch.isActive || ch.isOffline) && (ch.tileCol !== ds.col || ch.tileRow !== ds.row)) {
        startWalk(ch, ds.col, ds.row, map);
      }
      break;
    }
    case ST.IDLE: {
      ch.frame = 0;
      ch.typingAlpha = Math.max(0, ch.typingAlpha - dt * 3);
      if (ch.inMeeting) { startWalk(ch, ms.col, ms.row, map); break; }
      if (ch.isActive || ch.isOffline) { startWalk(ch, ds.col, ds.row, map); break; }
      ch.wanderTimer -= dt;
      if (ch.wanderTimer <= 0) {
        ch.wanderTimer = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
        if (ch.wanderCount >= ch.wanderLimit) {
          startWalk(ch, ds.col, ds.row, map);
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
        const {x,y} = tc(ch.tileCol, ch.tileRow); ch.x = x; ch.y = y;
        const atD = ch.tileCol===ds.col && ch.tileRow===ds.row;
        const atM = ch.tileCol===ms.col && ch.tileRow===ms.row;
        if (ch.inMeeting && atM) { ch.state=ST.TYPE; ch.dir=ms.dir as Dir; }
        else if ((ch.isActive||ch.isOffline) && atD) { ch.state=ST.TYPE; ch.dir=DIR.DOWN; }
        else { ch.state=ST.IDLE; ch.wanderTimer=1+Math.random()*3; }
        ch.frame=0; ch.frameTimer=0; break;
      }
      const nx = ch.path[0];
      const dc = nx.col - ch.tileCol, dr = nx.row - ch.tileRow;
      if (dc>0) ch.dir=DIR.RIGHT; else if (dc<0) ch.dir=DIR.LEFT;
      else if (dr>0) ch.dir=DIR.DOWN; else ch.dir=DIR.UP;
      ch.moveProgress += (WALK_SPD / TILE) * dt;
      const fr = tc(ch.tileCol,ch.tileRow), to = tc(nx.col,nx.row);
      const t = Math.min(ch.moveProgress,1);
      ch.x = fr.x+(to.x-fr.x)*t; ch.y = fr.y+(to.y-fr.y)*t;
      if (ch.moveProgress >= 1) {
        ch.tileCol=nx.col; ch.tileRow=nx.row;
        ch.x=to.x; ch.y=to.y; ch.moveProgress=0; ch.path.shift();
      }
      if (ch.inMeeting) { const l=ch.path[ch.path.length-1]; if(!l||l.col!==ms.col||l.row!==ms.row) startWalk(ch,ms.col,ms.row,map); }
      else if (ch.isActive||ch.isOffline) { const l=ch.path[ch.path.length-1]; if(!l||l.col!==ds.col||l.row!==ds.row) startWalk(ch,ds.col,ds.row,map); }
      break;
    }
  }
}

/* ─── ASSET LOADER (char PNGs only) ──────────────────────────── */
function loadImg(url: string): Promise<HTMLImageElement|null> {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

/* ─── CHARACTER SPRITE RENDERER ──────────────────────────────── */
function getFrameIdx(ch: Char): number {
  if (ch.state === ST.WALK) return WALK_CYCLE[ch.frame % 4];
  if (ch.state === ST.TYPE) return 3 + (ch.frame % 2);
  return 0;
}

// Fallback: solid coloured rectangle when PNG not loaded
const FALLBACK_COLORS = ["#6366f1","#f59e0b","#22c55e","#ef4444","#a855f7","#06b6d4"];

function drawChar(
  ctx: CanvasRenderingContext2D,
  ch: Char,
  charImg: HTMLImageElement | null,
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
    ctx.arc(ch.x, ch.y+2, CHAR_DW/2+6, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(ch.x, ch.y+4, CHAR_DW/2+3, 5, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // Sprite
  ctx.save();
  ctx.globalAlpha = ch.isOffline ? 0.4 : 1.0;
  if (charImg) {
    const fi  = getFrameIdx(ch);
    const isL = ch.dir === DIR.LEFT;
    const row = ch.dir === DIR.DOWN ? 0 : ch.dir === DIR.UP ? 1 : 2;
    const sx = fi * SRC_W, sy = row * SRC_H;
    if (isL) {
      ctx.translate(dx + CHAR_DW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(charImg, sx, sy, SRC_W, SRC_H, 0, dy, CHAR_DW, CHAR_DH);
    } else {
      ctx.drawImage(charImg, sx, sy, SRC_W, SRC_H, dx, dy, CHAR_DW, CHAR_DH);
    }
  } else {
    // Fallback rectangle character
    const fc = FALLBACK_COLORS[ch.seatIdx % FALLBACK_COLORS.length];
    ctx.fillStyle = fc;
    ctx.fillRect(dx + 4, dy + 8, CHAR_DW - 8, CHAR_DH - 8);
    ctx.fillStyle = "#f5c5a3";
    ctx.beginPath(); ctx.arc(ch.x, dy + 10, 8, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Name label
  ctx.save();
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const lbl = agent.name.split(" ")[0];
  const tw  = ctx.measureText(lbl).width;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(ch.x - tw/2 - 3, dy - 15, tw+6, 13);
  ctx.fillStyle = "#fff";
  ctx.fillText(lbl, ch.x, dy - 2);
  ctx.restore();

  // Status dot
  const sc: Record<string,string> = {
    working: P.working, thinking: P.thinking, in_meeting: P.meeting,
    messaging: P.messaging, idle: P.idle, offline: P.offline,
  };
  ctx.fillStyle = sc[status] ?? P.idle;
  ctx.beginPath(); ctx.arc(dx + CHAR_DW + 4, dy + 4, 4, 0, Math.PI*2); ctx.fill();

  // Typing text (working)
  if (ch.isActive && ch.typingAlpha > 0.05) {
    ctx.save();
    ctx.globalAlpha = ch.typingAlpha * 0.9;
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#8ec4ff";
    ctx.textAlign = "center";
    ctx.fillText(ch.typingChar, ch.x, dy - 24);
    ctx.restore();
  }

  // Thought bubble (thinking)
  if (status === "thinking") {
    const bx = dx + CHAR_DW + 6, by = dy + 4;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath(); ctx.arc(bx+11, by-4, 11, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("?", bx+11, by-4);
    [0,1,2].forEach(d => {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.arc(bx+d*5, by+9+d*4, 2.2-d*0.3, 0, Math.PI*2); ctx.fill();
    });
    ctx.restore();
  }
}

/* ─── PROPS ───────────────────────────────────────────────────── */
interface OfficeCanvasProps {
  agents:              Agent[];
  onAgentClick:        (agent: Agent, pos: {x:number;y:number}) => void;
  selectedAgentId:     string | null;
  meetingParticipants: string[];
  containerWidth:      number;
  containerHeight:     number;
}

/* ─── COMPONENT ───────────────────────────────────────────────── */
export default function OfficeCanvas({
  agents, onAgentClick, selectedAgentId,
  meetingParticipants, containerWidth, containerHeight,
}: OfficeCanvasProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const charsRef    = useRef<Map<string,Char>>(new Map());
  const agentsRef   = useRef(agents);
  const meetsRef    = useRef(meetingParticipants);
  const selRef      = useRef(selectedAgentId);
  const charImgsRef = useRef<(HTMLImageElement|null)[]>([]);
  const tileMapRef  = useRef(buildTileMap());
  const walkRef     = useRef(getWalkableTiles(tileMapRef.current));

  agentsRef.current = agents;
  meetsRef.current  = meetingParticipants;
  selRef.current    = selectedAgentId;

  // Init/cleanup character objects
  useEffect(() => {
    agents.forEach((a, i) => {
      if (!charsRef.current.has(a.id)) charsRef.current.set(a.id, createChar(a.id, i));
    });
    for (const id of charsRef.current.keys())
      if (!agents.find(a => a.id === id)) charsRef.current.delete(id);
  }, [agents]);

  // Load character PNG sprites once
  useEffect(() => {
    Promise.all(CHAR_URLS.map(loadImg)).then(imgs => { charImgsRef.current = imgs; });
  }, []);

  // Click hit-test
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
    for (const [id, ch] of charsRef.current) {
      if (mx >= ch.x-CHAR_DW/2 && mx <= ch.x+CHAR_DW/2 && my >= ch.y-CHAR_DH && my <= ch.y) {
        const ag = agentsRef.current.find(a => a.id === id);
        if (ag) onAgentClick(ag, {x: e.clientX, y: e.clientY});
        return;
      }
    }
  }, [onAgentClick]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const map = tileMapRef.current, walk = walkRef.current;

    const stop = startGameLoop(canvas, {
      update(dt) {
        const meets = meetsRef.current;
        for (const [id, ch] of charsRef.current) {
          const ag = agentsRef.current.find(a => a.id === id);
          if (!ag) continue;
          const st = ag.status ?? "idle";
          ch.isActive  = (st==="working"||st==="thinking") && !meets.includes(id) && st!=="in_meeting";
          ch.inMeeting = meets.includes(id) || st==="in_meeting";
          ch.isOffline = !ag.is_active || st==="offline";
          updateChar(ch, dt, map, walk);
        }
      },
      render(ctx) {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        drawOffice(ctx);
        // Z-sort by Y (front characters over back)
        const sorted = [...charsRef.current.values()].sort((a,b) => a.y - b.y);
        for (const ch of sorted) {
          const ag = agentsRef.current.find(a => a.id === ch.id);
          if (!ag) continue;
          const img = charImgsRef.current[ch.seatIdx % CHAR_URLS.length] ?? null;
          drawChar(ctx, ch, img, ag, selRef.current === ch.id);
        }
      },
    });
    return stop;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{background:"#1a1830"}}>
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
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 text-[10px] font-mono
                      bg-black/65 rounded-lg px-3 py-2 border border-white/10">
        {[
          [P.working,"Trabalhando"],[P.thinking,"Pensando"],
          [P.meeting,"Em reunião"],[P.messaging,"Mensagens"],
          [P.idle,"Ocioso"],[P.offline,"Offline"],
        ].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:c}}/>
            <span className="text-white/70">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
