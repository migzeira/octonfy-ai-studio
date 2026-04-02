/**
 * OfficeCanvas.tsx — Octonfy Virtual Office v4
 *
 * Improvements over v3:
 * - Better pixel-art furniture: gaming desk, ergonomic chair, monstera,
 *   snake plant, cactus, flat TV, premium couch, espresso machine
 * - Break area TV lounge: idle agents walk to couch seats to watch TV
 * - Editor mode: click canvas tiles to place custom furniture items
 * - Placed items persisted via parent (useFurnitureEditor hook)
 *
 * Engine: BFS pathfinding + TYPE / WALK / IDLE FSM (unchanged).
 * Character sprites: pixel-agents GitHub CDN (char_0–5.png).
 */

import { useRef, useEffect, useCallback, useState } from "react";
import type { Agent } from "@/hooks/useRealtimeAgents";
import type { PlacedItem, FurnitureType, FloorTheme } from "@/hooks/useFurnitureEditor";
import { ITEM_SIZES, WALKABLE_ITEM_TYPES, FLOOR_THEMES } from "@/hooks/useFurnitureEditor";
import { startGameLoop } from "./engine/gameLoop";
import {
  TILE, COLS, ROWS, BLOCKED, FLOOR,
  buildTileMap, getWalkableTiles, findPath,
  DESK_SEATS, MEETING_SEATS, LOUNGE_SEATS,
  WORK_W, MEET_X, BREAK_Y,
} from "./engine/tileMap";

/* ─── CANVAS ──────────────────────────────────────────────────── */
const CANVAS_W = COLS * TILE; // 1216
const CANVAS_H = ROWS * TILE; // 640

/* ─── CHAR SPRITE SHEET (pixel-agents CDN) ────────────────────── */
const CDN  = "https://raw.githubusercontent.com/pablodelucca/pixel-agents/main/webview-ui/public/assets";
const CHAR_URLS = [0,1,2,3,4,5].map(n => `${CDN}/characters/char_${n}.png`);

const SRC_W = 16, SRC_H = 32;
const SCALE = 2;
const CHAR_DW = SRC_W * SCALE; // 32 px
const CHAR_DH = SRC_H * SCALE; // 64 px
const WALK_CYCLE = [0,1,2,1] as const;

/* ─── PALETTE ─────────────────────────────────────────────────── */
const P = {
  workA:  "#9a7a4a", workB:  "#8a6a3a",
  meetA:  "#3e4466", meetB:  "#2e3456",
  breakA: "#3a5c3a", breakB: "#2a4c2a",
  wall:   "#1e1c30", wallHi: "#2e2c40", wallAccent: "#4a4870",
  deskTop:"#c8901e", deskHi: "#e8b030", deskSh: "#4c3008",
  monBezel:"#0e0e18", monScr: "#040812",
  kbBody: "#1a1a28",
  chairBase:"#121218", chairSeat:"#252848", chairBack:"#1a2040",
  chairCush:"#3848a8", chairHi:"#4858c8", chairArm:"#1e2030",
  shelfW: "#2c1c06", shelfHi:"#4a3010",
  pot:    "#c05028", potHi:  "#e07040",
  leafD:  "#0d3a18", leafM:  "#1a5a28", leafL:  "#2a7a38",
  tableW: "#7c4a28", tableWhi:"#a86c3a", tableSh:"#3c2010",
  couchBg:"#1e3a28", couchFg:"#2a5038", couchCush:"#3a7050", couchHi:"#4a8060",
  tvBody: "#0a0a14",
  coffBody:"#1a1a2e",
  working:"#6366f1", thinking:"#3b82f6",
  meeting:"#22c55e", messaging:"#f59e0b",
  idle:   "#94a3b8", offline: "#4b5563",
};

