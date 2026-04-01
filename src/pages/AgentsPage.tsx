import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeAgents, Agent } from "@/hooks/useRealtimeAgents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Users, Search, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import HireAgentModal from "@/components/agents/HireAgentModal";
import EditAgentModal from "@/components/agents/EditAgentModal";
import FireAgentModal from "@/components/agents/FireAgentModal";

const MODEL_COLORS: Record<string, string> = {
  "claude-haiku": "#22c55e",
  "llama-groq": "#f59e0b",
  "gemini-pro": "#06b6d4",
  "claude-sonnet": "#6366f1",
  "gpt-4o": "#3b82f6",
  "claude-opus": "#a855f7",
};

const statusStyles: Record<string, { ring: string; anim: string }> = {
  thinking: { ring: "#3b82f6", anim: "animate-spin" },
  working: { ring: "#6366f1", anim: "animate-pulse" },
  in_meeting: { ring: "#22c55e", anim: "" },
};

const statusBadge: Record<string, { label: string; color: string }> = {
  idle: { label: "Ocioso", color: "#94a3b8" },
  thinking: { label: "Pensando", color: "#3b82f6" },
  working: { label: "Trabalhando", color: "#6366f1" },
  in_meeting: { label: "Em Reunião", color: "#22c55e" },
  messaging: { label: "Mensagens", color: "#f59e0b" },
  offline: { label: "Offline", color: "#4b5563" },
};

export default function AgentsPage() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const { agents, loading } = useRealtimeAgents(workspace?.id);

  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [modelFilter, setModelFilter] = useState("");
  const [search, setSearch] = useState("");
  const [hireOpen, setHireOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [fireAgent, setFireAgent] = useState<Agent | null>(null);

  if (wsLoading || !workspace) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [modelFilter, setModelFilter] = useState("");
  const [search, setSearch] = useState("");
  const [hireOpen, setHireOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [fireAgent, setFireAgent] = useState<Agent | null>(null);

  const filtered = agents.filter((a) => {
    if (filter === "active" && !a.is_active) return false;
    if (filter === "inactive" && a.is_active) return false;
    if (modelFilter && a.model !== modelFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return a.name.toLowerCase().includes(s) || a.role.toLowerCase().includes(s);
    }
    return true;
  });

  const activeCount = agents.filter((a) => a.is_active).length;
  const models = [...new Set(agents.map((a) => a.model).filter(Boolean))];

  const handleToggleActive = async (agent: Agent) => {
    const newActive = !agent.is_active;
    await supabase
      .from("agents")
      .update({ is_active: newActive, status: newActive ? "idle" : "offline" })
      .eq("id", agent.id);

    toast({
      title: newActive ? `${agent.name} ativado` : `${agent.name} desativado`,
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agentes</h1>
          <p className="text-muted-foreground">
            {agents.length} agentes · {activeCount} ativos
          </p>
        </div>
        <Button className="gradient-cta border-0" onClick={() => setHireOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Contratar Agente
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {(["all", "active", "inactive"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm transition-all ${
              filter === f
                ? "gradient-cta text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Inativos"}
          </button>
        ))}
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
        >
          <option value="">Todos os modelos</option>
          {models.map((m) => (
            <option key={m} value={m!}>{m}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou cargo..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 && agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
            <Users className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">Seu escritório está vazio</h2>
          <p className="text-muted-foreground">Contrate seu primeiro agente para começar</p>
          <Button className="gradient-cta border-0" onClick={() => setHireOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Contratar Agente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((agent) => {
            const st = statusBadge[agent.status || "idle"] || statusBadge.idle;
            const ringStyle = statusStyles[agent.status || ""];
            const modelColor = MODEL_COLORS[agent.model || ""] || "#94a3b8";

            return (
              <div
                key={agent.id}
                className="rounded-xl border border-border bg-card p-5 group hover:glow-neon transition-all relative"
              >
                {/* Model badge */}
                <span
                  className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${modelColor}20`, color: modelColor }}
                >
                  {agent.model}
                </span>

                {/* Status badge */}
                <span
                  className="absolute top-3 right-3 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: `${st.color}20`, color: st.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                  {st.label}
                </span>

                {/* Avatar */}
                <div className="flex justify-center mt-6 mb-4">
                  <div className="relative">
                    {ringStyle && (
                      <div
                        className={`absolute -inset-1.5 rounded-full border-2 ${ringStyle.anim}`}
                        style={{ borderColor: ringStyle.ring }}
                      />
                    )}
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white"
                      style={{ background: agent.avatar_color || "#6366f1" }}
                    >
                      {agent.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="text-center mb-3">
                  <p className="text-lg font-bold">{agent.name}</p>
                  <p className="text-sm text-muted-foreground">{agent.role}</p>
                  {agent.specialty && (
                    <p className="text-xs text-muted-foreground italic mt-1">{agent.specialty}</p>
                  )}
                </div>

                <div className="border-t border-border my-3" />

                {/* Metrics */}
                <div className="grid grid-cols-3 text-center text-xs">
                  <div>
                    <p className="font-semibold">{agent.messages_count || 0}</p>
                    <p className="text-muted-foreground">💬 msgs</p>
                  </div>
                  <div>
                    <p className="font-semibold">{agent.tasks_completed || 0}</p>
                    <p className="text-muted-foreground">✅ tarefas</p>
                  </div>
                  <div>
                    <p className="font-semibold">{agent.credits_spent || 0}</p>
                    <p className="text-muted-foreground">⚡ créditos</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditAgent(agent)}>
                    Editar
                  </Button>
                  <Button
                    variant={agent.is_active ? "ghost" : "default"}
                    size="sm"
                    className={agent.is_active ? "" : "bg-success/20 text-success hover:bg-success/30"}
                    onClick={() => handleToggleActive(agent)}
                  >
                    {agent.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setFireAgent(agent)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <HireAgentModal open={hireOpen} onClose={() => setHireOpen(false)} />
      {editAgent && <EditAgentModal agent={editAgent} onClose={() => setEditAgent(null)} />}
      {fireAgent && <FireAgentModal agent={fireAgent} onClose={() => setFireAgent(null)} />}
    </div>
  );
}
