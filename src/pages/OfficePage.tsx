import { useState, useRef, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeAgents } from "@/hooks/useRealtimeAgents";
import { useRealtimeCredits } from "@/hooks/useRealtimeCredits";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useRealtimeMeetings } from "@/hooks/useRealtimeMeetings";
import { useFurnitureEditor } from "@/hooks/useFurnitureEditor";
import type { PlacedItem } from "@/hooks/useFurnitureEditor";
import { supabase } from "@/integrations/supabase/client";
import OfficeCanvas from "@/components/office/OfficeCanvas";
import OfficeEditorPanel from "@/components/office/OfficeEditorPanel";
import OfficeTopBar from "@/components/office/OfficeTopBar";
import ChatPanel from "@/components/office/ChatPanel";
import MeetingPanel from "@/components/office/MeetingPanel";
import StatusPanel from "@/components/office/StatusPanel";
import NewMeetingModal from "@/components/office/NewMeetingModal";
import HireAgentModal from "@/components/agents/HireAgentModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, User, Video, Loader2, Layers } from "lucide-react";
import type { Agent } from "@/hooks/useRealtimeAgents";

export default function OfficePage() {
  const { workspace, loading: wsLoading } = useWorkspace();

  // Loading guard — workspace not ready yet
  if (wsLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#0a0a0f" }}>
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Carregando escritório...</p>
        </div>
      </div>
    );
  }

  // No workspace — redirect to onboarding
  if (!workspace) {
    return <Navigate to="/onboarding" replace />;
  }

  return <OfficePageContent workspace={workspace} />;
}

interface WorkspaceData {
  id: string;
  name: string;
  mission: string | null;
  products: string | null;
  culture: string | null;
  additional_notes: string | null;
  plan: string | null;
  created_at: string | null;
}