/* ─── UTILITY ─────────────────────────────────────────────────── */
function darkenHex(hex: string, amount: number): string {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ─── FLOOR ───────────────────────────────────────────────────── */
function fillCheckerboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ca: string, cb: string) {
  const t = TILE;
  for (let tx = 0; tx < w; tx += t) {
    for (let ty = 0; ty < h; ty += t) {
      ctx.fillStyle = ((tx / t + ty / t) % 2) === 0 ? ca : cb;
      ctx.fillRect(x + tx, y + ty, Math.min(t, w - tx), Math.min(t, h - ty));
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  for (let tx = 0; tx <= w; tx += t) { ctx.beginPath(); ctx.moveTo(x + tx, y); ctx.lineTo(x + tx, y + h); ctx.stroke(); }
  for (let ty = 0; ty <= h; ty += t) { ctx.beginPath(); ctx.moveTo(x, y + ty); ctx.lineTo(x + w, y + ty); ctx.stroke(); }
}

/* ─── FURNITURE ───────────────────────────────────────────────── */

/** Gaming desk: 3×2 tiles with RGB keyboard and ultra-wide monitor */
function drawDesk(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const dw = TILE * 3, dh = TILE * 2;

  // Surface
  ctx.fillStyle = P.deskTop;
  ctx.fillRect(x, y, dw, dh);
  // Wood grain
  ctx.strokeStyle = "rgba(80,40,0,0.2)";
  ctx.lineWidth = 1;
  for (let g = 0; g < dw; g += 7) {
    ctx.beginPath(); ctx.moveTo(x + g, y); ctx.lineTo(x + g + 3, y + dh); ctx.stroke();
  }
  // Edge highlights
  ctx.fillStyle = P.deskHi;
  ctx.fillRect(x, y, dw, 3);
  ctx.fillRect(x, y, 3, dh);
  // Shadow edges
  ctx.fillStyle = P.deskSh;
  ctx.fillRect(x, y + dh - 4, dw, 4);
  ctx.fillRect(x + dw - 4, y, 4, dh);
  // RGB strip under desk
  ctx.fillStyle = "rgba(120,0,255,0.45)";
  ctx.fillRect(x + 6, y + dh - 2, dw - 12, 2);

  // Ultra-wide monitor
  const mx = x + 7, my = y + 3, mw = dw - 14, mh = 22;
  ctx.fillStyle = P.monBezel;
  rr(ctx, mx, my, mw, mh + 5, 3); ctx.fill();
  // Screen
  ctx.fillStyle = P.monScr;
  ctx.fillRect(mx + 2, my + 2, mw - 4, mh);
  // macOS-style title bar
  ctx.fillStyle = "rgba(28,28,45,0.95)";
  ctx.fillRect(mx + 2, my + 2, mw - 4, 5);
  ctx.fillStyle = "#ff5f57"; ctx.beginPath(); ctx.arc(mx + 5, my + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#febc2e"; ctx.beginPath(); ctx.arc(mx + 10, my + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#28c840"; ctx.beginPath(); ctx.arc(mx + 15, my + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  // Code lines
  const lines = [
    { w: 18, c: "rgba(80,200,255,0.9)" },
    { w: 30, c: "rgba(200,120,255,0.85)" },
    { w: 22, c: "rgba(80,255,130,0.8)" },
    { w: 26, c: "rgba(255,200,80,0.75)" },
    { w: 16, c: "rgba(80,200,255,0.7)" },
    { w: 32, c: "rgba(200,80,255,0.8)" },
    { w: 20, c: "rgba(80,255,200,0.75)" },
    { w: 14, c: "rgba(255,140,80,0.7)" },
    { w: 28, c: "rgba(80,160,255,0.8)" },
  ];
  lines.forEach((ln, i) => {
    ctx.fillStyle = ln.c;
    ctx.fillRect(mx + 4 + (i % 3) * 3, my + 8 + i * 1.3, ln.w, 1);
  });
  // Blinking cursor
  const curOn = Math.floor(Date.now() * 0.002) % 2 === 0;
  if (curOn) { ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(mx + 6, my + 18, 2, 3); }
  // Monitor stand
  ctx.fillStyle = P.monBezel;
  ctx.fillRect(mx + mw / 2 - 3, my + mh + 5, 6, 5);
  ctx.fillRect(mx + mw / 2 - 9, my + mh + 10, 18, 3);
  // Monitor RGB glow
  ctx.fillStyle = "rgba(80,0,255,0.5)";
  ctx.fillRect(mx, my + mh + 4, mw, 2);

  // RGB mechanical keyboard
  const kx = x + 8, ky = y + dh - 14, kw = dw - 16, kh = 11;
  ctx.fillStyle = P.kbBody; rr(ctx, kx, ky, kw, kh, 2); ctx.fill();
  const rgb = ["#ff2040", "#ff8000", "#ffff00", "#00ff80", "#0088ff", "#8800ff", "#ff0080"];
  for (let k = 0; k < 13; k++) {
    ctx.fillStyle = rgb[k % rgb.length];
    ctx.globalAlpha = 0.55;
    ctx.fillRect(kx + 3 + k * 5, ky + 2, 3, kh - 4);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(kx + 2, ky + 2, kw - 4, 3);

  // Gaming mouse
  ctx.fillStyle = "#1c1c2c"; rr(ctx, x + dw - 14, y + dh - 13, 10, 13, 3); ctx.fill();
  ctx.fillStyle = "#ff0040"; ctx.fillRect(x + dw - 14, y + dh - 13, 4, 4);
  ctx.fillStyle = "#0060ff"; ctx.fillRect(x + dw - 9, y + dh - 13, 5, 4);

  // Coffee mug
  ctx.fillStyle = "#2a4060"; rr(ctx, x + 4, y + dh - 12, 8, 9, 1); ctx.fill();
  ctx.fillStyle = "#7b3a00"; ctx.fillRect(x + 5, y + dh - 10, 6, 4);
}

/** Ergonomic gaming chair: 1×1 tile */
function drawChair(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const cx = x + TILE / 2, cy = y + TILE / 2;

  // Star base with casters
  ctx.fillStyle = P.chairBase;
  for (let a = 0; a < 5; a++) {
    const ang = (a / 5) * Math.PI * 2 - Math.PI / 2;
    const bx = cx + Math.cos(ang) * 10, by = cy + Math.sin(ang) * 8 + 8;
    ctx.fillRect(bx - 2, by - 1, 4, 3);
    ctx.fillStyle = "#090910";
    ctx.beginPath(); ctx.arc(bx, by + 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.chairBase;
  }
  // Gas piston
  ctx.fillStyle = "#2c2c3c"; ctx.fillRect(cx - 2, cy + 1, 4, 7);

  // Seat
  ctx.fillStyle = P.chairSeat; rr(ctx, x + 3, cy - 3, TILE - 6, 9, 3); ctx.fill();
  ctx.fillStyle = P.chairCush; rr(ctx, x + 5, cy - 1, TILE - 10, 7, 2); ctx.fill();
  ctx.fillStyle = P.chairHi; ctx.fillRect(x + 7, cy + 1, TILE - 14, 2);

  // Backrest — fixed: use constant pixel height, not cy-3 (which grew with row index)
  const backH = TILE / 2 - 4; // 12px
  ctx.fillStyle = P.chairBack; rr(ctx, x + 5, y + 1, TILE - 10, backH, 3); ctx.fill();
  ctx.fillStyle = P.chairCush; rr(ctx, x + 7, y + 3, TILE - 14, Math.max(4, backH - 4), 2); ctx.fill();

  // Headrest
  ctx.fillStyle = P.chairBack; rr(ctx, x + 8, y, TILE - 16, 5, 2); ctx.fill();
  ctx.fillStyle = "#ff0060"; ctx.fillRect(x + 8, y, TILE - 16, 1);

  // Armrests
  ctx.fillStyle = P.chairArm;
  ctx.fillRect(x + 1, cy - 4, 4, 6);
  ctx.fillRect(x + TILE - 5, cy - 4, 4, 6);
}

/** Bookshelf: 2×1 tiles with varied book heights */
function drawBookshelf(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const w = TILE * 2, h = TILE;

  ctx.fillStyle = P.shelfW; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.shelfHi;
  ctx.fillRect(x, y, w, 4);
  ctx.fillRect(x, y + h / 2 - 1, w, 2);
  ctx.fillRect(x, y, 3, h);
  ctx.fillRect(x + w - 3, y, 3, h);

  const books = [
    { w: 5, c: "#e53e3e", bh: h * 0.70 }, { w: 6, c: "#3182ce", bh: h * 0.65 },
    { w: 4, c: "#38a169", bh: h * 0.75 }, { w: 7, c: "#d69e2e", bh: h * 0.60 },
    { w: 5, c: "#805ad5", bh: h * 0.70 }, { w: 4, c: "#dd6b20", bh: h * 0.65 },
    { w: 6, c: "#2b6cb0", bh: h * 0.80 }, { w: 5, c: "#c53030", bh: h * 0.55 },
    { w: 4, c: "#276749", bh: h * 0.70 }, { w: 6, c: "#6b46c1", bh: h * 0.75 },
  ];
  let bx = x + 4;
  for (const bd of books) {
    if (bx + bd.w > x + w - 3) break;
    const by = y + h - 4 - bd.bh;
    ctx.fillStyle = bd.c; ctx.fillRect(bx, by, bd.w, bd.bh);
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(bx, by, 1, bd.bh);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(bx, by, bd.w, 2);
    bx += bd.w + 1;
  }
}

/** Monstera plant: 1×2 tiles */
function drawPlant(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;

  // Terracotta pot with saucer
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x + 6, y + 58, 20, 4);
  ctx.fillStyle = "#8a3820"; rr(ctx, x + 5, y + 54, 22, 6, 2); ctx.fill();
  ctx.fillStyle = P.pot; rr(ctx, x + 7, y + 44, 18, 14, 3); ctx.fill();
  ctx.fillStyle = P.potHi; ctx.fillRect(x + 8, y + 45, 9, 3);
  ctx.fillStyle = "#c85030"; ctx.fillRect(x + 6, y + 44, 20, 3);
  ctx.fillStyle = "#1c0e06"; ctx.fillRect(x + 8, y + 46, 16, 3);

  // Stem
  ctx.strokeStyle = "#153012"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 16, y + 44); ctx.bezierCurveTo(x + 10, y + 30, x + 22, y + 16, x + 16, y + 4); ctx.stroke();

  // Monstera leaves with fenestration marks
  const leaf = (lx: number, ly: number, ang: number, sz: number) => {
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang);
    ctx.fillStyle = P.leafM;
    ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    // Dark holes (fenestration)
    ctx.fillStyle = P.leafD;
    ctx.beginPath(); ctx.ellipse(sz * 0.35, -sz * 0.08, sz * 0.14, sz * 0.09, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-sz * 0.28, sz * 0.08, sz * 0.11, sz * 0.07, -0.3, 0, Math.PI * 2); ctx.fill();
    // Midrib
    ctx.strokeStyle = "#0a2410"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.lineTo(sz, 0); ctx.stroke();
    ctx.fillStyle = P.leafL;
    ctx.beginPath(); ctx.arc(0, 0, sz * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  leaf(x + 18, y + 18, -0.45, 12); leaf(x + 10, y + 28, 0.5, 10);
  leaf(x + 22, y + 32, -0.8, 9);   leaf(x + 14, y + 10, 0.15, 11);
  leaf(x + 6,  y + 22, -0.2, 8);
}

/** Snake plant (sansevieria): 1×2 tiles */
function drawSnakePlant(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;

  // Dark ceramic pot
  ctx.fillStyle = "#3a2860"; rr(ctx, x + 6, y + 46, 20, 16, 3); ctx.fill();
  ctx.fillStyle = "#5a4880"; ctx.fillRect(x + 7, y + 47, 10, 2);
  ctx.fillStyle = "#1c0e06"; ctx.fillRect(x + 7, y + 48, 18, 4);

  // Upright leaves
  const leaf = (lx: number, baseY: number, height: number, tilt: number) => {
    ctx.save(); ctx.translate(lx, baseY); ctx.rotate(tilt);
    ctx.fillStyle = "#0f3020";
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.bezierCurveTo(-4, -height * 0.4, -2, -height * 0.8, -1, -height);
    ctx.lineTo(1, -height); ctx.bezierCurveTo(2, -height * 0.8, 4, -height * 0.4, 3, 0);
    ctx.closePath(); ctx.fill();
    // Variegation stripes
    for (let s = 0; s < 4; s++) {
      const sv = s / 4;
      ctx.fillStyle = s % 2 === 0 ? "rgba(80,180,80,0.55)" : "rgba(180,230,100,0.35)";
      ctx.fillRect(-2, -height * (sv + 0.05), 4, height * 0.06);
    }
    // Yellow edge highlight
    ctx.fillStyle = "rgba(220,200,60,0.5)";
    ctx.fillRect(-3, -height, 1, height);
    ctx.restore();
  };
  leaf(x + 11, y + 46, 34, -0.12);
  leaf(x + 16, y + 46, 38, 0.04);
  leaf(x + 21, y + 46, 31, 0.16);
  leaf(x + 14, y + 46, 28, -0.22);
  leaf(x + 19, y + 46, 35, -0.06);
}

/** Succulent (small): 1×1 tile */
function drawSmallPlant(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE + 4, y = row * TILE + 4;
  ctx.fillStyle = "#3a2860"; rr(ctx, x + 3, y + 14, 18, 14, 3); ctx.fill();
  ctx.fillStyle = "#5a4880"; ctx.fillRect(x + 4, y + 15, 9, 2);
  ctx.fillStyle = "#1a0e06"; ctx.fillRect(x + 4, y + 16, 16, 3);
  // Rosette petals
  const petals = ["#4a8050", "#3a6040", "#5a9060", "#2a5030"];
  for (let p = 0; p < 8; p++) {
    const pa = (p / 8) * Math.PI * 2;
    ctx.fillStyle = petals[p % 4];
    ctx.beginPath(); ctx.ellipse(x + 12 + Math.cos(pa) * 5, y + 12 + Math.sin(pa) * 4, 4, 3, pa, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#6ab060"; ctx.beginPath(); ctx.arc(x + 12, y + 12, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8ad080"; ctx.beginPath(); ctx.arc(x + 12, y + 12, 2, 0, Math.PI * 2); ctx.fill();
}

/** Cactus: 1×1 tile */
function drawCactus(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE + 4, y = row * TILE;
  // Sandy pot
  ctx.fillStyle = "#b09040"; rr(ctx, x + 3, y + 18, 18, 14, 2); ctx.fill();
  ctx.fillStyle = "#d0b060"; ctx.fillRect(x + 4, y + 19, 8, 2);
  // Body
  ctx.fillStyle = "#286030"; rr(ctx, x + 7, y + 4, 10, 16, 4); ctx.fill();
  ctx.fillStyle = "#389040"; ctx.fillRect(x + 9, y + 5, 4, 14);
  // Arms
  ctx.fillStyle = "#286030";
  rr(ctx, x + 2, y + 8, 6, 4, 2); ctx.fill(); rr(ctx, x + 2, y + 7, 4, 8, 2); ctx.fill();
  rr(ctx, x + 17, y + 10, 6, 4, 2); ctx.fill(); rr(ctx, x + 19, y + 9, 4, 8, 2); ctx.fill();
  // Spines
  ctx.strokeStyle = "rgba(255,240,180,0.75)"; ctx.lineWidth = 0.5;
  for (let s = 0; s < 6; s++) {
    const sy = y + 6 + s * 2;
    ctx.beginPath(); ctx.moveTo(x + 9, sy); ctx.lineTo(x + 7, sy - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 15, sy); ctx.lineTo(x + 17, sy - 1); ctx.stroke();
  }
  // Flower
  ctx.fillStyle = "#ff6090"; ctx.beginPath(); ctx.arc(x + 12, y + 4, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffff80"; ctx.beginPath(); ctx.arc(x + 12, y + 4, 1, 0, Math.PI * 2); ctx.fill();
}

/** Meeting table — parameterized by top-left tile (col, row).
 *  Default layout: col=26 row=3 → center at tile (30, 6) — same as original hardcoded. */
function drawMeetingTableAt(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const cx = (col + 4) * TILE; // 4 tiles right of left edge
  const cy = (row + 3) * TILE; // 3 tiles below top edge
  const rx = TILE * 4, ry = TILE * 2.5;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(cx + 8, cy + 10, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.tableW;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = P.tableSh; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "rgba(80,40,10,0.22)"; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.8, Math.abs(i) * ry * 0.14 + ry * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(230,180,100,0.2)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx - 12, cy - 8, rx * 0.55, ry * 0.45, -0.3, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(200,140,60,0.25)"; ctx.font = "bold 9px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("OCTONFY", cx, cy);
}

/** Wooden door with glass panel: 1×2 tiles */
function drawDoor(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const dw = TILE, dh = TILE * 2;

  // Door frame (dark wood)
  ctx.fillStyle = "#2a1a08"; ctx.fillRect(x, y, dw, dh);
  // Door panel (medium wood)
  ctx.fillStyle = "#6a4020"; rr(ctx, x + 3, y + 2, dw - 6, dh - 4, 3); ctx.fill();
  // Highlights
  ctx.fillStyle = "#8a5830"; ctx.fillRect(x + 5, y + 4, dw - 10, 3);
  ctx.fillStyle = "#4a2c10"; ctx.fillRect(x + 5, y + dh - 7, dw - 10, 3);
  // Upper glass panel
  const gpY = y + 6, gpH = Math.floor(dh * 0.35);
  ctx.fillStyle = "#2a4880"; rr(ctx, x + 7, gpY, dw - 14, gpH, 2); ctx.fill();
  ctx.fillStyle = "rgba(120,180,255,0.35)"; ctx.fillRect(x + 9, gpY + 2, dw - 18, gpH - 4);
  // Glass shine
  ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(x + 9, gpY + 2, 3, gpH - 4);
  // Lower wood panel
  const lpY = gpY + gpH + 4, lpH = dh - lpY + y - 6;
  ctx.fillStyle = "#5a3818"; rr(ctx, x + 7, lpY, dw - 14, lpH, 2); ctx.fill();
  ctx.fillStyle = "#7a5030"; ctx.fillRect(x + 9, lpY + 3, dw - 18, 3);
  // Doorknob
  const kx = x + dw - 8, ky = y + Math.floor(dh * 0.55);
  ctx.fillStyle = "#c8903c"; ctx.beginPath(); ctx.arc(kx, ky, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f0b850"; ctx.beginPath(); ctx.arc(kx - 1, ky - 1, 1.5, 0, Math.PI * 2); ctx.fill();
  // Bottom threshold line
  ctx.fillStyle = "#1a1008"; ctx.fillRect(x + 3, y + dh - 3, dw - 6, 3);
}

/** Flat-screen TV: 3×2 tiles */
function drawTV(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const tw = TILE * 3, th = TILE * 2;

  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x + 4, y + 4, tw - 8, th - 6);
  ctx.fillStyle = P.tvBody; rr(ctx, x + 2, y + 2, tw - 4, th - 4, 4); ctx.fill();
  ctx.fillStyle = "#0c0c1c"; ctx.fillRect(x + 6, y + 6, tw - 12, th - 14);

  // Animated screen
  const t = Date.now() * 0.001;
  const hue1 = (t * 18) % 360, hue2 = (hue1 + 130) % 360;
  ctx.fillStyle = `hsl(${hue1},75%,18%)`; ctx.fillRect(x + 7, y + 7, (tw - 14) * 0.55, th - 16);
  ctx.fillStyle = `hsl(${hue2},65%,14%)`; ctx.fillRect(x + 7 + (tw - 14) * 0.55, y + 7, (tw - 14) * 0.45, th - 16);
  // Cinematic black bars
  ctx.fillStyle = "#000"; ctx.fillRect(x + 7, y + 7, tw - 14, 3); ctx.fillRect(x + 7, y + th - 19, tw - 14, 3);
  // Silhouettes
  ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(x + 12, y + th - 22, 7, 8); ctx.fillRect(x + tw - 22, y + th - 20, 6, 7);
  // Screen glow reflection
  ctx.fillStyle = `rgba(100,150,255,0.1)`; ctx.fillRect(x + 6, y + 6, tw - 12, th - 14);
  // Brand text
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.font = "6px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("4K OLED", x + tw / 2, y + th - 6);
  // Wall mount
  ctx.fillStyle = "#2a2a3a"; ctx.fillRect(x + tw / 2 - 5, y + th - 2, 10, 5); ctx.fillRect(x + tw / 2 - 9, y + th + 3, 18, 2);
  // Power LED
  ctx.fillStyle = "#00ff88"; ctx.beginPath(); ctx.arc(x + tw - 7, y + th - 5, 2, 0, Math.PI * 2); ctx.fill();
}

/** Lounge chair (near TV): 1×1 tile */
function drawLoungeChair(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE + 2, y = row * TILE + 2;
  const w = TILE - 4, h = TILE - 4;
  ctx.fillStyle = "#1e3a28"; rr(ctx, x, y, w, h, 4); ctx.fill();
  ctx.fillStyle = "#2a5038"; rr(ctx, x, y, w, h * 0.38, 4); ctx.fill();
  ctx.fillStyle = "#1e3a28"; ctx.fillRect(x, y + h * 0.2, w, h * 0.18);
  ctx.fillStyle = "#2a5038"; ctx.fillRect(x, y, w * 0.2, h); ctx.fillRect(x + w * 0.8, y, w * 0.2, h);
  ctx.fillStyle = "#3a7050"; rr(ctx, x + w * 0.22, y + h * 0.38, w * 0.56, h * 0.58, 3); ctx.fill();
  ctx.fillStyle = "#4a8060"; ctx.fillRect(x + w * 0.24, y + h * 0.42, w * 0.52, 4);
}

/** Couch: 4×2 tiles */
function drawCouch(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const w = TILE * 4, h = TILE * 2;

  ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(x + 4, y + h, w - 4, 5);
  ctx.fillStyle = P.couchBg; rr(ctx, x, y, w, h, 4); ctx.fill();
  ctx.fillStyle = P.couchFg; rr(ctx, x, y, w, h * 0.38, 4); ctx.fill();
  ctx.fillStyle = P.couchBg; ctx.fillRect(x, y + h * 0.2, w, h * 0.18);
  ctx.fillStyle = P.couchFg; ctx.fillRect(x, y, TILE * 0.42, h); ctx.fillRect(x + w - TILE * 0.42, y, TILE * 0.42, h);

  const cInner = w - TILE * 0.84, cw = (cInner - 8) / 3;
  for (let i = 0; i < 3; i++) {
    const cx2 = x + TILE * 0.42 + 2 + i * (cw + 4);
    ctx.fillStyle = P.couchCush; rr(ctx, cx2, y + h * 0.36, cw, h * 0.6, 3); ctx.fill();
    ctx.fillStyle = P.couchHi; rr(ctx, cx2 + 2, y + h * 0.39, cw - 4, 6, 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx2 + cw / 2, y + h * 0.38 + 3); ctx.lineTo(cx2 + cw / 2, y + h * 0.96); ctx.stroke();
  }
  ctx.fillStyle = "#1a2020";
  [x + 8, x + w - 12].forEach(lx => { ctx.beginPath(); ctx.arc(lx, y + h + 3, 3, 0, Math.PI * 2); ctx.fill(); });
}

/** Espresso machine: 1×2 tiles */
function drawCoffeeMachine(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE + 3, y = row * TILE + 2, w = TILE - 6, h = TILE * 2 - 4;
  ctx.fillStyle = "#1a1a2e"; rr(ctx, x, y, w, h, 3); ctx.fill();
  ctx.fillStyle = "#2a2a3e"; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = "#cc2010"; ctx.fillRect(x + 2, y + 2, w - 4, 5);
  ctx.fillStyle = "#6080a0"; ctx.fillRect(x + 2, y + 7, w - 4, 3);
  ctx.fillStyle = "#809ab0"; ctx.fillRect(x + 2, y + 8, w - 4, 1);
  ctx.fillStyle = "#001820"; rr(ctx, x + 3, y + 14, w - 6, 10, 2); ctx.fill();
  ctx.fillStyle = "#00e080"; ctx.font = "5px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("BREW", x + w / 2, y + 19);
  ctx.fillStyle = "#888";
  for (let b = 0; b < 3; b++) { rr(ctx, x + 3 + b * 7, y + 28, 5, 5, 1); ctx.fill(); }
  ctx.strokeStyle = "#808090"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 4, y + h - 16); ctx.lineTo(x + 2, y + h - 8); ctx.stroke();
  ctx.fillStyle = "#4a4a5a"; ctx.fillRect(x + w / 2 - 4, y + h - 16, 8, 3); ctx.fillRect(x + w / 2 - 3, y + h - 13, 6, 5);
  ctx.fillStyle = "#f0ece0"; rr(ctx, x + w / 2 - 5, y + h - 8, 10, 8, 1); ctx.fill();
  ctx.fillStyle = "#6a3000"; ctx.fillRect(x + w / 2 - 4, y + h - 6, 8, 3);
  // Steam
  const ta = Date.now() * 0.001;
  ctx.strokeStyle = `rgba(255,255,255,${0.15 + Math.sin(ta * 3) * 0.08})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + h - 8); ctx.bezierCurveTo(x + w / 2 - 3, y + h - 14, x + w / 2 + 3, y + h - 20, x + w / 2, y + h - 26); ctx.stroke();
}

/** Whiteboard: 2×1 tiles */
function drawWhiteboard(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE, w = TILE * 2, h = TILE;
  ctx.fillStyle = "#1a1a2a"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#eaeaf4"; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = "#1060c0"; ctx.fillRect(x + 6, y + 7, 22, 2);
  ctx.fillStyle = "#c01020"; ctx.fillRect(x + 6, y + 12, 16, 2);
  ctx.fillStyle = "#108030"; ctx.fillRect(x + 6, y + 17, 26, 2);
  ctx.fillStyle = "#c03030"; ctx.beginPath(); ctx.arc(x + 5, y + 5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3060c0"; ctx.beginPath(); ctx.arc(x + w - 5, y + 5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#6a6a80"; ctx.fillRect(x + 3, y + h - 5, w - 6, 3);
  ctx.fillStyle = "#c03030"; ctx.fillRect(x + 5, y + h - 5, 3, 3);
  ctx.fillStyle = "#1060c0"; ctx.fillRect(x + 9, y + h - 5, 3, 3);
  ctx.fillStyle = "#108030"; ctx.fillRect(x + 13, y + h - 5, 3, 3);
}

/** Clock: 1×1 tile (shows real time) */
function drawClock(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const cx = col * TILE + TILE / 2, cy = row * TILE + TILE / 2, r = TILE / 2 - 2;
  ctx.fillStyle = "#1a1820"; ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f8f4e8"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1a1820";
  for (let m = 0; m < 12; m++) {
    const a = (m / 12) * Math.PI * 2 - Math.PI / 2;
    const ir = m % 3 === 0 ? r - 5 : r - 3;
    ctx.fillRect(cx + Math.cos(a) * ir - 0.5, cy + Math.sin(a) * ir - 0.5, m % 3 === 0 ? 2 : 1, m % 3 === 0 ? 2 : 1);
  }
  const now = new Date();
  const hrs = now.getHours() % 12 + now.getMinutes() / 60;
  const min = now.getMinutes() + now.getSeconds() / 60;
  const sec = now.getSeconds();
  ctx.strokeStyle = "#1a1820"; ctx.lineWidth = 2;
  const ha = (hrs / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * (r - 7), cy + Math.sin(ha) * (r - 7)); ctx.stroke();
  ctx.lineWidth = 1.5;
  const ma = (min / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma) * (r - 4), cy + Math.sin(ma) * (r - 4)); ctx.stroke();
  ctx.strokeStyle = "#c03030"; ctx.lineWidth = 1;
  const sa = (sec / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sa) * (r - 3), cy + Math.sin(sa) * (r - 3)); ctx.stroke();
  ctx.fillStyle = "#c03030"; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
}

/** Decorative rug: 2×2 tiles */
function drawRug(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE, w = TILE * 2, h = TILE * 2;
  ctx.fillStyle = "#3a2060"; rr(ctx, x + 2, y + 2, w - 4, h - 4, 6); ctx.fill();
  ctx.strokeStyle = "#5a40a0"; ctx.lineWidth = 2; rr(ctx, x + 4, y + 4, w - 8, h - 8, 4); ctx.stroke();
  ctx.fillStyle = "#7050c0"; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3a2060"; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c0a0ff"; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 4, 0, Math.PI * 2); ctx.fill();
  [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]].forEach(([px, py]) => {
    ctx.fillStyle = "#7050c0"; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
  });
}

/** Coffee table (small): 2×1 tiles */
function drawCoffeeTable(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  ctx.fillStyle = P.tableW; rr(ctx, x + 4, y + 4, TILE * 2 - 8, TILE - 8, 3); ctx.fill();
  ctx.fillStyle = P.tableWhi; ctx.fillRect(x + 6, y + 6, TILE * 2 - 12, 3);
  ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(x + 4, y + TILE - 4, TILE * 2 - 8, 4);
}

/** Square conference table: 3×3 tiles */
function drawSquareTable(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const x = col * TILE, y = row * TILE;
  const w = TILE * 3, h = TILE * 3;
  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x + 5, y + h, w - 5, 6); ctx.fillRect(x + w, y + 5, 6, h - 5);
  // Table surface
  ctx.fillStyle = P.tableW; rr(ctx, x + 3, y + 3, w - 6, h - 6, 8); ctx.fill();
  // Wood grain lines
  ctx.strokeStyle = "rgba(60,30,0,0.18)"; ctx.lineWidth = 1;
  for (let g = 8; g < w - 8; g += 9) {
    ctx.beginPath(); ctx.moveTo(x + g, y + 6); ctx.lineTo(x + g + 5, y + h - 6); ctx.stroke();
  }
  // Inner border highlight
  ctx.strokeStyle = P.tableWhi; ctx.lineWidth = 1.5;
  rr(ctx, x + 7, y + 7, w - 14, h - 14, 5); ctx.stroke();
  // Top gloss
  ctx.fillStyle = "rgba(255,255,255,0.07)"; rr(ctx, x + 9, y + 9, w - 18, (h - 18) * 0.28, 4); ctx.fill();
  // Bottom edge shadow
  ctx.fillStyle = P.tableSh; ctx.fillRect(x + 7, y + h - 9, w - 14, 4);
  // Center logo + corner dots
  ctx.fillStyle = "rgba(200,140,60,0.3)"; ctx.font = "bold 9px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("OCTONFY", x + w / 2, y + h / 2);
  [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]].forEach(([px, py]) => {
    ctx.fillStyle = "rgba(160,100,40,0.25)"; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
  });
}

/* ─── ROTATION HELPERS ────────────────────────────────────────── */
function getRotatedSize(type: FurnitureType, rotation: number): [number, number] {
  const [w, h] = ITEM_SIZES[type] ?? [1, 1];
  return rotation % 2 === 1 ? [h, w] : [w, h];
}

function dispatchDraw(ctx: CanvasRenderingContext2D, type: FurnitureType, col: number, row: number) {
  switch (type) {
    case "desk":           drawDesk(ctx, col, row); break;
    case "chair":          drawChair(ctx, col, row); break;
    case "plant":          drawPlant(ctx, col, row); break;
    case "plant_small":    drawSmallPlant(ctx, col, row); break;
    case "cactus":         drawCactus(ctx, col, row); break;
    case "snake_plant":    drawSnakePlant(ctx, col, row); break;
    case "bookshelf":      drawBookshelf(ctx, col, row); break;
    case "tv":             drawTV(ctx, col, row); break;
    case "couch":          drawCouch(ctx, col, row); break;
    case "coffee_table":   drawCoffeeTable(ctx, col, row); break;
    case "coffee_machine": drawCoffeeMachine(ctx, col, row); break;
    case "whiteboard":     drawWhiteboard(ctx, col, row); break;
    case "clock":          drawClock(ctx, col, row); break;
    case "rug":            drawRug(ctx, col, row); break;
    case "poster": {
      ctx.fillStyle = "#1a1a2e"; ctx.fillRect(col*TILE+2, row*TILE+2, TILE-4, TILE-4);
      ctx.fillStyle = "#2a3060"; ctx.fillRect(col*TILE+4, row*TILE+4, TILE-8, TILE-8);
      ctx.fillStyle = "#6060c0"; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🤖", col*TILE+TILE/2, row*TILE+TILE/2); break;
    }
    case "wall_h": {
      // Horizontal brick wall — fills the full tile height for a proper wall segment
      const wx = col*TILE, wy = row*TILE, ww = TILE*2, wh = TILE;
      // Base
      ctx.fillStyle = "#1e1c30"; ctx.fillRect(wx, wy, ww, wh);
      // Brick rows (alternating offset)
      const bH = 9, mortar = 2, bW = TILE - 2;
      for (let ri = 0; ri * (bH + mortar) < wh; ri++) {
        const by = wy + ri * (bH + mortar);
        const offset = ri % 2 === 0 ? 0 : bW / 2;
        for (let bx2 = -offset; bx2 < ww; bx2 += bW + mortar) {
          const bx = wx + bx2;
          const bClipX = Math.max(bx, wx);
          const bClipW = Math.min(bW, wx + ww - bClipX);
          if (bClipW <= 2) continue;
          ctx.fillStyle = ri % 2 === 0 ? "#38304e" : "#302848";
          ctx.fillRect(bClipX, by, bClipW, Math.min(bH, wy + wh - by));
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(bClipX, by, bClipW, 2);
        }
      }
      // Top cap highlight
      ctx.fillStyle = "#5a5090"; ctx.fillRect(wx, wy, ww, 2);
      // Bottom shadow
      ctx.fillStyle = "#110e20"; ctx.fillRect(wx, wy + wh - 2, ww, 2);
      // Side shadow
      ctx.fillStyle = "#110e20"; ctx.fillRect(wx + ww - 2, wy, 2, wh);
      break;
    }
    case "wall_v": {
      // Vertical brick wall
      const vx = col*TILE, vy = row*TILE, vw = TILE, vh = TILE*2;
      ctx.fillStyle = "#1e1c30"; ctx.fillRect(vx, vy, vw, vh);
      const bW2 = 9, mortar2 = 2, bH2 = TILE - 2;
      for (let ci = 0; ci * (bW2 + mortar2) < vw; ci++) {
        const bx3 = vx + ci * (bW2 + mortar2);
        const offset = ci % 2 === 0 ? 0 : bH2 / 2;
        for (let by3 = -offset; by3 < vh; by3 += bH2 + mortar2) {
          const by = vy + by3;
          const bClipY = Math.max(by, vy);
          const bClipH = Math.min(bH2, vy + vh - bClipY);
          if (bClipH <= 2) continue;
          ctx.fillStyle = ci % 2 === 0 ? "#38304e" : "#302848";
          ctx.fillRect(bx3, bClipY, Math.min(bW2, vx + vw - bx3), bClipH);
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(bx3, bClipY, Math.min(bW2, vx + vw - bx3), 2);
        }
      }
      ctx.fillStyle = "#5a5090"; ctx.fillRect(vx, vy, 2, vh);
      ctx.fillStyle = "#110e20"; ctx.fillRect(vx + vw - 2, vy, 2, vh);
      ctx.fillStyle = "#110e20"; ctx.fillRect(vx, vy + vh - 2, vw, 2);
      break;
    }
    case "door":          drawDoor(ctx, col, row); break;
    case "meeting_table": drawMeetingTableAt(ctx, col, row); break;
    case "table_square":  drawSquareTable(ctx, col, row); break;
  }
}

/** Draw a placed item with optional rotation (0=0°,1=90°CW,2=180°,3=270°CW) */
function drawPlacedItem(ctx: CanvasRenderingContext2D, item: PlacedItem) {
  const { type, col, row, rotation = 0 } = item;
  if (rotation === 0) { dispatchDraw(ctx, type, col, row); return; }

  const [origW, origH] = ITEM_SIZES[type] ?? [1, 1];
  const [rw, rh] = getRotatedSize(type, rotation);

  // Rotate around the centre of the rotated bounding box
  const pivotX = col * TILE + rw * TILE / 2;
  const pivotY = row * TILE + rh * TILE / 2;
  const origCX = col * TILE + origW * TILE / 2;
  const origCY = row * TILE + origH * TILE / 2;

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(rotation * Math.PI / 2);
  ctx.translate(-origCX, -origCY);
  dispatchDraw(ctx, type, col, row);
  ctx.restore();
}

/* ─── FULL OFFICE BACKGROUND ─────────────────────────────────── */
interface FloorColors { workA:string; workB:string; meetA:string; meetB:string; breakA:string; breakB:string; }
interface CustomZoneColors { work: string | null; meet: string | null; break: string | null; }

function drawOffice(
  ctx: CanvasRenderingContext2D,
  placedItems: PlacedItem[],
  fc: FloorColors,
  movingItemId: string | null = null,
  hoverTile: { col: number; row: number } = { col: -1, row: -1 },
  customColors: CustomZoneColors | null = null,
) {
  // ── Floors — custom color overrides preset theme ──────────────────
  const wA = customColors?.work  ? customColors.work  : fc.workA;
  const wB = customColors?.work  ? darkenHex(customColors.work, 0.14)  : fc.workB;
  const mA = customColors?.meet  ? customColors.meet  : fc.meetA;
  const mB = customColors?.meet  ? darkenHex(customColors.meet, 0.14)  : fc.meetB;
  const bA = customColors?.break ? customColors.break : fc.breakA;
  const bB = customColors?.break ? darkenHex(customColors.break, 0.14) : fc.breakB;
  fillCheckerboard(ctx, 0, TILE, WORK_W, CANVAS_H - TILE, wA, wB);
  fillCheckerboard(ctx, MEET_X, TILE, CANVAS_W - MEET_X, BREAK_Y - TILE, mA, mB);
  fillCheckerboard(ctx, MEET_X, BREAK_Y, CANVAS_W - MEET_X, CANVAS_H - BREAK_Y, bA, bB);

  // ── Structural walls ──────────────────────────────────────────────
  ctx.fillStyle = P.wall; ctx.fillRect(0, 0, CANVAS_W, TILE);
  ctx.fillStyle = P.wallAccent; ctx.fillRect(MEET_X, 0, CANVAS_W - MEET_X, 4);
  ctx.fillStyle = P.wall; ctx.fillRect(MEET_X - TILE, 0, TILE, CANVAS_H);
  ctx.fillStyle = P.wallHi; ctx.fillRect(MEET_X - 4, 0, 4, CANVAS_H);
  ctx.fillRect(MEET_X, BREAK_Y - 8, CANVAS_W - MEET_X, 8);

  // ── Furniture — walkable (rugs/etc) drawn first, solid items on top ──
  for (const item of placedItems) {
    if (item.id === movingItemId) continue;           // skip — will draw as ghost
    if (WALKABLE_ITEM_TYPES.has(item.type)) drawPlacedItem(ctx, item);
  }
  for (const item of placedItems) {
    if (item.id === movingItemId) continue;
    if (!WALKABLE_ITEM_TYPES.has(item.type)) drawPlacedItem(ctx, item);
  }

  // ── Ghost for item being moved ────────────────────────────────────
  if (movingItemId && hoverTile.col >= 0 && hoverTile.row >= 0) {
    const ghost = placedItems.find(i => i.id === movingItemId);
    if (ghost) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawPlacedItem(ctx, { ...ghost, col: hoverTile.col, row: hoverTile.row });
      ctx.restore();
      // Highlight footprint border
      const [origW, origH] = ITEM_SIZES[ghost.type] ?? [1, 1];
      const rot = ghost.rotation ?? 0;
      const gw = rot % 2 === 1 ? origH : origW;
      const gh2 = rot % 2 === 1 ? origW : origH;
      ctx.strokeStyle = "rgba(80,220,255,0.8)"; ctx.lineWidth = 2;
      ctx.strokeRect(hoverTile.col * TILE, hoverTile.row * TILE, gw * TILE, gh2 * TILE);
    }
  }

  // ── Zone labels ───────────────────────────────────────────────────
  ctx.font = "bold 9px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(220,170,80,0.4)"; ctx.fillText("ÁREA DE TRABALHO", 4, TILE + 4);
  ctx.fillStyle = "rgba(100,140,255,0.45)"; ctx.fillText("SALA DE REUNIÃO", MEET_X + 4, TILE + 4);
  ctx.fillStyle = "rgba(60,200,100,0.45)"; ctx.fillText("ÁREA DE DESCANSO", MEET_X + 4, BREAK_Y + 4);
}

/* ─── CHARACTER STATE MACHINE ─────────────────────────────────── */
const DIR  = { DOWN: 0, UP: 1, RIGHT: 2, LEFT: 3 } as const;
type Dir   = (typeof DIR)[keyof typeof DIR];
const ST   = { TYPE: "type", WALK: "walk", IDLE: "idle" } as const;
type State = (typeof ST)[keyof typeof ST];

const WALK_SPD       = 80;
const WALK_FRAME_DUR = 0.15;
const TYPE_FRAME_DUR = 0.3;
const WANDER_MIN     = 3.0;
const WANDER_MAX     = 10.0;
const TYPING_CHARS   = ["{}", "</>", "fn()", "01", "=>", "[]", "...", "npm", "git"];

interface Char {
  id: string; state: State; dir: Dir;
  x: number; y: number; tileCol: number; tileRow: number;
  path: Array<{ col: number; row: number }>; moveProgress: number;
  frame: number; frameTimer: number;
  wanderTimer: number; wanderCount: number;
  isActive: boolean; inMeeting: boolean; isOffline: boolean;
  seatIdx: number; typingChar: string; typingAlpha: number;
  atLounge: boolean;
}

function tc(col: number, row: number) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function createChar(id: string, seatIdx: number): Char {
  const s = DESK_SEATS[seatIdx % DESK_SEATS.length];
  const { x, y } = tc(s.col, s.row);
  return {
    id, state: ST.TYPE, dir: DIR.DOWN, x, y,
    tileCol: s.col, tileRow: s.row,
    path: [], moveProgress: 0, frame: 0, frameTimer: 0,
    wanderTimer: 2 + Math.random() * 5, wanderCount: 0,
    isActive: true, inMeeting: false, isOffline: false,
    seatIdx, typingChar: "{}", typingAlpha: 0, atLounge: false,
  };
}

function startWalk(ch: Char, tc2: number, tr: number, map: number[][]): void {
  if (ch.tileCol === tc2 && ch.tileRow === tr) { ch.path = []; return; }
  const p = findPath(ch.tileCol, ch.tileRow, tc2, tr, map);
  if (p.length > 0) { ch.path = p; ch.moveProgress = 0; ch.state = ST.WALK; ch.frame = 0; ch.frameTimer = 0; }
}

function updateChar(ch: Char, dt: number, map: number[][], walkable: Array<{ col: number; row: number }>): void {
  const ds = DESK_SEATS[ch.seatIdx % DESK_SEATS.length];
  const ms = MEETING_SEATS[ch.seatIdx % MEETING_SEATS.length];
  const ls = LOUNGE_SEATS[ch.seatIdx % LOUNGE_SEATS.length];
  ch.frameTimer += dt;

  switch (ch.state) {
    case ST.TYPE: {
      if (ch.frameTimer >= TYPE_FRAME_DUR) {
        ch.frameTimer -= TYPE_FRAME_DUR; ch.frame = (ch.frame + 1) % 2;
        if (Math.random() > 0.85) ch.typingChar = TYPING_CHARS[Math.floor(Math.random() * TYPING_CHARS.length)];
      }
      ch.typingAlpha = Math.min(1, ch.typingAlpha + dt * 2);
      if (ch.inMeeting && (ch.tileCol !== ms.col || ch.tileRow !== ms.row)) startWalk(ch, ms.col, ms.row, map);
      else if (!ch.isActive && !ch.isOffline) {
        ch.state = ST.IDLE; ch.wanderTimer = 1 + Math.random() * 3; ch.typingAlpha = 0; ch.frame = 0; ch.frameTimer = 0; ch.atLounge = false;
      } else if ((ch.isActive || ch.isOffline) && (ch.tileCol !== ds.col || ch.tileRow !== ds.row)) startWalk(ch, ds.col, ds.row, map);
      break;
    }
    case ST.IDLE: {
      ch.frame = 0; ch.typingAlpha = Math.max(0, ch.typingAlpha - dt * 3);
      if (ch.inMeeting) { startWalk(ch, ms.col, ms.row, map); ch.atLounge = false; break; }
      if (ch.isActive || ch.isOffline) { startWalk(ch, ds.col, ds.row, map); ch.atLounge = false; break; }
      // Inactive: go to TV lounge seat
      if (!ch.atLounge) {
        startWalk(ch, ls.col, ls.row, map);
        ch.atLounge = true; break;
      }
      // At lounge: occasionally do a small break wander
      ch.wanderTimer -= dt;
      if (ch.wanderTimer <= 0) {
        ch.wanderTimer = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
        if (ch.wanderCount < 2 && Math.random() < 0.35) {
          const brkTiles = walkable.filter(t => t.col >= MEET_X / TILE && t.row >= BREAK_Y / TILE);
          if (brkTiles.length > 0) { startWalk(ch, brkTiles[Math.floor(Math.random() * brkTiles.length)].col, brkTiles[Math.floor(Math.random() * brkTiles.length)].row, map); ch.wanderCount++; }
        } else { startWalk(ch, ls.col, ls.row, map); ch.wanderCount = 0; }
      }
      break;
    }
    case ST.WALK: {
      if (ch.frameTimer >= WALK_FRAME_DUR) { ch.frameTimer -= WALK_FRAME_DUR; ch.frame = (ch.frame + 1) % 4; }
      if (ch.path.length === 0) {
        const { x, y } = tc(ch.tileCol, ch.tileRow); ch.x = x; ch.y = y;
        const atD = ch.tileCol === ds.col && ch.tileRow === ds.row;
        const atM = ch.tileCol === ms.col && ch.tileRow === ms.row;
        const atL = ch.tileCol === ls.col && ch.tileRow === ls.row;
        if (ch.inMeeting && atM) { ch.state = ST.TYPE; ch.dir = ms.dir as Dir; }
        else if ((ch.isActive || ch.isOffline) && atD) { ch.state = ST.TYPE; ch.dir = DIR.DOWN; }
        else if (!ch.isActive && !ch.isOffline && atL) { ch.state = ST.IDLE; ch.dir = DIR.UP; }
        else { ch.state = ST.IDLE; ch.wanderTimer = 1 + Math.random() * 3; }
        ch.frame = 0; ch.frameTimer = 0; break;
      }
      const nx = ch.path[0];
      const dc = nx.col - ch.tileCol, dr = nx.row - ch.tileRow;
      if (dc > 0) ch.dir = DIR.RIGHT; else if (dc < 0) ch.dir = DIR.LEFT;
      else if (dr > 0) ch.dir = DIR.DOWN; else ch.dir = DIR.UP;
      ch.moveProgress += (WALK_SPD / TILE) * dt;
      const fr = tc(ch.tileCol, ch.tileRow), to = tc(nx.col, nx.row);
      const t2 = Math.min(ch.moveProgress, 1);
      ch.x = fr.x + (to.x - fr.x) * t2; ch.y = fr.y + (to.y - fr.y) * t2;
      if (ch.moveProgress >= 1) { ch.tileCol = nx.col; ch.tileRow = nx.row; ch.x = to.x; ch.y = to.y; ch.moveProgress = 0; ch.path.shift(); }
      if (ch.inMeeting) { const l = ch.path[ch.path.length - 1]; if (!l || l.col !== ms.col || l.row !== ms.row) startWalk(ch, ms.col, ms.row, map); }
      else if (ch.isActive || ch.isOffline) { const l = ch.path[ch.path.length - 1]; if (!l || l.col !== ds.col || l.row !== ds.row) startWalk(ch, ds.col, ds.row, map); }
      break;
    }
  }
}

/* ─── ASSET LOADER ────────────────────────────────────────────── */
function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = url;
  });
}

/* ─── CHARACTER SPRITE RENDERER ──────────────────────────────── */
function getFrameIdx(ch: Char): number {
  if (ch.state === ST.WALK) return WALK_CYCLE[ch.frame % 4];
  if (ch.state === ST.TYPE) return 3 + (ch.frame % 2);
  return 0;
}

const FALLBACK_COLORS = ["#6366f1", "#f59e0b", "#22c55e", "#ef4444", "#a855f7", "#06b6d4"];

function drawChar(ctx: CanvasRenderingContext2D, ch: Char, charImg: HTMLImageElement | null, agent: Agent, selected: boolean) {
  const status = agent.status ?? "idle";
  const dx = Math.round(ch.x - CHAR_DW / 2);
  const dy = Math.round(ch.y - CHAR_DH);

  if (selected) {
    ctx.save(); ctx.strokeStyle = agent.avatar_color ?? "#6366f1"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ch.x, ch.y + 2, CHAR_DW / 2 + 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(ch.x, ch.y + 4, CHAR_DW / 2 + 3, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  ctx.save(); ctx.globalAlpha = ch.isOffline ? 0.4 : 1.0;
  if (charImg) {
    const fi = getFrameIdx(ch), isL = ch.dir === DIR.LEFT;
    const row = ch.dir === DIR.DOWN ? 0 : ch.dir === DIR.UP ? 1 : 2;
    const sx = fi * SRC_W, sy = row * SRC_H;
    if (isL) { ctx.translate(dx + CHAR_DW, 0); ctx.scale(-1, 1); ctx.drawImage(charImg, sx, sy, SRC_W, SRC_H, 0, dy, CHAR_DW, CHAR_DH); }
    else { ctx.drawImage(charImg, sx, sy, SRC_W, SRC_H, dx, dy, CHAR_DW, CHAR_DH); }
  } else {
    const fc = FALLBACK_COLORS[ch.seatIdx % FALLBACK_COLORS.length];
    ctx.fillStyle = fc; ctx.fillRect(dx + 4, dy + 8, CHAR_DW - 8, CHAR_DH - 8);
    ctx.fillStyle = "#f5c5a3"; ctx.beginPath(); ctx.arc(ch.x, dy + 10, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Name label
  ctx.save(); ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  const lbl = agent.name.split(" ")[0], tw = ctx.measureText(lbl).width;
  ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(ch.x - tw / 2 - 3, dy - 15, tw + 6, 13);
  ctx.fillStyle = "#fff"; ctx.fillText(lbl, ch.x, dy - 2); ctx.restore();

  // Status dot
  const sc: Record<string, string> = {
    working: P.working, thinking: P.thinking, in_meeting: P.meeting,
    messaging: P.messaging, idle: P.idle, offline: P.offline,
  };
  ctx.fillStyle = sc[status] ?? P.idle;
  ctx.beginPath(); ctx.arc(dx + CHAR_DW + 4, dy + 4, 4, 0, Math.PI * 2); ctx.fill();

  // Typing text
  if (ch.isActive && ch.typingAlpha > 0.05) {
    ctx.save(); ctx.globalAlpha = ch.typingAlpha * 0.9; ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#8ec4ff"; ctx.textAlign = "center"; ctx.fillText(ch.typingChar, ch.x, dy - 24); ctx.restore();
  }

  // Thought bubble
  if (status === "thinking") {
    const bx = dx + CHAR_DW + 6, by = dy + 4;
    ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath(); ctx.arc(bx + 11, by - 4, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3b82f6"; ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", bx + 11, by - 4);
    [0, 1, 2].forEach(d => { ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(bx + d * 5, by + 9 + d * 4, 2.2 - d * 0.3, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  // Idle "watching TV" indicator
  if (status === "idle" && ch.atLounge) {
    ctx.save(); ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("📺", ch.x, dy - 20); ctx.restore();
  }
}

/* ─── EDITOR OVERLAY ──────────────────────────────────────────── */
function drawEditorOverlay(ctx: CanvasRenderingContext2D, hoverCol: number, hoverRow: number, hasSelectedTool: boolean) {
  // Dim overlay
  ctx.fillStyle = "rgba(0,0,20,0.25)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Grid highlight
  ctx.strokeStyle = "rgba(100,100,255,0.3)";
  ctx.lineWidth = 1;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      ctx.strokeRect(c * TILE, r * TILE, TILE, TILE);
    }
  }
  // Hovered tile
  if (hoverCol >= 0 && hoverRow >= 0 && hasSelectedTool) {
    ctx.fillStyle = "rgba(100,200,255,0.25)";
    ctx.fillRect(hoverCol * TILE, hoverRow * TILE, TILE, TILE);
    ctx.strokeStyle = "rgba(100,200,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(hoverCol * TILE, hoverRow * TILE, TILE, TILE);
  }
}

/* ─── PROPS ───────────────────────────────────────────────────── */
interface OfficeCanvasProps {
  agents:              Agent[];
  onAgentClick:        (agent: Agent, pos: { x: number; y: number }) => void;
  selectedAgentId:     string | null;
  meetingParticipants: string[];
  containerWidth:      number;
  containerHeight:     number;
  placedItems?:        PlacedItem[];
  editorMode?:         boolean;
  selectedTool?:       FurnitureType | null;
  onTileClick?:        (col: number, row: number) => void;
  onPlacedItemClick?:  (item: PlacedItem, screenX: number, screenY: number) => void;
  floorTheme?:         FloorTheme;
  movingItemId?:       string | null;
  onMoveItem?:         (id: string, col: number, row: number) => void;
  customFloorColors?:  { work: string | null; meet: string | null; break: string | null } | null;
}

/* ─── DYNAMIC TILE MAP (placed items block pathfinding) ───────── */
function buildDynamicMap(base: number[][], items: PlacedItem[]): number[][] {
  const map = base.map(r => [...r]);
  for (const item of items) {
    if (WALKABLE_ITEM_TYPES.has(item.type)) continue;
    const [origW, origH] = ITEM_SIZES[item.type] ?? [1, 1];
    const rot = item.rotation ?? 0;
    const w = rot % 2 === 1 ? origH : origW;
    const h = rot % 2 === 1 ? origW : origH;
    for (let dc = 0; dc < w; dc++)
      for (let dr = 0; dr < h; dr++) {
        const c = item.col + dc, r = item.row + dr;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) map[r][c] = BLOCKED;
      }
  }
  // Always keep agent seat tiles walkable — agents must be able to reach their seats
  // even if a piece of furniture footprint overlaps the seat tile
  for (const s of DESK_SEATS)    map[s.row][s.col] = FLOOR;
  for (const s of MEETING_SEATS) map[s.row][s.col] = FLOOR;
  for (const s of LOUNGE_SEATS)  map[s.row][s.col] = FLOOR;
  return map;
}

/* ─── COMPONENT ───────────────────────────────────────────────── */
export default function OfficeCanvas({
  agents, onAgentClick, selectedAgentId,
  meetingParticipants, containerWidth, containerHeight,
  placedItems = [], editorMode = false, selectedTool = null,
  onTileClick, onPlacedItemClick, floorTheme = "warm",
  movingItemId = null, onMoveItem, customFloorColors = null,
}: OfficeCanvasProps) {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const charsRef         = useRef<Map<string, Char>>(new Map());
  const agentsRef        = useRef(agents);
  const meetsRef         = useRef(meetingParticipants);
  const selRef           = useRef(selectedAgentId);
  const charImgsRef      = useRef<(HTMLImageElement | null)[]>([]);
  const baseTileMapRef   = useRef(buildTileMap());
  const dynMapRef        = useRef(baseTileMapRef.current);
  const walkRef          = useRef(getWalkableTiles(baseTileMapRef.current));
  const placedRef        = useRef(placedItems);
  const editorRef        = useRef(editorMode);
  const toolRef          = useRef(selectedTool);
  const themeRef         = useRef(floorTheme);
  const movingIdRef      = useRef(movingItemId);
  const customColorsRef  = useRef(customFloorColors);

  agentsRef.current     = agents;
  meetsRef.current      = meetingParticipants;
  selRef.current        = selectedAgentId;
  placedRef.current     = placedItems;
  editorRef.current     = editorMode;
  toolRef.current       = selectedTool;
  themeRef.current      = floorTheme;
  movingIdRef.current   = movingItemId;
  customColorsRef.current = customFloorColors;

  const [hoverTile, setHoverTile] = useState({ col: -1, row: -1 });

  // Rebuild dynamic tileMap + walkable list when placed items change
  useEffect(() => {
    const dyn = buildDynamicMap(baseTileMapRef.current, placedItems);
    dynMapRef.current  = dyn;
    walkRef.current    = getWalkableTiles(dyn);
  }, [placedItems]);

  // Character init/cleanup
  useEffect(() => {
    agents.forEach((a, i) => { if (!charsRef.current.has(a.id)) charsRef.current.set(a.id, createChar(a.id, i)); });
    for (const id of charsRef.current.keys()) if (!agents.find(a => a.id === id)) charsRef.current.delete(id);
  }, [agents]);

  // Load char PNGs
  useEffect(() => { Promise.all(CHAR_URLS.map(loadImg)).then(imgs => { charImgsRef.current = imgs; }); }, []);

  // Canvas pixel coords → tile coords
  const getCanvasTile = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * sx, py = (e.clientY - rect.top) * sy;
    return { col: Math.floor(px / TILE), row: Math.floor(py / TILE), px, py, screenX: e.clientX, screenY: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editorRef.current) return;
    const t = getCanvasTile(e);
    if (t) setHoverTile({ col: t.col, row: t.row });
  }, [getCanvasTile]);

  const handleMouseLeave = useCallback(() => setHoverTile({ col: -1, row: -1 }), []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const t = getCanvasTile(e); if (!t) return;

    if (editorRef.current) {
      // Move mode: clicking any tile moves the dragged item there
      if (movingIdRef.current && onMoveItem) {
        onMoveItem(movingIdRef.current, t.col, t.row);
        return;
      }
      if (toolRef.current && onTileClick) { onTileClick(t.col, t.row); return; }
      // No tool selected: check if clicking an existing placed item
      if (!toolRef.current && onPlacedItemClick) {
        const hit = placedRef.current.find(item => {
          const [origW, origH] = ITEM_SIZES[item.type] ?? [1, 1];
          const rot = item.rotation ?? 0;
          const w = rot % 2 === 1 ? origH : origW;
          const h = rot % 2 === 1 ? origW : origH;
          return t.col >= item.col && t.col < item.col + w && t.row >= item.row && t.row < item.row + h;
        });
        if (hit) { onPlacedItemClick(hit, t.screenX, t.screenY); return; }
      }
      return;
    }
    // Normal mode: agent click hit-test
    for (const [id, ch] of charsRef.current) {
      if (t.px >= ch.x - CHAR_DW / 2 && t.px <= ch.x + CHAR_DW / 2 && t.py >= ch.y - CHAR_DH && t.py <= ch.y) {
        const ag = agentsRef.current.find(a => a.id === id);
        if (ag) { onAgentClick(ag, { x: e.clientX, y: e.clientY }); return; }
      }
    }
  }, [getCanvasTile, onAgentClick, onTileClick, onPlacedItemClick]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;

    const stop = startGameLoop(canvas, {
      update(dt) {
        const meets = meetsRef.current;
        const map  = dynMapRef.current;
        const walk = walkRef.current;
        for (const [id, ch] of charsRef.current) {
          const ag = agentsRef.current.find(a => a.id === id); if (!ag) continue;
          const st = ag.status ?? "idle";
          ch.isActive  = (st === "working" || st === "thinking") && !meets.includes(id);
          ch.inMeeting = meets.includes(id) || st === "in_meeting";
          ch.isOffline = !ag.is_active || st === "offline";
          updateChar(ch, dt, map, walk);
        }
      },
      render(ctx) {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        const fc = FLOOR_THEMES[themeRef.current] ?? FLOOR_THEMES.warm;
        drawOffice(ctx, placedRef.current, fc, movingIdRef.current, hoverTile, customColorsRef.current);
        if (editorRef.current) drawEditorOverlay(ctx, hoverTile.col, hoverTile.row, !!toolRef.current || !!movingIdRef.current);
        const sorted = [...charsRef.current.values()].sort((a, b) => a.y - b.y);
        for (const ch of sorted) {
          const ag = agentsRef.current.find(a => a.id === ch.id); if (!ag) continue;
          const img = charImgsRef.current[ch.seatIdx % CHAR_URLS.length] ?? null;
          drawChar(ctx, ch, img, ag, selRef.current === ch.id);
        }
      },
    });
    return stop;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverTile]);

  // Scale canvas to fill the container HEIGHT fully (may scroll horizontally).
  // This ensures the office content is always rendered at its intended size rather
  // than being shrunk to fit the width, giving users a bigger, game-like view.
  const scale = containerHeight > 0
    ? Math.max(containerHeight / CANVAS_H, 0.85)   // min 85% size on very short screens
    : 1;
  const displayW = Math.round(CANVAS_W * scale);
  const displayH = Math.round(CANVAS_H * scale);

  return (
    <div className="relative w-full h-full overflow-auto flex items-start justify-start" style={{ background: "#1a1830" }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={
          movingItemId ? "cursor-grab" :
          editorMode && selectedTool ? "cursor-crosshair" :
          editorMode ? "cursor-default" : "cursor-pointer"
        }
        style={{
          imageRendering: "pixelated",
          width:  displayW,
          height: displayH,
          flexShrink: 0,
        }}
      />

      {/* Status legend */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 text-[10px] font-mono
                      bg-black/65 rounded-lg px-3 py-2 border border-white/10 pointer-events-none">
        {([
          [P.working, "Trabalhando"], [P.thinking, "Pensando"],
          [P.meeting, "Em reunião"], [P.messaging, "Mensagens"],
          [P.idle, "Descansando"], [P.offline, "Offline"],
        ] as [string, string][]).map(([c, l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
            <span className="text-white/70">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
