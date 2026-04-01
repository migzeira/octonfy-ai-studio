import { useRef, useEffect, useState, useCallback } from "react";
import Konva from "konva";
import type { Agent } from "@/hooks/useRealtimeAgents";
import { getDeskPos, getMeetingChairPos } from "@/components/office/OfficeCanvas";

interface AgentAnimPos {
  x: number;
  y: number;
  frame?: number;
  targetX?: number;
  targetY?: number;
}

// Area where idle agents can wander
const WANDER_AREA = { x: 80, y: 120, w: 1460, h: 1060 };
const TICK_MS = 400;

function randomTarget() {
  return {
    x: WANDER_AREA.x + Math.random() * WANDER_AREA.w,
    y: WANDER_AREA.y + Math.random() * WANDER_AREA.h,
  };
}

export function usePixelAgentAnimations(
  layerRef: React.RefObject<Konva.Layer | null>,
  agents: Agent[],
  meetingParticipants: string[]
) {
  const [agentPositions, setAgentPositions] = useState<Map<string, AgentAnimPos>>(new Map());
  const posRef = useRef<Map<string, AgentAnimPos>>(new Map());
  const frameRef = useRef(0);

  // Initialize positions for new agents
  useEffect(() => {
    const map = new Map(posRef.current);
    let changed = false;
    agents.forEach((agent, i) => {
      if (!map.has(agent.id)) {
        const dp = getDeskPos(i);
        map.set(agent.id, { x: dp.x + 45, y: dp.y - 20, frame: 0 });
        changed = true;
      }
    });
    // Remove agents no longer present
    for (const id of map.keys()) {
      if (!agents.find(a => a.id === id)) {
        map.delete(id);
        changed = true;
      }
    }
    if (changed) {
      posRef.current = map;
      setAgentPositions(new Map(map));
    }
  }, [agents]);

  // Animation tick
  useEffect(() => {
    const interval = setInterval(() => {
      frameRef.current++;
      const map = new Map(posRef.current);
      let anyChange = false;

      agents.forEach((agent, i) => {
        const status = agent.status || "idle";
        const isOffline = status === "offline" || !agent.is_active;
        const inMeeting = meetingParticipants.includes(agent.id);
        const pos = map.get(agent.id) || { x: 300, y: 300, frame: 0 };

        if (inMeeting || status === "in_meeting") {
          // Move to meeting chair
          const chairPos = getMeetingChairPos(
            meetingParticipants.indexOf(agent.id) >= 0
              ? meetingParticipants.indexOf(agent.id)
              : i % 6,
            Math.max(meetingParticipants.length, 1)
          );
          const dx = chairPos.x - pos.x;
          const dy = chairPos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            pos.x += (dx / dist) * Math.min(8, dist);
            pos.y += (dy / dist) * Math.min(8, dist);
            pos.frame = frameRef.current % 2;
          } else {
            pos.x = chairPos.x;
            pos.y = chairPos.y;
            pos.frame = frameRef.current % 2;
          }
          anyChange = true;
        } else if (status === "working" || status === "messaging") {
          // Sit at desk
          const dp = getDeskPos(i);
          const seatX = dp.x + 45;
          const seatY = dp.y - 10;
          const dx = seatX - pos.x;
          const dy = seatY - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 3) {
            pos.x += (dx / dist) * Math.min(6, dist);
            pos.y += (dy / dist) * Math.min(6, dist);
          } else {
            pos.x = seatX;
            pos.y = seatY;
          }
          pos.frame = frameRef.current % 2;
          anyChange = true;
        } else if (status === "thinking") {
          // Stand near desk
          const dp = getDeskPos(i);
          const standX = dp.x + 120;
          const standY = dp.y - 20;
          const dx = standX - pos.x;
          const dy = standY - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 3) {
            pos.x += (dx / dist) * Math.min(6, dist);
            pos.y += (dy / dist) * Math.min(6, dist);
          }
          pos.frame = frameRef.current % 3; // for dot animation
          anyChange = true;
        } else if (isOffline) {
          // Stay put, no animation
          pos.frame = 0;
        } else {
          // Idle — wander randomly
          if (!pos.targetX || !pos.targetY || Math.random() < 0.02) {
            const t = randomTarget();
            pos.targetX = t.x;
            pos.targetY = t.y;
          }
          const dx = pos.targetX - pos.x;
          const dy = pos.targetY - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            const speed = 3;
            pos.x += (dx / dist) * speed;
            pos.y += (dy / dist) * speed;
            pos.frame = frameRef.current % 2;
          } else {
            // Arrived — pick new target after pause
            if (Math.random() < 0.05) {
              const t = randomTarget();
              pos.targetX = t.x;
              pos.targetY = t.y;
            }
            pos.frame = 0;
          }
          anyChange = true;
        }

        map.set(agent.id, { ...pos });
      });

      if (anyChange) {
        posRef.current = map;
        setAgentPositions(new Map(map));
        layerRef.current?.batchDraw();
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [agents, meetingParticipants, layerRef]);

  return { agentPositions };
}

// Keep the old export name for backwards compat
export const useAgentAnimations = usePixelAgentAnimations;

// Kept for potential future use
export function showMessageLine(
  from: { position_x: number | null; position_y: number | null },
  to: { position_x: number | null; position_y: number | null },
  layer: Konva.Layer
) {
  if (!from.position_x || !from.position_y || !to.position_x || !to.position_y) return;
  const line = new Konva.Line({
    points: [from.position_x, from.position_y, to.position_x, to.position_y],
    stroke: "#f59e0b", strokeWidth: 2,
    dash: [8, 4], dashOffset: 0, opacity: 0.8,
  });
  layer.add(line);
  const anim = new Konva.Animation(() => {
    line.dashOffset(line.dashOffset() - 0.5);
  }, layer);
  anim.start();
  setTimeout(() => {
    anim.stop();
    new Konva.Tween({
      node: line, opacity: 0, duration: 0.5,
      onFinish: () => { line.destroy(); layer.batchDraw(); },
    }).play();
  }, 3000);
}