function OfficePageContent({ workspace }: { workspace: WorkspaceData }) {
  const { agents, loading: agentsLoading } = useRealtimeAgents(workspace.id);
  const { credits } = useRealtimeCredits(workspace.id);
  const { messages } = useRealtimeMessages(workspace.id);
  const { activeMeeting } = useRealtimeMeetings(workspace.id);
  const {
    editorMode, selectedTool, setSelectedTool,
    placedItems, placeItem, removeItem, rotateItem, moveItem, clearAll, toggleEditor,
    floorTheme, setFloorTheme,
    customFloorColors, setZoneColor,
    addRoomTemplate,
  } = useFurnitureEditor(workspace.id);

  const [activeTab, setActiveTab] = useState<"chat" | "meeting" | "status">("chat");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hireOpen, setHireOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [agentPopup, setAgentPopup] = useState<{ agent: Agent; screenX: number; screenY: number } | null>(null);
  const [editingItem, setEditingItem] = useState<{ item: PlacedItem; screenX: number; screenY: number } | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setContainerSize({ width: e.contentRect.width, height: e.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAgentPopup(null);
        setMovingItemId(null);
        setEditingItem(null);
        if (editorMode) toggleEditor();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editorMode, toggleEditor]);

  // Send agent to rest (lounge) or back to work via Supabase status update
  const handleRestAgent = useCallback(async (agentId: string) => {
    await supabase.from("agents").update({ is_active: false, status: "idle" }).eq("id", agentId);
    setAgentPopup(null);
  }, []);

  const handleActivateAgent = useCallback(async (agentId: string) => {
    await supabase.from("agents").update({ is_active: true, status: "working" }).eq("id", agentId);
    setAgentPopup(null);
  }, []);

  const meetingParticipants: string[] = activeMeeting?.participants || [];

  const handleAgentClick = useCallback((agent: Agent, pos: { x: number; y: number }) => {
    setAgentPopup(prev => {
      if (prev?.agent.id === agent.id) return null;
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const screenX = (rect?.left || 0) + pos.x;
      const screenY = (rect?.top || 0) + pos.y + 56;
      return { agent, screenX, screenY };
    });
  }, []);

  const handleSelectAgentForChat = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setActiveTab("chat");
    setAgentPopup(null);
  };

  const handleCallMeeting = (agent: Agent) => {
    setAgentPopup(null);
    setMeetingOpen(true);
  };

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center h-screen page-enter" style={{ background: "#0a0a0f" }}>
        <div className="text-center space-y-4">
          <Skeleton className="w-48 h-6 mx-auto skeleton-shimmer" />
          <p className="text-muted-foreground text-sm">Carregando escritório...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "chat" as const, label: "Chat", icon: MessageSquare },
    { key: "meeting" as const, label: "Reunião", icon: Video },
    { key: "status" as const, label: "Status", icon: User },
  ];

  const popupLeft = agentPopup ? Math.min(agentPopup.screenX - (containerRef.current?.getBoundingClientRect().left || 0), containerSize.width - 240) : 0;
  const popupTop = agentPopup ? Math.min(agentPopup.screenY - (containerRef.current?.getBoundingClientRect().top || 0), containerSize.height - 220) : 0;

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden page-enter" style={{ background: "#0a0a0f" }}>
      <div className="flex-1 relative" ref={containerRef}>
        <OfficeTopBar
          workspaceName={workspace.name}
          creditBalance={credits?.balance ?? 0}
          workspaceId={workspace.id}
          onHireClick={() => setHireOpen(true)}
          onNewMeetingClick={() => setMeetingOpen(true)}
          onNewTaskClick={() => {}}
        />

        {/* Personalizar button (top-right of canvas area) */}
        <button
          onClick={toggleEditor}
          className={`absolute top-16 right-4 z-30 flex items-center gap-1.5 text-xs px-3 py-1.5
                      rounded-lg border transition-all font-medium
                      ${editorMode
                        ? "bg-primary/20 border-primary/60 text-primary"
                        : "bg-black/40 border-white/10 text-white/60 hover:text-white hover:border-white/30"}`}
        >
          <Layers className="h-3.5 w-3.5" />
          {editorMode ? "Sair do editor" : "Personalizar"}
        </button>

        <div className="w-full h-full pt-14">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-lg font-bold text-foreground mb-2">Seu escritório está vazio</h2>
              <p className="text-muted-foreground text-sm mb-4">Contrate o primeiro agente para começar</p>
              <Button onClick={() => setHireOpen(true)} className="gradient-cta text-white">
                Contratar Agente
              </Button>
            </div>
          ) : (
            <>
              <OfficeCanvas
                agents={agents}
                onAgentClick={handleAgentClick}
                selectedAgentId={agentPopup?.agent.id || null}
                meetingParticipants={meetingParticipants}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height - 56}
                placedItems={placedItems}
                editorMode={editorMode}
                selectedTool={selectedTool}
                onTileClick={placeItem}
                onPlacedItemClick={(item, sx, sy) => {
                  if (movingItemId) return; // ignore clicks when in move mode
                  const rect = containerRef.current?.getBoundingClientRect();
                  setEditingItem({ item, screenX: sx - (rect?.left ?? 0), screenY: sy - (rect?.top ?? 0) });
                }}
                floorTheme={floorTheme}
                movingItemId={movingItemId}
                onMoveItem={(id, col, row) => { moveItem(id, col, row); setMovingItemId(null); }}
                customFloorColors={customFloorColors}
              />
              {editorMode && (
                <OfficeEditorPanel
                  selectedTool={selectedTool}
                  onSelectTool={setSelectedTool}
                  onClearAll={clearAll}
                  onClose={toggleEditor}
                  floorTheme={floorTheme}
                  onSetFloorTheme={setFloorTheme}
                  customFloorColors={customFloorColors}
                  onSetZoneColor={setZoneColor}
                  onAddRoomTemplate={addRoomTemplate}
                />
              )}
              {/* Move-mode hint banner */}
              {movingItemId && editorMode && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2
                                bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs px-4 py-1.5
                                rounded-full backdrop-blur-sm pointer-events-none">
                  ✋ Clique no canvas para posicionar — Esc para cancelar
                </div>
              )}

              {/* Item edit popup (rotate / move / delete) */}
              {editingItem && editorMode && !movingItemId && (
                <>
                  <div className="absolute inset-0 z-25" onClick={() => setEditingItem(null)} />
                  <div
                    className="absolute z-40 glassmorphism rounded-xl p-3 space-y-1.5"
                    style={{ left: Math.max(8, editingItem.screenX - 80), top: Math.max(8, editingItem.screenY - 80) }}
                  >
                    <div className="text-[10px] text-white/50 font-mono text-center pb-1">{editingItem.item.type}</div>
                    <button
                      onClick={() => { rotateItem(editingItem.item.id); setEditingItem(null); }}
                      className="w-full flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg text-white hover:bg-white/10 transition-colors"
                    >
                      🔄 Girar 90°
                    </button>
                    <button
                      onClick={() => { setMovingItemId(editingItem.item.id); setEditingItem(null); }}
                      className="w-full flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg text-cyan-400 hover:bg-cyan-400/10 transition-colors"
                    >
                      ✋ Mover
                    </button>
                    <button
                      onClick={() => { removeItem(editingItem.item.id); setEditingItem(null); }}
                      className="w-full flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      🗑 Remover
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {agentPopup && (
          <>
            <div className="absolute inset-0 z-25" onClick={() => setAgentPopup(null)} />
            <div
              className="absolute z-30 glassmorphism rounded-xl p-4 w-56 space-y-3"
              style={{ left: Math.max(8, popupLeft), top: Math.max(8, popupTop) }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: agentPopup.agent.avatar_color || "#6366f1" }}>
                  {agentPopup.agent.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{agentPopup.agent.name}</div>
                  <div className="text-[10px] text-muted-foreground">{agentPopup.agent.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full"
                  style={{ background: agentPopup.agent.status === "idle" ? "#94a3b8" : agentPopup.agent.status === "thinking" ? "#3b82f6" : "#6366f1" }} />
                <span>{agentPopup.agent.status || "idle"}</span>
                <span>·</span>
                <span>⚡ {agentPopup.agent.credits_spent ?? 0}</span>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => handleSelectAgentForChat(agentPopup.agent)}
                  className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-foreground hover:bg-[#1e1e2e] transition-colors text-left">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" /> Enviar mensagem
                </button>
                <button onClick={() => setAgentPopup(null)}
                  className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-foreground hover:bg-[#1e1e2e] transition-colors text-left">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Ver perfil
                </button>
                <button onClick={() => handleCallMeeting(agentPopup.agent)}
                  className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-foreground hover:bg-[#1e1e2e] transition-colors text-left">
                  <Video className="h-3.5 w-3.5 text-green-400" /> Chamar para reunião
                </button>
                {/* Behavior controls — change agent status → FSM reacts in canvas */}
                {agentPopup.agent.is_active !== false ? (
                  <button onClick={() => handleRestAgent(agentPopup.agent.id)}
                    className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-amber-400 hover:bg-amber-400/10 transition-colors text-left">
                    🛋️ Mandar descansar
                  </button>
                ) : (
                  <button onClick={() => handleActivateAgent(agentPopup.agent.id)}
                    className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10 transition-colors text-left">
                    💼 Chamar para trabalhar
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="w-[360px] flex flex-col border-l border-border" style={{ background: "#111118" }}>
        <div className="flex border-b border-border">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === tab.key ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}>
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {activeTab === "chat" && (
            <ChatPanel agents={agents} messages={messages} workspaceId={workspace.id}
              selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
          )}
          {activeTab === "meeting" && (
            <MeetingPanel agents={agents} activeMeeting={activeMeeting}
              workspaceId={workspace.id} onNewMeetingClick={() => setMeetingOpen(true)} />
          )}
          {activeTab === "status" && (
            <StatusPanel agents={agents} workspaceId={workspace.id} />
          )}
        </div>
      </div>

      <HireAgentModal open={hireOpen} onClose={() => setHireOpen(false)} />
      <NewMeetingModal open={meetingOpen} onClose={() => setMeetingOpen(false)} agents={agents} workspaceId={workspace.id} />
    </div>
  );
}
