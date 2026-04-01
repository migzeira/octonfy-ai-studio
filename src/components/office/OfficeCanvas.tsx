import { useRef, useEffect, useCallback } from "react";
import type { Agent } from "@/hooks/useRealtimeAgents";

// --- Layout constants ---
const WORLD_W = 1600;
const WORLD_H = 1000;

const WORK_AREA = { x: 40, y: 60, w: 1060, h: 600 };
const MEETING_AREA = { x: 1140, y: 60, w: 420, h: 380 };
const BREAK_AREA = { x: 1140, y: 480, w: 420, h: 460 };

// Desk positions (up to 8)
function getDeskPos(index: number) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: WORK_AREA.x + 60 + col * 250, y: WORK_AREA.y + 80 + row * 240 };
}

// Meeting chair positions (circle around center)
const MEETING_CENTER = { x: MEETING_AREA.x + 210, y: MEETING_AREA.y + 200 };
function getMeetingChairPos(index: number, total: number) {
  const angle = (2 * Math.PI / Math.max(total, 1)) * index - Math.PI / 2;
  return {
    x: MEETING_CENTER.x + Math.cos(angle) * 100,
    y: MEETING_CENTER.y + Math.sin(angle) * 50,
  };
}

// Keep exports for useAgentAnimations backward compat
export { getDeskPos, getMeetingChairPos };

// --- Sprite sheet constants ---
const SPRITE_SIZE = 64;
const DRAW_SIZE = 38; // render size on canvas
const FRAME_INTERVAL = 120; // ms between walk frames
const WANDER_INTERVAL = 2500; // ms between direction changes

// Sprite rows (y offsets)
const ROW_DOWN = 640;
const ROW_LEFT = 576;
const ROW_RIGHT = 704;
const WALK_FRAMES = 9;

// --- Agent internal state ---
interface AgentState {
  x: number;
  y: number;
  frameIndex: number;
  direction: "down" | "left" | "right";
  lastFrameTime: number;
  targetX: number;
  targetY: number;
  lastDirChange: number;
}

// Colors
const STATUS_COLORS: Record<string, string> = {
  working: "#22c55e",
  thinking: "#eab308",
  in_meeting: "#3b82f6",
  messaging: "#22c55e",
  idle: "#94a3b8",
  offline: "#4b5563",
};

const FLOOR_BG = "#0d0d14";
const WORK_FLOOR = "#1a1a2e";
const MEETING_FLOOR = "#0f3460";
const BREAK_FLOOR = "#1a1a2e";
const WALL_COLOR = "#533483";
const DESK_COLOR = "#16213e";
const MONITOR_COLOR = "#0ea5e9";
const CHAIR_COLOR = "#374151";
const SOFA_COLOR = "#4c1d95";
const PLANT_COLOR = "#22c55e";

interface OfficeCanvasProps {
  agents: Agent[];
  onAgentClick: (agent: Agent, pos: { x: number; y: number }) => void;
  selectedAgentId: string | null;
  meetingParticipants: string[];
  containerWidth: number;
  containerHeight: number;
}

