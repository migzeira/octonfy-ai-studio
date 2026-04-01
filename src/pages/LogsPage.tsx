import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeAgents } from "@/hooks/useRealtimeAgents";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Activity, Download, ChevronDown } from "lucide-react";
import { EventLog } from "@/hooks/useRealtimeEvents";

const EVENT_COLORS: Record<string, string> = {
  hired: "#22c55e", fired: "#ef4444", meeting_started: "#3b82f6", meeting_ended: "#3b82f6",
  task_created: "#6366f1", task_completed: "#22c55e", task_updated: "#6366f1",
  document_created: "#06b6d4", dm_sent: "#f59e0b", broadcast_sent: "#f59e0b",
  schedule_triggered: "#f97316", schedule_created: "#f97316",
  credit_purchased: "#22c55e", credit_low: "#ef4444",
  integration_connected: "#a855f7", error: "#ef4444",
};
const EVENT_EMOJIS: Record<string, string> = {
  hired: "👤", fired: "🚪", meeting_started: "🎥", meeting_ended: "🎥",
  task_created: "✅", task_completed: "✅", task_updated: "✅",
  document_created: "📄", dm_sent: "💬", broadcast_sent: "💬",
  schedule_triggered: "⏰", schedule_created: "⏰",
  credit_purchased: "💳", credit_low: "💳",
  integration_connected: "🔌", error: "❌",
};
const TYPE_PILLS = [
  { key: "hired", label: "👤 Contratações" }, { key: "fired", label: "🚪 Demissões" },
  { key: "meeting", label: "🎥 Reuniões" }, { key: "task", label: "✅ Tarefas" },
  { key: "dm_sent,broadcast_sent", label: "💬 Mensagens" }, { key: "document", label: "📄 Documentos" },
  { key: "schedule", label: "⏰ Agendamentos" }, { key: "credit", label: "💳 Créditos" },
  { key: "integration", label: "🔌 Integrações" }, { key: "error", label: "❌ Erros" },
];
const DATE_RANGES = [
  { key: "24h", label: "Últimas 24h" }, { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" }, { key: "all", label: "Tudo" },
];

export default function LogsPage() {
  const { workspace, loading: wsLoading } = useWorkspace();

  if (wsLoading || !workspace) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      </div>
    );
  }
  const { agents } = useRealtimeAgents(workspace?.id);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("7d");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [expandedMeta, setExpandedMeta] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 30;

  const getDateFilter = () => {
    const now = new Date();
    if (dateRange === "24h") { now.setHours(now.getHours() - 24); return now.toISOString(); }
    if (dateRange === "7d") { now.setDate(now.getDate() - 7); return now.toISOString(); }
    if (dateRange === "30d") { now.setDate(now.getDate() - 30); return now.toISOString(); }
    return null;
  };

  const fetchEvents = useCallback(async (offset = 0, append = false) => {
    if (!workspace?.id) return;
    let query = supabase.from("event_logs").select("*").eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
    const dateFilter = getDateFilter();
    if (dateFilter) query = query.gte("created_at", dateFilter);
    if (search) query = query.ilike("description", `%${search}%`);

    const { data } = await query;
    if (data) {
      let filtered = data as EventLog[];
      if (typeFilters.length > 0) {
        filtered = filtered.filter((e) => typeFilters.some((tf) => e.event_type.includes(tf)));
      }
      if (append) setEvents((prev) => [...prev, ...filtered]);
      else setEvents(filtered);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [workspace?.id, search, dateRange, typeFilters]);

  useEffect(() => { setLoading(true); fetchEvents(0, false); }, [fetchEvents]);

  const loadMore = () => { if (hasMore) fetchEvents(events.length, true); };

  const toggleTypeFilter = (key: string) => {
    setTypeFilters((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  };

  const exportCSV = () => {
    const headers = "data,hora,tipo,ator,alvo,descricao\n";
    const rows = events.map((e) => {
      const d = e.created_at ? new Date(e.created_at) : new Date();
      return `${d.toLocaleDateString("pt-BR")},${d.toLocaleTimeString("pt-BR")},${e.event_type},${e.actor},${e.target || ""},${e.description.replace(/,/g, ";")}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `octonfy-logs-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getColor = (type: string) => {
    for (const [key, color] of Object.entries(EVENT_COLORS)) {
      if (type.includes(key)) return color;
    }
    return "#94a3b8";
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logs de Eventos</h1>
          <p className="text-muted-foreground">Histórico completo de atividades · {events.length} eventos</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Exportar CSV</Button>
      </div>

      {/* Filters */}
      <div className="space-y-3 sticky top-0 z-10 bg-background pb-3">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar eventos..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {DATE_RANGES.map((d) => (
              <button key={d.key} onClick={() => setDateRange(d.key)} className={`px-3 py-1 rounded-full text-xs transition-all ${dateRange === d.key ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>{d.label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {TYPE_PILLS.map((p) => (
            <button key={p.key} onClick={() => toggleTypeFilter(p.key)} className={`px-2 py-1 rounded-full text-xs transition-all ${typeFilters.includes(p.key) ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Activity className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-xl font-bold">Nenhum evento encontrado</h2>
          {typeFilters.length > 0 && <p className="text-muted-foreground text-sm">Tente remover alguns filtros</p>}
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {events.map((e) => {
              const color = getColor(e.event_type);
              const emoji = Object.entries(EVENT_EMOJIS).find(([k]) => e.event_type.includes(k))?.[1] || "📋";
              return (
                <div key={e.id} className="relative pl-12">
                  <div className="absolute left-3 top-3 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: `${color}30`, color }}>{emoji}</div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold" style={{ color }}>{e.event_type.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{e.created_at ? new Date(e.created_at).toLocaleString("pt-BR") : ""}</span>
                    </div>
                    <p className="text-sm mt-1">{e.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>👤 {e.actor}</span>
                      {e.target && <span>→ {e.target}</span>}
                    </div>
                    {e.metadata && Object.keys(e.metadata as object).length > 0 && (
                      <div className="mt-2">
                        <button onClick={() => setExpandedMeta(expandedMeta === e.id ? null : e.id)} className="text-xs text-primary flex items-center gap-1">
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedMeta === e.id ? "rotate-180" : ""}`} /> ver detalhes
                        </button>
                        {expandedMeta === e.id && (
                          <pre className="mt-2 text-xs bg-background p-2 rounded overflow-x-auto">{JSON.stringify(e.metadata, null, 2)}</pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <div ref={loaderRef} className="flex justify-center py-4">
              <Button variant="ghost" onClick={loadMore}>Carregar mais</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
