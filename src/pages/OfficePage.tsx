import { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeAgents } from "@/hooks/useRealtimeAgents";
import { useRealtimeCredits } from "@/hooks/useRealtimeCredits";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useRealtimeMeetings } from "@/hooks/useRealtimeMeetings";
import OfficeCanvas from "@/components/office/OfficeCanvas";
import OfficeTopBar from "@/components/office/OfficeTopBar";
import ChatPanel from "@/components/office/ChatPanel";
import MeetingPanel from "@/components/office/MeetingPanel";
import StatusPanel from "@/components/office/StatusPanel";
import NewMeetingModal from "@/components/office/NewMeetingModal";
import HireAgentModal from "@/components/agents/HireAgentModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, User, Video } from "lucide-react";
import type { Agent } from "@/hooks/useRealtimeAgents";

export default function OfficePage() {
  const { workspace } = useWorkspace();
  const { agents, loading: agentsLoading } = useRealtimeAgents(workspace?.id);
  const { credits } = useRealtimeCredits(workspace?.id);
  const { messages } = useRealtimeMessages(workspace?.id);
  const { activeMeeting } = useRealtimeMeetings(workspace?.id);

  const [activeTab, setActiveTab] = useState<"chat" | "meeting" | "status">("chat");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hireOpen, setHireOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [agentPopup, setAgentPopup] = useState<{ agent: Agent; screenX: number; screenY: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // ResizeObserver for canvas responsiveness
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

  // Close popup with ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAgentPopup(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const meetingParticipants: string[] = activeMeeting?.participants || [];

  const handleAgentClick = useCallback((agent: Agent, pos: { x: number; y: number }) => {
    setAgentPopup(prev => {
      if (prev?.agent.id === agent.id) return null;
      // pos is relative to stage pointer position
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const screenX = (rect?.left || 0) + pos.x;
      const screenY = (rect?.top || 0) + pos.y + 56; // account for top bar
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

  // Calculate popup position within screen bounds
  const popupLeft = agentPopup ? Math.min(agentPopup.screenX - (containerRef.current?.getBoundingClientRect().left || 0), containerSize.width - 240) : 0;
  const popupTop = agentPopup ? Math.min(agentPopup.screenY - (containerRef.current?.getBoundingClientRect().top || 0), containerSize.height - 220) : 0;

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden page-enter" style={{ background: "#0a0a0f" }}>
      {/* Left panel - Canvas */}
      <div className="flex-1 relative" ref={containerRef}>
        <OfficeTopBar
          workspaceName={workspace?.name || "Escritório"}
          creditBalance={credits?.balance ?? 0}
          workspaceId={workspace?.id || ""}
          onHireClick={() => setHireOpen(true)}
          onNewMeetingClick={() => setMeetingOpen(true)}
          onNewTaskClick={() => {}}
        />

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
            <OfficeCanvas
              agents={agents}
              onAgentClick={handleAgentClick}
              selectedAgentId={agentPopup?.agent.id || null}
              meetingParticipants={meetingParticipants}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height - 56}
            />
          )}
        </div>

        {/* Agent popup — HTML overlay */}
        {agentPopup && (
          <>
            {/* Invisible overlay to close */}
            <div
              className="absolute inset-0 z-25"
              onClick={() => setAgentPopup(null)}
            />
            <div
              className="absolute z-30 glassmorphism rounded-xl p-4 w-56 space-y-3"
              style={{
                left: Math.max(8, popupLeft),
                top: Math.max(8, popupTop),
              }}
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
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: agentPopup.agent.status === "idle" ? "#94a3b8" : agentPopup.agent.status === "thinking" ? "#3b82f6" : "#6366f1" }}
                />
                <span>{agentPopup.agent.status || "idle"}</span>
                <span>·</span>
                <span>⚡ {agentPopup.agent.credits_spent ?? 0}</span>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleSelectAgentForChat(agentPopup.agent)}
                  className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-foreground hover:bg-[#1e1e2e] transition-colors text-left"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  Enviar mensagem
                </button>
                <button
                  onClick={() => { setAgentPopup(null); }}
                  className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-foreground hover:bg-[#1e1e2e] transition-colors text-left"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Ver perfil
                </button>
                <button
                  onClick={() => handleCallMeeting(agentPopup.agent)}
                  className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-foreground hover:bg-[#1e1e2e] transition-colors text-left"
                >
                  <Video className="h-3.5 w-3.5 text-green-400" />
                  Chamar para reunião
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right panel */}
      <div className="w-[360px] flex flex-col border-l border-border" style={{ background: "#111118" }}>
        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === tab.key
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "chat" && (
            <ChatPanel
              agents={agents}
              messages={messages}
              workspaceId={workspace?.id || ""}
              selectedAgentId={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
            />
          )}
          {activeTab === "meeting" && (
            <MeetingPanel
              agents={agents}
              activeMeeting={activeMeeting}
              workspaceId={workspace?.id || ""}
              onNewMeetingClick={() => setMeetingOpen(true)}
            />
          )}
          {activeTab === "status" && (
            <StatusPanel agents={agents} workspaceId={workspace?.id || ""} />
          )}
        </div>
      </div>

      {/* Modals */}
      <HireAgentModal open={hireOpen} onClose={() => setHireOpen(false)} />
      <NewMeetingModal open={meetingOpen} onClose={() => setMeetingOpen(false)} agents={agents} workspaceId={workspace?.id || ""} />
    </div>
  );
}
