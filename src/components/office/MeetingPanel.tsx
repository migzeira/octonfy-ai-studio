import { useState, useRef, useEffect } from "react";
import { Video, VideoOff, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/hooks/useRealtimeAgents";
import type { Meeting } from "@/hooks/useRealtimeMeetings";

interface MeetingPanelProps {
  agents: Agent[];
  activeMeeting: Meeting | null;
  workspaceId: string;
  onNewMeetingClick: () => void;
}

export default function MeetingPanel({ agents, activeMeeting, workspaceId, onNewMeetingClick }: MeetingPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const transcript: Array<{ agent_id: string; agent_name: string; content: string; timestamp: string }> =
    Array.isArray(activeMeeting?.transcript) ? activeMeeting.transcript as any : [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript.length]);

  const handleEndMeeting = async () => {
    if (!activeMeeting) return;
    await supabase.from("meetings").update({
      status: "completed", ended_at: new Date().toISOString(),
    }).eq("id", activeMeeting.id);

    // Reset agents
    const participantIds: string[] = activeMeeting.participants || [];
    for (const id of participantIds) {
      await supabase.from("agents").update({ status: "idle" }).eq("id", id);
    }

    toast({ title: "Reunião encerrada", description: "Resumo salvo nos documentos." });
  };

  const startedAt = activeMeeting?.started_at ? new Date(activeMeeting.started_at) : null;
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt?.getTime()]);

  if (!activeMeeting) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <Video className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-sm mb-4">Nenhuma reunião ativa</p>
        <Button onClick={onNewMeetingClick} className="bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white">
          Iniciar Reunião
        </Button>
      </div>
    );
  }

  const participantAgents = agents.filter(a => (activeMeeting.participants || []).includes(a.id));

  return (
    <div className="flex flex-col h-full">
      {/* Meeting header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-foreground">{activeMeeting.title}</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[rgba(34,197,94,0.15)]" style={{ color: "#22c55e" }}>
            Em andamento
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground font-mono">{elapsed}</span>
            <div className="flex -space-x-1 ml-2">
              {participantAgents.map(a => (
                <div key={a.id} className="w-5 h-5 rounded-full border border-background text-[8px] font-bold text-white flex items-center justify-center"
                  style={{ background: a.avatar_color || "#6366f1" }}>
                  {a.name.slice(0, 1)}
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleEndMeeting} className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-destructive text-destructive hover:bg-destructive/10">
            <VideoOff className="h-3 w-3" /> Encerrar
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {transcript.map((entry, i) => {
          const agent = agents.find(a => a.id === entry.agent_id);
          return (
            <div key={i} className="flex gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-1"
                style={{ background: agent?.avatar_color || "#6366f1" }}>
                {entry.agent_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">{entry.agent_name}</div>
                <div className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-border text-sm text-foreground">
                  {entry.content}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(entry.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        {transcript.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-4">
            Aguardando os agentes iniciarem a discussão...
          </div>
        )}
      </div>

      {/* Intervene input */}
      <div className="p-3 border-t border-border" style={{ background: "#0a0a0f" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Intervenha na reunião..."
            className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            rows={1}
            style={{ maxHeight: 80 }}
          />
          <button
            onClick={async () => {
              if (!input.trim()) return;
              await supabase.from("messages").insert({
                workspace_id: workspaceId, content: input.trim(), type: "meeting",
                meeting_id: activeMeeting.id,
              });
              setInput("");
            }}
            className="p-2 rounded-lg"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
