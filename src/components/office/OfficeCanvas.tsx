import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Ellipse, Group, Text, Line, Shape } from "react-konva";
import Konva from "konva";
import type { Agent } from "@/hooks/useRealtimeAgents";

const WORLD_W = 3000;
const WORLD_H = 2000;

const MODEL_COLORS: Record<string, string> = {
  "claude-haiku": "#22c55e",
  "llama-groq": "#f59e0b",
  "gemini-pro": "#06b6d4",
  "claude-sonnet": "#6366f1",
  "gpt-4o": "#3b82f6",
  "claude-opus": "#a855f7",
};

interface OfficeCanvasProps {
  agents: Agent[];
  onAgentClick: (agent: Agent, pos: { x: number; y: number }) => void;
  selectedAgentId: string | null;
  meetingParticipants: string[];
  containerWidth: number;
  containerHeight: number;
}

function getDeskPos(index: number) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 200 + col * 360, y: 300 + row * 280 };
}

function getMeetingChairPos(index: number, total: number) {
  const angle = (2 * Math.PI / Math.max(total, 1)) * index;
  return {
    x: 2250 + Math.cos(angle) * 320,
    y: 480 + Math.sin(angle) * 170,
  };
}

export default function OfficeCanvas({
  agents, onAgentClick, selectedAgentId, meetingParticipants, containerWidth, containerHeight,
}: OfficeCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState(1);

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

  const resetZoom = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: -500, y: -200 });
    setScale(1);
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

  return (
    <div className="relative w-full h-full">
      <Stage
        ref={stageRef}
        width={containerWidth}
        height={containerHeight}
        draggable
        x={-500}
        y={-200}
        onWheel={handleWheel}
      >
        <Layer>
          {/* Background */}
          <Rect width={WORLD_W} height={WORLD_H} fill="#0a0a0f" />

          {/* Dot grid */}
          <Shape
            sceneFunc={(ctx, shape) => {
              for (let x = 0; x < WORLD_W; x += 40) {
                for (let y = 0; y < WORLD_H; y += 40) {
                  ctx.beginPath();
                  ctx.arc(x, y, 1, 0, Math.PI * 2);
                  ctx.fillStyle = "rgba(99,102,241,0.15)";
                  ctx.fill();
                }
              }
              ctx.fillStrokeShape(shape);
            }}
          />

          {/* Work Area */}
          <Rect x={100} y={200} width={1600} height={1200} fill="rgba(17,17,24,0.6)" stroke="#1e1e2e" strokeWidth={1} cornerRadius={16} />
          <Text x={120} y={210} text="Área de Trabalho" fill="#1e1e2e" fontSize={12} />

          {/* Meeting Room */}
          <Rect x={1800} y={200} width={900} height={600} fill="rgba(99,102,241,0.05)" stroke="#6366f1" strokeWidth={1} dash={[8, 4]} cornerRadius={16} />
          <Text x={1820} y={210} text="Sala de Reunião" fill="#6366f1" fontSize={12} />
          <Ellipse x={2250} y={480} radiusX={260} radiusY={130} fill="#1a1a2e" stroke="#6366f1" strokeWidth={2} />

          {/* Rest Area */}
          <Rect x={1800} y={900} width={900} height={500} fill="rgba(34,197,94,0.03)" stroke="#1e1e2e" strokeWidth={1} dash={[4, 4]} cornerRadius={16} />
          <Text x={1820} y={910} text="Área de Descanso" fill="#1e1e2e" fontSize={12} />
          <Rect x={1900} y={1100} width={300} height={120} fill="#1a1a2e" stroke="#1e1e2e" cornerRadius={24} />

          {/* Agent desks and characters */}
          {agents.map((agent, i) => {
            const inMeeting = meetingParticipants.includes(agent.id);
            const deskPos = getDeskPos(i);
            const agentPos = inMeeting
              ? getMeetingChairPos(meetingParticipants.indexOf(agent.id), meetingParticipants.length)
              : { x: deskPos.x + 100, y: deskPos.y - 30 };
            const isSelected = selectedAgentId === agent.id;
            const color = agent.avatar_color || "#6366f1";
            const modelColor = MODEL_COLORS[agent.model || "claude-sonnet"] || "#6366f1";
            const status = agent.status || "idle";
            const isOffline = status === "offline" || !agent.is_active;
            const initials = agent.name.slice(0, 2).toUpperCase();

            const strokeColorMap: Record<string, string> = {
              idle: "#1e1e2e", thinking: "#3b82f6", working: "#6366f1",
              in_meeting: "#22c55e", messaging: "#f59e0b", offline: "#1e1e2e",
            };
            const statusColorMap: Record<string, string> = {
              idle: "#94a3b8", thinking: "#3b82f6", working: "#6366f1",
              in_meeting: "#22c55e", messaging: "#f59e0b", offline: "#4a4a5a",
            };

            return (
              <Group key={agent.id}>
                {/* Desk */}
                <Group x={deskPos.x} y={deskPos.y}>
                  <Rect width={200} height={120} fill="#111118" stroke={color} strokeWidth={1.5} cornerRadius={8}
                    shadowColor={color} shadowBlur={8} shadowOpacity={0.3} />
                  {/* Monitor */}
                  <Rect x={60} y={20} width={80} height={50} fill="#0a0a0f" stroke="#1e1e2e" cornerRadius={4} />
                  {/* Model badge */}
                  <Rect x={150} y={5} width={46} height={16} fill={modelColor} cornerRadius={8} />
                  <Text x={153} y={7} text={agent.model?.split("-")[0] || "ai"} fill="white" fontSize={9} />
                  {/* Name below desk */}
                  <Text x={0} y={128} text={agent.name} fill="white" fontSize={13} fontStyle="bold" width={200} align="center" />
                  <Text x={0} y={144} text={agent.role} fill="#94a3b8" fontSize={11} width={200} align="center" />
                </Group>

                {/* Agent character */}
                <Group
                  x={agentPos.x}
                  y={agentPos.y}
                  onClick={() => {
                    const stage = stageRef.current;
                    if (!stage) return;
                    const absPos = stage.getPointerPosition();
                    onAgentClick(agent, absPos || { x: 0, y: 0 });
                  }}
                  onTap={() => {
                    onAgentClick(agent, { x: agentPos.x, y: agentPos.y });
                  }}
                >
                  {/* Shadow */}
                  <Ellipse radiusX={24} radiusY={8} fill="rgba(0,0,0,0.4)" y={32} />
                  {/* Body */}
                  <Circle
                    radius={28}
                    fill={isOffline ? "#2a2a3a" : color}
                    stroke={strokeColorMap[status] || "#1e1e2e"}
                    strokeWidth={isSelected ? 3 : 2}
                    shadowColor={isSelected ? color : "transparent"}
                    shadowBlur={isSelected ? 20 : 0}
                    opacity={isOffline ? 0.5 : 1}
                  />
                  {/* Initials */}
                  <Text text={initials} fill="white" fontSize={16} fontStyle="bold"
                    x={-14} y={-9} width={28} align="center" />
                  {/* Status dot */}
                  <Circle x={22} y={-22} radius={6} fill={statusColorMap[status] || "#94a3b8"} />

                  {/* Thinking animation ring (static representation) */}
                  {status === "thinking" && (
                    <>
                      <Circle radius={34} fill="transparent" stroke="#3b82f6" strokeWidth={2} dash={[10, 6]} opacity={0.7} />
                      {/* Thinking dots */}
                      <Rect x={-20} y={-60} width={40} height={20} fill="#111118" stroke="#3b82f6" strokeWidth={1} cornerRadius={10} />
                      <Circle x={-8} y={-50} radius={3} fill="#3b82f6" />
                      <Circle x={0} y={-50} radius={3} fill="#3b82f6" opacity={0.6} />
                      <Circle x={8} y={-50} radius={3} fill="#3b82f6" opacity={0.3} />
                    </>
                  )}

                  {/* Working indicator */}
                  {status === "working" && (
                    <Circle radius={32} fill="transparent" stroke="#6366f1" strokeWidth={2} opacity={0.6} />
                  )}

                  {/* Messaging indicator */}
                  {status === "messaging" && (
                    <Shape
                      x={20} y={-40}
                      sceneFunc={(ctx, shape) => {
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(16, 0);
                        ctx.lineTo(16, 12);
                        ctx.lineTo(8, 12);
                        ctx.lineTo(4, 16);
                        ctx.lineTo(4, 12);
                        ctx.lineTo(0, 12);
                        ctx.closePath();
                        ctx.fillStyle = "#f59e0b";
                        ctx.fill();
                        ctx.fillStrokeShape(shape);
                      }}
                    />
                  )}
                </Group>
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
        <MiniMap
          agents={agents}
          meetingParticipants={meetingParticipants}
          stageRef={stageRef}
          stageWidth={containerWidth}
          stageHeight={containerHeight}
          scale={scale}
        />
      </div>
    </div>
  );
}

function MiniMap({
  agents, meetingParticipants, stageRef, stageWidth, stageHeight, scale,
}: {
  agents: Agent[];
  meetingParticipants: string[];
  stageRef: React.RefObject<Konva.Stage | null>;
  stageWidth: number;
  stageHeight: number;
  scale: number;
}) {
  const mmW = 180;
  const mmH = 120;
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
    <Stage width={mmW} height={mmH} onClick={handleClick} style={{ borderRadius: 8, overflow: "hidden" }}>
      <Layer>
        <Rect width={mmW} height={mmH} fill="rgba(17,17,24,0.9)" stroke="#1e1e2e" strokeWidth={1} />
        {/* Areas */}
        <Rect x={100 * mmScale} y={200 * mmScale} width={1600 * mmScale} height={1200 * mmScale}
          fill="rgba(17,17,24,0.6)" stroke="#1e1e2e" strokeWidth={0.5} />
        <Rect x={1800 * mmScale} y={200 * mmScale} width={900 * mmScale} height={600 * mmScale}
          fill="rgba(99,102,241,0.1)" stroke="#6366f1" strokeWidth={0.5} />
        {/* Agent dots */}
        {agents.map((agent, i) => {
          const inMeeting = meetingParticipants.includes(agent.id);
          const pos = inMeeting
            ? getMeetingChairPos(meetingParticipants.indexOf(agent.id), meetingParticipants.length)
            : { x: getDeskPos(i).x + 100, y: getDeskPos(i).y - 30 };
          return (
            <Circle
              key={agent.id}
              x={pos.x * mmScale}
              y={pos.y * mmScale}
              radius={3}
              fill={agent.avatar_color || "#6366f1"}
            />
          );
        })}
        {/* Viewport rect */}
        <Rect x={vpX} y={vpY} width={vpW} height={vpH} fill="transparent" stroke="#3b82f6" strokeWidth={1} />
      </Layer>
    </Stage>
  );
}