export default function OfficeCanvas({
  agents,
  onAgentClick,
  selectedAgentId,
  meetingParticipants,
  containerWidth,
  containerHeight,
}: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const spriteLoadedRef = useRef(false);
  const agentStatesRef = useRef<Map<string, AgentState>>(new Map());
  const scaleRef = useRef(0.85);
  const panRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  // Load sprite sheet once
  useEffect(() => {
    const img = new Image();
    img.src = "/character-spritesheet.png";
    img.onload = () => {
      spriteRef.current = img;
      spriteLoadedRef.current = true;
    };
    return () => { img.onload = null; };
  }, []);

  // Resize canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = containerWidth;
    c.height = containerHeight;
  }, [containerWidth, containerHeight]);

  // Initialize / sync agent states
  useEffect(() => {
    const map = agentStatesRef.current;
    const now = performance.now();
    agents.forEach((agent, i) => {
      if (!map.has(agent.id)) {
        const dp = getDeskPos(i);
        map.set(agent.id, {
          x: dp.x + 60,
          y: dp.y - 10,
          frameIndex: 0,
          direction: "down",
          lastFrameTime: now,
          targetX: dp.x + 60,
          targetY: dp.y - 10,
          lastDirChange: now,
        });
      }
    });
    // Remove stale
    for (const id of map.keys()) {
      if (!agents.find((a) => a.id === id)) map.delete(id);
    }
  }, [agents]);

  // --- Drawing helpers ---
  const drawEnvironment = useCallback((ctx: CanvasRenderingContext2D) => {
    // Background
    ctx.fillStyle = FLOOR_BG;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Work area floor
    ctx.fillStyle = WORK_FLOOR;
    ctx.fillRect(WORK_AREA.x, WORK_AREA.y, WORK_AREA.w, WORK_AREA.h);

    // Meeting room floor
    ctx.fillStyle = MEETING_FLOOR;
    ctx.fillRect(MEETING_AREA.x, MEETING_AREA.y, MEETING_AREA.w, MEETING_AREA.h);

    // Break area floor
    ctx.fillStyle = BREAK_FLOOR;
    ctx.fillRect(BREAK_AREA.x, BREAK_AREA.y, BREAK_AREA.w, BREAK_AREA.h);

    // Walls
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(WORK_AREA.x, WORK_AREA.y, WORK_AREA.w, WORK_AREA.h);
    ctx.strokeRect(MEETING_AREA.x, MEETING_AREA.y, MEETING_AREA.w, MEETING_AREA.h);
    ctx.strokeRect(BREAK_AREA.x, BREAK_AREA.y, BREAK_AREA.w, BREAK_AREA.h);

    // Floor tiles pattern (work area)
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let tx = WORK_AREA.x; tx < WORK_AREA.x + WORK_AREA.w; tx += 40) {
      ctx.beginPath();
      ctx.moveTo(tx, WORK_AREA.y);
      ctx.lineTo(tx, WORK_AREA.y + WORK_AREA.h);
      ctx.stroke();
    }
    for (let ty = WORK_AREA.y; ty < WORK_AREA.y + WORK_AREA.h; ty += 40) {
      ctx.beginPath();
      ctx.moveTo(WORK_AREA.x, ty);
      ctx.lineTo(WORK_AREA.x + WORK_AREA.w, ty);
      ctx.stroke();
    }

    // Desks with monitors
    for (let i = 0; i < 8; i++) {
      const dp = getDeskPos(i);
      // Desk
      ctx.fillStyle = DESK_COLOR;
      ctx.fillRect(dp.x, dp.y, 120, 50);
      // Monitor
      ctx.fillStyle = "#111827";
      ctx.fillRect(dp.x + 35, dp.y - 25, 50, 30);
      ctx.fillStyle = MONITOR_COLOR;
      ctx.fillRect(dp.x + 38, dp.y - 22, 44, 24);
      // Monitor stand
      ctx.fillStyle = "#374151";
      ctx.fillRect(dp.x + 55, dp.y + 5, 10, 5);
      // Keyboard
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(dp.x + 40, dp.y + 15, 40, 8);
      // Chair
      ctx.fillStyle = CHAIR_COLOR;
      ctx.beginPath();
      ctx.arc(dp.x + 60, dp.y + 65, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Meeting room — oval table
    ctx.fillStyle = "#1e3a5f";
    ctx.beginPath();
    ctx.ellipse(MEETING_CENTER.x, MEETING_CENTER.y, 90, 45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Meeting chairs
    for (let i = 0; i < 6; i++) {
      const cp = getMeetingChairPos(i, 6);
      ctx.fillStyle = CHAIR_COLOR;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Break area — sofa
    ctx.fillStyle = SOFA_COLOR;
    const sofaX = BREAK_AREA.x + 40;
    const sofaY = BREAK_AREA.y + 60;
    ctx.fillRect(sofaX, sofaY, 120, 40);
    ctx.fillRect(sofaX - 10, sofaY - 5, 15, 50);
    ctx.fillRect(sofaX + 115, sofaY - 5, 15, 50);

    // Plants
    const plantPositions = [
      { x: BREAK_AREA.x + 300, y: BREAK_AREA.y + 40 },
      { x: BREAK_AREA.x + 350, y: BREAK_AREA.y + 120 },
      { x: WORK_AREA.x + 20, y: WORK_AREA.y + 20 },
    ];
    plantPositions.forEach(({ x, y }) => {
      // Pot
      ctx.fillStyle = "#92400e";
      ctx.fillRect(x - 8, y + 10, 16, 12);
      // Leaves
      ctx.fillStyle = PLANT_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#16a34a";
      ctx.beginPath();
      ctx.arc(x - 6, y - 4, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Coffee machine in break area
    const coffeeX = BREAK_AREA.x + 200;
    const coffeeY = BREAK_AREA.y + 50;
    ctx.fillStyle = "#374151";
    ctx.fillRect(coffeeX, coffeeY, 30, 40);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(coffeeX + 10, coffeeY + 5, 10, 5);

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "bold 14px Inter, sans-serif";
    ctx.fillText("WORK AREA", WORK_AREA.x + 20, WORK_AREA.y + 30);
    ctx.fillText("MEETING ROOM", MEETING_AREA.x + 20, MEETING_AREA.y + 30);
    ctx.fillText("BREAK AREA", BREAK_AREA.x + 20, BREAK_AREA.y + 30);
  }, []);

  // --- Main render loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (time: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const cw = canvas.width;
      const ch = canvas.height;
      if (cw === 0 || ch === 0) return;

      const scale = scaleRef.current;
      const pan = panRef.current;

      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);

      // Draw environment
      drawEnvironment(ctx);

      // Update & draw agents
      const img = spriteRef.current;
      const map = agentStatesRef.current;

      agents.forEach((agent, i) => {
        const st = map.get(agent.id);
        if (!st) return;

        const status = agent.status || "idle";
        const isOffline = status === "offline" || !agent.is_active;
        const inMeeting = meetingParticipants.includes(agent.id) || status === "in_meeting";

        // --- Update position & animation ---
        if (inMeeting) {
          const idx = meetingParticipants.indexOf(agent.id);
          const cp = getMeetingChairPos(idx >= 0 ? idx : i % 6, Math.max(meetingParticipants.length, 1));
          moveToward(st, cp.x - DRAW_SIZE / 2, cp.y - DRAW_SIZE / 2, 4);
          st.direction = "right";
          st.frameIndex = 0;
        } else if (status === "working" || status === "messaging") {
          const dp = getDeskPos(i);
          const seatX = dp.x + 45;
          const seatY = dp.y + 30;
          moveToward(st, seatX, seatY, 3);
          st.direction = "down";
          st.frameIndex = 0;
        } else if (status === "thinking") {
          const dp = getDeskPos(i);
          moveToward(st, dp.x + 45, dp.y + 30, 3);
          st.direction = "down";
          st.frameIndex = 0;
        } else if (isOffline) {
          st.frameIndex = 0;
          st.direction = "down";
        } else {
          // Idle — wander in break area
          if (time - st.lastDirChange > WANDER_INTERVAL || dist(st, st.targetX, st.targetY) < 5) {
            st.targetX = BREAK_AREA.x + 30 + Math.random() * (BREAK_AREA.w - 60);
            st.targetY = BREAK_AREA.y + 30 + Math.random() * (BREAK_AREA.h - 60);
            st.lastDirChange = time;
            // Pick direction based on movement
            const dx = st.targetX - st.x;
            const dy = st.targetY - st.y;
            if (Math.abs(dx) > Math.abs(dy)) {
              st.direction = dx > 0 ? "right" : "left";
            } else {
              st.direction = "down";
            }
          }
          const moved = moveToward(st, st.targetX, st.targetY, 1.5);
          if (moved && time - st.lastFrameTime > FRAME_INTERVAL) {
            st.frameIndex = (st.frameIndex + 1) % WALK_FRAMES;
            st.lastFrameTime = time;
          }
          if (!moved) st.frameIndex = 0;
        }

        // --- Draw sprite ---
        if (img && spriteLoadedRef.current) {
          const srcY = st.direction === "left" ? ROW_LEFT : st.direction === "right" ? ROW_RIGHT : ROW_DOWN;
          const srcX = st.frameIndex * SPRITE_SIZE;

          ctx.save();
          if (isOffline) ctx.globalAlpha = 0.4;

          ctx.drawImage(img, srcX, srcY, SPRITE_SIZE, SPRITE_SIZE, st.x, st.y, DRAW_SIZE, DRAW_SIZE);
          ctx.restore();
        } else {
          // Fallback circle if sprite not loaded
          ctx.fillStyle = agent.avatar_color || "#6366f1";
          ctx.beginPath();
          ctx.arc(st.x + DRAW_SIZE / 2, st.y + DRAW_SIZE / 2, 14, 0, Math.PI * 2);
          ctx.fill();
        }

        // --- Status indicator dot ---
        const dotColor = STATUS_COLORS[status] || STATUS_COLORS.idle;
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(st.x + DRAW_SIZE - 2, st.y + 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0d0d14";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // --- Name label ---
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(agent.name, st.x + DRAW_SIZE / 2, st.y + DRAW_SIZE + 12);
        ctx.textAlign = "left";

        // --- Status overlays ---
        if (status === "working" || status === "messaging") {
          ctx.font = "14px sans-serif";
          ctx.fillText("💻", st.x + DRAW_SIZE / 2 - 7, st.y - 6);
        } else if (status === "thinking") {
          // Thought bubble
          const dotIdx = Math.floor(time / 400) % 4;
          const dots = ".".repeat(dotIdx);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.beginPath();
          const bx = st.x + DRAW_SIZE / 2 + 10;
          const by = st.y - 12;
          roundRect(ctx, bx - 16, by - 12, 32, 18, 6);
          ctx.fill();
          ctx.fillStyle = "#111";
          ctx.font = "bold 11px monospace";
          ctx.textAlign = "center";
          ctx.fillText(dots || "...", bx, by);
          ctx.textAlign = "left";
          // Small bubble circles
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.beginPath();
          ctx.arc(st.x + DRAW_SIZE / 2 + 4, st.y - 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Selection highlight
        if (selectedAgentId === agent.id) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2;
          ctx.strokeRect(st.x - 2, st.y - 2, DRAW_SIZE + 4, DRAW_SIZE + 4);
        }
      });

      ctx.restore();

      // --- Mini-map ---
      drawMiniMap(ctx, cw, ch, scale, pan);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [agents, meetingParticipants, selectedAgentId, drawEnvironment, containerWidth, containerHeight]);

  // Mini-map
  const drawMiniMap = useCallback((ctx: CanvasRenderingContext2D, cw: number, ch: number, scale: number, pan: { x: number; y: number }) => {
    const mw = 160;
    const mh = 100;
    const mx = cw - mw - 12;
    const my = ch - mh - 12;
    const ms = mw / WORLD_W;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = "rgba(13,13,20,0.85)";
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = "#533483";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mw, mh);

    // Areas
    ctx.fillStyle = WORK_FLOOR;
    ctx.fillRect(mx + WORK_AREA.x * ms, my + WORK_AREA.y * (mh / WORLD_H), WORK_AREA.w * ms, WORK_AREA.h * (mh / WORLD_H));
    ctx.fillStyle = MEETING_FLOOR;
    ctx.fillRect(mx + MEETING_AREA.x * ms, my + MEETING_AREA.y * (mh / WORLD_H), MEETING_AREA.w * ms, MEETING_AREA.h * (mh / WORLD_H));
    ctx.fillStyle = BREAK_FLOOR;
    ctx.fillRect(mx + BREAK_AREA.x * ms, my + BREAK_AREA.y * (mh / WORLD_H), BREAK_AREA.w * ms, BREAK_AREA.h * (mh / WORLD_H));

    // Agent dots
    const map = agentStatesRef.current;
    agents.forEach((agent) => {
      const st = map.get(agent.id);
      if (!st) return;
      ctx.fillStyle = agent.avatar_color || "#6366f1";
      ctx.beginPath();
      ctx.arc(mx + st.x * ms, my + st.y * (mh / WORLD_H), 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Viewport rect
    const vx = (-pan.x / scale) * ms;
    const vy = (-pan.y / scale) * (mh / WORLD_H);
    const vw = (cw / scale) * ms;
    const vh = (ch / scale) * (mh / WORLD_H);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx + vx, my + vy, vw, vh);

    ctx.restore();
  }, [agents]);

  // --- Click handler ---
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = scaleRef.current;
    const pan = panRef.current;
    const worldX = (e.clientX - rect.left - pan.x) / scale;
    const worldY = (e.clientY - rect.top - pan.y) / scale;

    const map = agentStatesRef.current;
    for (const agent of agents) {
      const st = map.get(agent.id);
      if (!st) continue;
      const cx = st.x + DRAW_SIZE / 2;
      const cy = st.y + DRAW_SIZE / 2;
      if (Math.sqrt((worldX - cx) ** 2 + (worldY - cy) ** 2) < DRAW_SIZE) {
        onAgentClick(agent, { x: e.clientX - rect.left, y: e.clientY - rect.top });
        return;
      }
    }
  }, [agents, onAgentClick]);

  // --- Zoom via wheel ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    scaleRef.current = Math.max(0.3, Math.min(2, scaleRef.current + delta));
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: FLOOR_BG }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        width={containerWidth}
        height={containerHeight}
        onClick={handleClick}
        onWheel={handleWheel}
      />
      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex gap-1 z-10">
        <button
          className="w-8 h-8 rounded bg-[#1e1e2e] text-white flex items-center justify-center text-lg hover:bg-[#2e2e3e] transition-colors"
          onClick={() => { scaleRef.current = Math.min(2, scaleRef.current + 0.1); }}
        >+</button>
        <button
          className="w-8 h-8 rounded bg-[#1e1e2e] text-white flex items-center justify-center text-lg hover:bg-[#2e2e3e] transition-colors"
          onClick={() => { scaleRef.current = Math.max(0.3, scaleRef.current - 0.1); }}
        >−</button>
        <button
          className="w-8 h-8 rounded bg-[#1e1e2e] text-white flex items-center justify-center text-xs hover:bg-[#2e2e3e] transition-colors"
          onClick={() => { scaleRef.current = 0.85; panRef.current = { x: 0, y: 0 }; }}
        >1:1</button>
      </div>
    </div>
  );
}

// --- Utility functions ---

function moveToward(st: AgentState, tx: number, ty: number, speed: number): boolean {
  const dx = tx - st.x;
  const dy = ty - st.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 2) return false;
  const s = Math.min(speed, d);
  st.x += (dx / d) * s;
  st.y += (dy / d) * s;
  return true;
}

function dist(st: AgentState, tx: number, ty: number) {
  return Math.sqrt((st.x - tx) ** 2 + (st.y - ty) ** 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
