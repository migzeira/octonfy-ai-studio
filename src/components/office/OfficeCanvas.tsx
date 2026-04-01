import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Group, Text, Shape } from "react-konva";
import Konva from "konva";
import type { Agent } from "@/hooks/useRealtimeAgents";
import { usePixelAgentAnimations } from "@/hooks/useAgentAnimations";
import {
  sprites, drawSpriteGrid, PX, furniture, environment,
} from "@/components/office/pixelSprites";

const WORLD_W = 2400;
const WORLD_H = 1600;

// Layout constants
const WORK_AREA = { x: 60, y: 100, w: 1500, h: 1100 };
const MEETING_AREA = { x: 1620, y: 100, w: 720, h: 550 };
const REST_AREA = { x: 1620, y: 700, w: 720, h: 500 };
const MEETING_CENTER = { x: MEETING_AREA.x + 360, y: MEETING_AREA.y + 300 };

interface OfficeCanvasProps {
  agents: Agent[];
  onAgentClick: (agent: Agent, pos: { x: number; y: number }) => void;
  selectedAgentId: string | null;
  meetingParticipants: string[];
  containerWidth: number;
  containerHeight: number;
}

export function getDeskPos(index: number) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: WORK_AREA.x + 80 + col * 340, y: WORK_AREA.y + 120 + row * 260 };
}

export function getMeetingChairPos(index: number, total: number) {
  const angle = (2 * Math.PI / Math.max(total, 1)) * index - Math.PI / 2;
  return {
    x: MEETING_CENTER.x + Math.cos(angle) * 120,
    y: MEETING_CENTER.y + Math.sin(angle) * 60,
  };
}

