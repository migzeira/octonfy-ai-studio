import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Agent } from "@/hooks/useRealtimeAgents";

const STATUS_COLORS: Record<string, string> = {
  idle: "#94a3b8", thinking: "#3b82f6", working: "#6366f1",
  in_meeting: "#22c55e", messaging: "#f59e0b", offline: "#4a4a5a",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Ocioso", thinking: "Pensando", working: "Trabalhando",
  in_meeting: "Em reunião", messaging: "Mensagens", offline: "Offline",
};

interface StatusPanelProps {
  agents: Agent[];
  workspaceId: string;
}

export default function StatusPanel({ agents, workspaceId }: StatusPanelProps) {
  const toggleAgent = async (agent: Agent) => {
    const newActive = !agent.is_active;
    await supabase.from("agents").update({
      is_active: newActive,
      status: newActive ? "idle" : "offline",
    }).eq("id", agent.id);
    toast({
      title: newActive ? `${agent.name} ativado` : `${agent.name} desativado`,
    });
  };

  return (
    <div className="flex flex-col h-full p-3 space-y-4 overflow-y-auto">
      <h3 className="text-sm font-bold text-foreground">Status dos Agentes</h3>
      <div className="space-y-2">
        {agents.map(agent => {
          const status = agent.status || "idle";
          const color = STATUS_COLORS[status] || "#94a3b8";
          return (
            <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg bg-card border border-border">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: agent.avatar_color || "#6366f1" }}>
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{agent.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{agent.role}</div>
              </div>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                style={{ background: `${color}20`, color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {STATUS_LABELS[status] || status}
              </span>
              <Switch
                checked={agent.is_active ?? true}
                onCheckedChange={() => toggleAgent(agent)}
              />
            </div>
          );
        })}
      </div>

      {agents.length === 0 && (
        <div className="text-center text-muted-foreground text-sm mt-8">
          Nenhum agente contratado ainda.
        </div>
      )}

      <div className="mt-4">
        <Link to="/tasks" className="text-xs text-primary hover:underline">
          Ver todas as tarefas →
        </Link>
      </div>
    </div>
  );
}
