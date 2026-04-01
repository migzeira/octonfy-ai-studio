import { Agent } from "@/hooks/useRealtimeAgents";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { meeting: any; agents: Agent[]; onClose: () => void; }

export function TranscriptModal({ meeting, agents, onClose }: Props) {
  const transcript = (meeting.transcript || []) as any[];
  const getAgent = (id: string) => agents.find((a) => a.id === id);
  const startTime = meeting.started_at ? new Date(meeting.started_at).getTime() : 0;
  const duration = meeting.started_at && meeting.ended_at
    ? Math.floor((new Date(meeting.ended_at).getTime() - new Date(meeting.started_at).getTime()) / 60000)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold">{meeting.title}</h2>
          <p className="text-sm text-muted-foreground">
            {meeting.created_at ? new Date(meeting.created_at).toLocaleDateString("pt-BR") : ""}
            {duration != null && ` · ${duration} minutos`}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-4">
        {transcript.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Nenhuma fala registrada</p>
        ) : transcript.map((entry: any, i: number) => {
          const agent = getAgent(entry.agent_id);
          const isUser = entry.agent_id === "user";
          return (
            <div key={i} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
              {!isUser && agent && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: agent.avatar_color || "#6366f1" }}>
                  {agent.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className={`max-w-[70%] ${isUser ? "text-right" : ""}`}>
                <p className="text-xs text-muted-foreground mb-1">{isUser ? "Você" : agent?.name || entry.agent_name || "Agente"}</p>
                <div className={`rounded-lg p-3 text-sm ${isUser ? "gradient-cta text-white" : "bg-card border border-border"}`}>
                  {entry.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