export default function OfficeCanvas({
  agents, onAgentClick, selectedAgentId, meetingParticipants, containerWidth, containerHeight,
}: OfficeCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [scale, setScale] = useState(0.85);

  const { agentPositions } = usePixelAgentAnimations(layerRef, agents, meetingParticipants);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.08;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.3, Math.min(2.5, newScale));
    stage.scale({ x: clampedScale, y: clampedScale });
    stage.position({
      x: pointer.x - (pointer.x - stage.x()) * (clampedScale / oldScale),
      y: pointer.y - (pointer.y - stage.y()) * (clampedScale / oldScale),
    });
    setScale(clampedScale);
  }, []);

  const zoomIn = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const newScale = Math.min(2.5, stage.scaleX() * 1.2);
    stage.scale({ x: newScale, y: newScale });
    setScale(newScale);
  }, []);

  const zoomOut = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const newScale = Math.max(0.3, stage.scaleX() * 0.8);
    stage.scale({ x: newScale, y: newScale });
    setScale(newScale);
  }, []);

  const resetZoom = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 0.85, y: 0.85 });
    stage.position({ x: -20, y: -40 });
    setScale(0.85);
  }, []);

  const statusLabel: Record<string, string> = {
    idle: "Ocioso", thinking: "Pensando...", working: "Trabalhando",
    in_meeting: "Em reunião", messaging: "Mensagens", offline: "Offline",
  };
  const statusColor: Record<string, string> = {
    idle: "#94a3b8", thinking: "#3b82f6", working: "#6366f1",
    in_meeting: "#22c55e", messaging: "#f59e0b", offline: "#4a4a5a",
  };

  return (
    <div className="relative w-full h-full">
      <Stage
        ref={stageRef}
        width={containerWidth}
        height={containerHeight}
        draggable
        x={-20}
        y={-40}
        scaleX={0.85}
        scaleY={0.85}
        onWheel={handleWheel}
      >
        <Layer ref={layerRef}>
          {/* ── Background ── */}
          <Rect width={WORLD_W} height={WORLD_H} fill="#0d0d14" />

          {/* ── Environment (floors, walls, furniture) drawn via Shape ── */}
          <Shape
            sceneFunc={(ctx, shape) => {
              // Walls
              environment.drawWall(ctx, 0, 0, WORLD_W, 60);
              environment.drawWall(ctx, 0, 0, 60, WORLD_H);

              // Work area floor — wood
              environment.drawWoodFloor(ctx, WORK_AREA.x, WORK_AREA.y, WORK_AREA.w, WORK_AREA.h);

              // Meeting area floor — blue tile
              environment.drawTileFloor(ctx, MEETING_AREA.x, MEETING_AREA.y, MEETING_AREA.w, MEETING_AREA.h, "#141428", "#161630");

              // Rest area floor — checkered
              environment.drawTileFloor(ctx, REST_AREA.x, REST_AREA.y, REST_AREA.w, REST_AREA.h, "#1a1a22", "#16161e");

              // Divider lines
              ctx.strokeStyle = "rgba(99,102,241,0.2)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(MEETING_AREA.x, WORK_AREA.y);
              ctx.lineTo(MEETING_AREA.x, WORK_AREA.y + WORK_AREA.h);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(MEETING_AREA.x, MEETING_AREA.y + MEETING_AREA.h);
              ctx.lineTo(MEETING_AREA.x + MEETING_AREA.w, MEETING_AREA.y + MEETING_AREA.h);
              ctx.stroke();

              // Desks for each agent slot
              agents.forEach((_, i) => {
                const dp = getDeskPos(i);
                furniture.drawDesk(ctx, dp.x, dp.y);
              });

              // Meeting table
              furniture.drawMeetingTable(ctx, MEETING_CENTER.x, MEETING_CENTER.y);

              // Rest area furniture
              furniture.drawSofa(ctx, REST_AREA.x + 100, REST_AREA.y + 150);
              furniture.drawSofa(ctx, REST_AREA.x + 350, REST_AREA.y + 150);
              furniture.drawCoffeeMachine(ctx, REST_AREA.x + 600, REST_AREA.y + 80);

              // Plants
              furniture.drawPlant(ctx, WORK_AREA.x + 20, WORK_AREA.y + 20);
              furniture.drawPlant(ctx, WORK_AREA.x + WORK_AREA.w - 40, WORK_AREA.y + 20);
              furniture.drawPlant(ctx, REST_AREA.x + 40, REST_AREA.y + 40);
              furniture.drawPlant(ctx, MEETING_AREA.x + 20, MEETING_AREA.y + 20);
              furniture.drawPlant(ctx, MEETING_AREA.x + MEETING_AREA.w - 50, MEETING_AREA.y + 20);

              ctx.fillStrokeShape(shape);
            }}
          />

          {/* ── Area Labels ── */}
          <Text x={WORK_AREA.x + 10} y={WORK_AREA.y + WORK_AREA.h - 20} text="ÁREA DE TRABALHO"
            fill="rgba(99,102,241,0.15)" fontSize={14} fontFamily="monospace" />
          <Text x={MEETING_AREA.x + 10} y={MEETING_AREA.y + MEETING_AREA.h - 20} text="SALA DE REUNIÃO"
            fill="rgba(99,102,241,0.15)" fontSize={14} fontFamily="monospace" />
          <Text x={REST_AREA.x + 10} y={REST_AREA.y + REST_AREA.h - 20} text="ÁREA DE DESCANSO"
            fill="rgba(34,197,94,0.15)" fontSize={14} fontFamily="monospace" />

          {/* ── Agent Sprites ── */}
          {agents.map((agent, i) => {
            const status = agent.status || "idle";
            const isOffline = status === "offline" || !agent.is_active;
            const color = agent.avatar_color || "#6366f1";
            const inMeeting = meetingParticipants.includes(agent.id);

            // Get animated position from hook
            const animPos = agentPositions.get(agent.id);
            const deskPos = getDeskPos(i);
            const defaultPos = inMeeting
              ? getMeetingChairPos(meetingParticipants.indexOf(agent.id), meetingParticipants.length)
              : { x: deskPos.x + 45, y: deskPos.y - 20 };
            const pos = animPos || defaultPos;

            const isSelected = selectedAgentId === agent.id;

            // Pick the right sprite frame
            let spriteFrame = 0;
            if (animPos) spriteFrame = animPos.frame || 0;

            return (
              <Group key={agent.id}>
                {/* The pixel character */}
                <Shape
                  x={pos.x}
                  y={pos.y}
                  opacity={isOffline ? 0.4 : 1}
                  sceneFunc={(ctx, shape) => {
                    let grid;
                    if (status === "working" || status === "messaging" || inMeeting) {
                      grid = sprites.sitting(color, spriteFrame % 2);
                    } else if (status === "idle" && !isOffline) {
                      grid = spriteFrame % 2 === 0 ? sprites.walk1(color) : sprites.walk2(color);
                    } else if (status === "thinking") {
                      grid = sprites.standing(color);
                    } else {
                      grid = sprites.standing(isOffline ? "#555555" : color);
                    }
                    drawSpriteGrid(ctx, grid, -18, -22);

                    // Thinking bubble
                    if (status === "thinking") {
                      ctx.fillStyle = "#1a1a2e";
                      ctx.strokeStyle = "#3b82f6";
                      ctx.lineWidth = 1;
                      ctx.beginPath();
                      ctx.roundRect(-20, -44, 40, 16, 6);
                      ctx.fill();
                      ctx.stroke();
                      const dotRadius = 2.5;
                      const dotY = -36;
                      ctx.fillStyle = "#3b82f6";
                      [-10, 0, 10].forEach((dx, di) => {
                        const scale = spriteFrame === di ? 1.5 : 1;
                        ctx.beginPath();
                        ctx.arc(dx, dotY, dotRadius * scale, 0, Math.PI * 2);
                        ctx.fill();
                      });
                    }

                    // Messaging icon
                    if (status === "messaging" && spriteFrame % 2 === 0) {
                      ctx.fillStyle = "#f59e0b";
                      ctx.beginPath();
                      ctx.roundRect(16, -36, 14, 10, 3);
                      ctx.fill();
                      ctx.fillStyle = "#fff";
                      ctx.fillRect(19, -33, 8, 1);
                      ctx.fillRect(19, -31, 5, 1);
                    }

                    ctx.fillStrokeShape(shape);
                  }}
                  onClick={() => {
                    const stage = stageRef.current;
                    if (!stage) return;
                    const pointer = stage.getPointerPosition();
                    if (!pointer) return;
                    onAgentClick(agent, { x: pointer.x, y: pointer.y });
                  }}
                  onTap={() => {
                    onAgentClick(agent, { x: pos.x, y: pos.y });
                  }}
                />

                {/* Selection glow */}
                {isSelected && (
                  <Circle x={pos.x} y={pos.y} radius={30} fill="transparent"
                    stroke={color} strokeWidth={2} opacity={0.6}
                    dash={[4, 3]} />
                )}

                {/* Name + Status label */}
                <Group x={pos.x} y={pos.y + 28}>
                  {/* Status badge */}
                  <Rect x={-32} y={0} width={64} height={14} fill="rgba(10,10,15,0.85)"
                    cornerRadius={4} stroke={statusColor[status] || "#94a3b8"} strokeWidth={0.5} />
                  <Text x={-30} y={2} text={statusLabel[status] || status} fill={statusColor[status] || "#94a3b8"}
                    fontSize={8} fontFamily="monospace" width={60} align="center" />
                  {/* Name */}
                  <Text x={-40} y={16} text={agent.name} fill="#e2e8f0" fontSize={10}
                    fontStyle="bold" width={80} align="center" />
                  {/* Role */}
                  <Text x={-40} y={27} text={agent.role} fill="#64748b" fontSize={8}
                    width={80} align="center" />
                </Group>

                {/* Status dot */}
                <Circle x={pos.x + 18} y={pos.y - 24} radius={4}
                  fill={statusColor[status] || "#94a3b8"} />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-10">
        <button onClick={zoomIn} className="w-8 h-8 rounded-lg bg-card border border-border text-foreground flex items-center justify-center hover:bg-accent text-sm font-bold">+</button>
        <button onClick={resetZoom} className="w-8 h-8 rounded-lg bg-card border border-border text-foreground flex items-center justify-center hover:bg-accent text-sm">⊙</button>
        <button onClick={zoomOut} className="w-8 h-8 rounded-lg bg-card border border-border text-foreground flex items-center justify-center hover:bg-accent text-sm font-bold">−</button>
      </div>

      {/* Mini-map */}
      <div className="absolute bottom-16 left-4 z-10">
        <MiniMap agents={agents} meetingParticipants={meetingParticipants}
          stageRef={stageRef} stageWidth={containerWidth} stageHeight={containerHeight} scale={scale}
          agentPositions={agentPositions} />
      </div>
    </div>
  );
}

function MiniMap({
  agents, meetingParticipants, stageRef, stageWidth, stageHeight, scale, agentPositions,
}: {
  agents: Agent[];
  meetingParticipants: string[];
  stageRef: React.RefObject<Konva.Stage | null>;
  stageWidth: number;
  stageHeight: number;
  scale: number;
  agentPositions: Map<string, { x: number; y: number; frame?: number }>;
}) {
  const mmW = 160;
  const mmH = 107;
  const mmScale = mmW / WORLD_W;

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const mmStage = e.target.getStage();
    if (!mmStage) return;
    const pos = mmStage.getPointerPosition();
    if (!pos) return;
    const worldX = pos.x / mmScale;
    const worldY = pos.y / mmScale;
    stage.position({
      x: -worldX * scale + stageWidth / 2,
      y: -worldY * scale + stageHeight / 2,
    });
  };

  const stg = stageRef.current;
  const vpX = stg ? (-stg.x() / scale) * mmScale : 0;
  const vpY = stg ? (-stg.y() / scale) * mmScale : 0;
  const vpW = (stageWidth / scale) * mmScale;
  const vpH = (stageHeight / scale) * mmScale;

  return (
    <Stage width={mmW} height={mmH} onClick={handleClick}
      style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #1e1e2e" }}>
      <Layer>
        <Rect width={mmW} height={mmH} fill="rgba(10,10,15,0.9)" />
        {/* Work area */}
        <Rect x={WORK_AREA.x * mmScale} y={WORK_AREA.y * mmScale}
          width={WORK_AREA.w * mmScale} height={WORK_AREA.h * mmScale}
          fill="rgba(60,40,30,0.3)" />
        {/* Meeting area */}
        <Rect x={MEETING_AREA.x * mmScale} y={MEETING_AREA.y * mmScale}
          width={MEETING_AREA.w * mmScale} height={MEETING_AREA.h * mmScale}
          fill="rgba(99,102,241,0.15)" />
        {/* Rest area */}
        <Rect x={REST_AREA.x * mmScale} y={REST_AREA.y * mmScale}
          width={REST_AREA.w * mmScale} height={REST_AREA.h * mmScale}
          fill="rgba(34,197,94,0.08)" />
        {/* Agent dots */}
        {agents.map((agent, i) => {
          const animPos = agentPositions.get(agent.id);
          const dp = getDeskPos(i);
          const inMeeting = meetingParticipants.includes(agent.id);
          const defaultPos = inMeeting
            ? getMeetingChairPos(meetingParticipants.indexOf(agent.id), meetingParticipants.length)
            : { x: dp.x + 45, y: dp.y - 20 };
          const pos = animPos || defaultPos;
          return (
            <Circle key={agent.id} x={pos.x * mmScale} y={pos.y * mmScale}
              radius={3} fill={agent.avatar_color || "#6366f1"} />
          );
        })}
        {/* Viewport */}
        <Rect x={vpX} y={vpY} width={vpW} height={vpH}
          fill="transparent" stroke="#3b82f6" strokeWidth={1} />
      </Layer>
    </Stage>
  );
}
