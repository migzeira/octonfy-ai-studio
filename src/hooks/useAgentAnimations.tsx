import { useRef, useEffect, useCallback } from "react";
import Konva from "konva";
import type { Agent } from "@/hooks/useRealtimeAgents";

interface AnimationSet {
  animations: Konva.Animation[];
  tweens: Konva.Tween[];
  nodes: Konva.Node[];
}

export function useAgentAnimations(
  layerRef: React.RefObject<Konva.Layer | null>,
  agents: Agent[]
) {
  const activeAnimations = useRef<Map<string, AnimationSet>>(new Map());

  const cleanup = useCallback((agentId: string) => {
    const set = activeAnimations.current.get(agentId);
    if (!set) return;
    set.animations.forEach(a => { try { a.stop() } catch {} });
    set.tweens.forEach(t => { try { t.destroy() } catch {} });
    set.nodes.forEach(n => { try { n.destroy() } catch {} });
    activeAnimations.current.delete(agentId);
  }, []);

  const cleanupAll = useCallback(() => {
    activeAnimations.current.forEach((_, id) => cleanup(id));
  }, [cleanup]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    agents.forEach((agent) => {
      const status = agent.status || "idle";
      const agentId = agent.id;

      // Find the agent's character group (second Group child — the one with onClick)
      const stage = layer.getStage();
      if (!stage) return;

      // Find all groups, look for the one containing the agent's body circle
      let agentGroup: Konva.Group | null = null;
      const allGroups = layer.find("Group").slice() as Konva.Group[];
      for (const group of allGroups) {
        // Check if this group has an onClick handler and children matching agent pattern
        const children = group.getChildren().slice() as Konva.Node[];
        if (children.length > 0) {
          // Look for the character group: has Circle (body), Text (initials), Ellipse (shadow)
          const hasCircleBody = children.some(c => c instanceof Konva.Circle && (c as Konva.Circle).radius() === 28);
          const hasEllipseShadow = children.some(c => c instanceof Konva.Ellipse);
          const hasText = children.some(c => c instanceof Konva.Text);
          if (hasCircleBody && hasEllipseShadow && hasText) {
            // Match by position
            const expectedPos = getAgentExpectedPos(agent, agents);
            if (Math.abs(group.x() - expectedPos.x) < 5 && Math.abs(group.y() - expectedPos.y) < 5) {
              agentGroup = group;
              break;
            }
          }
        }
      }

      if (!agentGroup) return;

      // Check if animation needs update
      const existingSet = activeAnimations.current.get(agentId);
      const currentStatus = (agentGroup as any).__animStatus;
      if (currentStatus === status && existingSet) return;

      // Cleanup previous animations
      cleanup(agentId);
      (agentGroup as any).__animStatus = status;

      const newSet: AnimationSet = { animations: [], tweens: [], nodes: [] };

      // Find status dot (small circle at top-right)
      const statusDot = (agentGroup.getChildren().slice() as Konva.Node[]).find(
        c => c instanceof Konva.Circle && (c as Konva.Circle).radius() === 6
      ) as Konva.Circle | undefined;

      if (status === "idle" && statusDot) {
        const pulseDown = () => {
          const t1 = new Konva.Tween({
            node: statusDot, opacity: 0.3, duration: 1.5,
            easing: Konva.Easings.EaseInOut,
            onFinish: () => {
              const t2 = new Konva.Tween({
                node: statusDot, opacity: 1, duration: 1.5,
                easing: Konva.Easings.EaseInOut,
                onFinish: () => pulseDown(),
              });
              newSet.tweens.push(t2);
              t2.play();
            },
          });
          newSet.tweens.push(t1);
          t1.play();
        };
        pulseDown();
      }

      if (status === "thinking") {
        // Spinning ring
        const ring = new Konva.Arc({
          x: 0, y: 0, innerRadius: 32, outerRadius: 36,
          angle: 270, fill: "#3b82f6", rotation: 0, opacity: 0.9,
        });
        agentGroup.add(ring);
        newSet.nodes.push(ring);

        const anim = new Konva.Animation(() => {
          ring.rotation(ring.rotation() + 3);
        }, layer);
        anim.start();
        newSet.animations.push(anim);

        // Thinking bubble with bouncing dots
        const bubble = new Konva.Group({ x: 0, y: -60 });
        const bg = new Konva.Rect({
          x: -22, y: -12, width: 44, height: 24,
          fill: "#111118", stroke: "#3b82f6", strokeWidth: 1, cornerRadius: 10,
        });
        bubble.add(bg);

        const dots: Konva.Circle[] = [];
        [-10, 0, 10].forEach((dx, i) => {
          const dot = new Konva.Circle({ x: dx, y: 0, radius: 3, fill: "#3b82f6" });
          bubble.add(dot);
          dots.push(dot);
        });
        agentGroup.add(bubble);
        newSet.nodes.push(bubble);

        // Animate dots sequentially
        dots.forEach((dot, i) => {
          const bounceDot = () => {
            const t1 = new Konva.Tween({
              node: dot, scaleX: 1.5, scaleY: 1.5, duration: 0.2,
              onFinish: () => {
                const t2 = new Konva.Tween({
                  node: dot, scaleX: 1, scaleY: 1, duration: 0.2,
                  onFinish: () => setTimeout(bounceDot, 400),
                });
                newSet.tweens.push(t2);
                t2.play();
              },
            });
            newSet.tweens.push(t1);
            t1.play();
          };
          setTimeout(bounceDot, i * 200);
        });

        // Fast blink status dot
        if (statusDot) {
          const blinkFast = () => {
            const t = new Konva.Tween({
              node: statusDot, opacity: 0, duration: 0.3,
              onFinish: () => {
                const t2 = new Konva.Tween({
                  node: statusDot, opacity: 1, duration: 0.3,
                  onFinish: blinkFast,
                });
                newSet.tweens.push(t2);
                t2.play();
              },
            });
            newSet.tweens.push(t);
            t.play();
          };
          blinkFast();
        }
      }

      if (status === "working") {
        // Pulsing ring
        const ring = new Konva.Circle({
          x: 0, y: 0, radius: 34,
          fill: "transparent", stroke: "#6366f1", strokeWidth: 2,
        });
        agentGroup.add(ring);
        newSet.nodes.push(ring);

        const pulseRing = () => {
          const t1 = new Konva.Tween({
            node: ring, scaleX: 1.25, scaleY: 1.25, opacity: 0.3, duration: 0.8,
            easing: Konva.Easings.EaseOut,
            onFinish: () => {
              const t2 = new Konva.Tween({
                node: ring, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.8,
                easing: Konva.Easings.EaseIn,
                onFinish: pulseRing,
              });
              newSet.tweens.push(t2);
              t2.play();
            },
          });
          newSet.tweens.push(t1);
          t1.play();
        };
        pulseRing();

        // Spinning gear
        const gear = new Konva.Shape({
          x: 22, y: 22,
          sceneFunc: (ctx, shape) => {
            const r1 = 8, r2 = 5, teeth = 8;
            ctx.beginPath();
            for (let i = 0; i < teeth * 2; i++) {
              const angle = (i * Math.PI) / teeth;
              const r = i % 2 === 0 ? r1 : r2;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          },
          fill: "#6366f1", stroke: "#6366f1", strokeWidth: 0.5,
        });
        agentGroup.add(gear);
        newSet.nodes.push(gear);

        const gearAnim = new Konva.Animation(() => {
          gear.rotation(gear.rotation() + 1.5);
        }, layer);
        gearAnim.start();
        newSet.animations.push(gearAnim);
      }

      if (status === "in_meeting") {
        // Just set stroke to green — no animations needed
        const body = agentGroup.getChildren().find(
          c => c instanceof Konva.Circle && (c as Konva.Circle).radius() === 28
        ) as Konva.Circle | undefined;
        if (body) {
          body.stroke("#22c55e");
          body.strokeWidth(3);
        }
      }

      if (status === "messaging") {
        // Blinking message icon
        const msgIcon = new Konva.RegularPolygon({
          x: 24, y: -24, sides: 4, radius: 8,
          fill: "#f59e0b", rotation: 45,
        });
        agentGroup.add(msgIcon);
        newSet.nodes.push(msgIcon);

        const blink = () => {
          const t1 = new Konva.Tween({
            node: msgIcon, opacity: 0, duration: 0.4,
            onFinish: () => {
              const t2 = new Konva.Tween({
                node: msgIcon, opacity: 1, duration: 0.4,
                onFinish: blink,
              });
              newSet.tweens.push(t2);
              t2.play();
            },
          });
          newSet.tweens.push(t1);
          t1.play();
        };
        blink();
      }

      if (status === "offline" || !agent.is_active) {
        const body = agentGroup.getChildren().find(
          c => c instanceof Konva.Circle && (c as Konva.Circle).radius() === 28
        ) as Konva.Circle | undefined;
        if (body) {
          body.fill("#2a2a3a");
        }
        agentGroup.opacity(0.5);
      }

      activeAnimations.current.set(agentId, newSet);
    });

    layer.batchDraw();
  }, [agents, layerRef, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupAll();
  }, [cleanupAll]);

  return { cleanupAll };
}

function getDeskPos(index: number) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 200 + col * 360, y: 300 + row * 280 };
}

function getMeetingChairPos(index: number, total: number) {
  const angle = (2 * Math.PI / Math.max(total, 1)) * index;
  return { x: 2250 + Math.cos(angle) * 320, y: 480 + Math.sin(angle) * 170 };
}

function getAgentExpectedPos(agent: Agent, allAgents: Agent[]) {
  const idx = allAgents.findIndex(a => a.id === agent.id);
  const deskPos = getDeskPos(idx);
  return { x: deskPos.x + 100, y: deskPos.y - 30 };
}

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
      onFinish: () => {
        line.destroy();
        layer.batchDraw();
      },
    }).play();
  }, 3000);
}
