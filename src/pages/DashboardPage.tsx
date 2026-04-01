import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeCredits } from "@/hooks/useRealtimeCredits";
import { useRealtimeAgents } from "@/hooks/useRealtimeAgents";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Coins,
  Users,
  CheckSquare,
  Video,
  AlertTriangle,
  UserPlus,
  UserMinus,
  VideoOff,
  Plus,
  CheckCircle,
  FileText,
  MessageCircle,
  Radio,
  Clock,
  CreditCard,
  XCircle,
} from "lucide-react";

const eventIcons: Record<string, { icon: any; color: string }> = {
  hired: { icon: UserPlus, color: "#22c55e" },
  fired: { icon: UserMinus, color: "#ef4444" },
  meeting_started: { icon: Video, color: "#3b82f6" },
  meeting_ended: { icon: VideoOff, color: "#94a3b8" },
  task_created: { icon: Plus, color: "#6366f1" },
  task_completed: { icon: CheckCircle, color: "#22c55e" },
  document_created: { icon: FileText, color: "#3b82f6" },
  dm_sent: { icon: MessageCircle, color: "#f59e0b" },
  broadcast_sent: { icon: Radio, color: "#6366f1" },
  schedule_triggered: { icon: Clock, color: "#f97316" },
  credit_purchased: { icon: CreditCard, color: "#22c55e" },
  credit_low: { icon: AlertTriangle, color: "#ef4444" },
  error: { icon: XCircle, color: "#ef4444" },
};

const statusBadge: Record<string, { label: string; color: string; anim: string }> = {
  idle: { label: "Ocioso", color: "#94a3b8", anim: "animate-pulse" },
  thinking: { label: "Pensando", color: "#3b82f6", anim: "animate-spin" },
  working: { label: "Trabalhando", color: "#6366f1", anim: "animate-pulse" },
  in_meeting: { label: "Em Reunião", color: "#22c55e", anim: "" },
  messaging: { label: "Mensagens", color: "#f59e0b", anim: "animate-ping" },
  offline: { label: "Offline", color: "#4b5563", anim: "" },
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardPage() {
  const { workspace, loading: workspaceLoading } = useWorkspace();
  const { credits, loading: creditsLoading } = useRealtimeCredits(workspace?.id);
  const { agents, loading: agentsLoading } = useRealtimeAgents(workspace?.id);
  const { events, loading: eventsLoading } = useRealtimeEvents(workspace?.id);

  const [taskStats, setTaskStats] = useState({ inProgress: 0, todo: 0, doneToday: 0 });
  const [meetingsToday, setMeetingsToday] = useState({ total: 0, inProgress: 0 });
  const [chartData, setChartData] = useState<Array<{ name: string; total: number }>>([]);
  const [urgentTasks, setUrgentTasks] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (workspaceLoading) return;

    if (!workspace) {
      setTaskStats({ inProgress: 0, todo: 0, doneToday: 0 });
      setMeetingsToday({ total: 0, inProgress: 0 });
      setChartData([]);
      setUrgentTasks([]);
      setStatsLoading(false);
      return;
    }

    const fetchStats = async () => {
      setStatsLoading(true);

      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, status, completed_at, priority, due_date, title, assigned_to")
        .eq("workspace_id", workspace.id);

      if (tasks) {
        const today = new Date().toISOString().split("T")[0];
        setTaskStats({
          inProgress: tasks.filter((t) => t.status === "in_progress").length,
          todo: tasks.filter((t) => t.status === "todo").length,
          doneToday: tasks.filter(
            (t) => t.status === "done" && t.completed_at?.startsWith(today)
          ).length,
        });

        const now = new Date().toISOString();
        const urgent = tasks.filter(
          (t) =>
            t.status !== "done" &&
            (t.priority === "urgent" || (t.due_date && t.due_date < now))
        );
        setUrgentTasks(urgent.slice(0, 3));
      } else {
        setUrgentTasks([]);
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: meets } = await supabase
        .from("meetings")
        .select("status")
        .eq("workspace_id", workspace.id)
        .gte("created_at", todayStart.toISOString());

      if (meets) {
        setMeetingsToday({
          total: meets.length,
          inProgress: meets.filter((m) => m.status === "in_progress").length,
        });
      } else {
        setMeetingsToday({ total: 0, inProgress: 0 });
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: txns } = await supabase
        .from("transactions")
        .select("amount, created_at")
        .eq("workspace_id", workspace.id)
        .eq("type", "consumption")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at");

      if (txns && txns.length > 0) {
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const grouped: Record<string, number> = {};

        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          grouped[d.toISOString().split("T")[0]] = 0;
        }

        txns.forEach((t) => {
          const day = t.created_at?.split("T")[0] || "";
          if (day in grouped) grouped[day] += t.amount;
        });

        setChartData(
          Object.entries(grouped).map(([date, total]) => ({
            name: days[new Date(date).getDay()],
            total,
          }))
        );
      } else {
        setChartData([]);
      }

      setStatsLoading(false);
    };

    void fetchStats();
  }, [workspace, workspaceLoading]);

  const safeAgents = Array.isArray(agents) ? agents : [];
  const safeEvents = Array.isArray(events) ? events : [];
  const activeAgents = safeAgents.filter((a) => a.is_active);
  const creditBalance = credits?.balance ?? 0;
  const totalPurchased = credits?.total_purchased ?? 0;
  const totalConsumed = credits?.total_consumed ?? 0;
  const creditPercent = (creditBalance / Math.max(creditBalance + totalConsumed, 1)) * 100;
  const creditColor = creditPercent > 50 ? "#22c55e" : creditPercent > 20 ? "#f59e0b" : "#ef4444";
  const chartMax = Math.max(...chartData.map((item) => item.total), 1);

  if (workspaceLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-2xl font-bold mb-2">Preparando seu dashboard</h1>
          <p className="text-muted-foreground">Seu workspace está sendo configurado automaticamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{getGreeting()}, {workspace.name}</h1>
          <p className="text-muted-foreground">Aqui está o resumo do seu escritório</p>
        </div>
        <Button className="gradient-cta border-0" asChild>
          <Link to="/office">
            <Building2 className="h-4 w-4 mr-2" />
            Entrar no Escritório
          </Link>
        </Button>
      </div>

      {creditBalance < 100 && (
        <div className="rounded-lg border p-4 flex items-center justify-between" style={{ background: "rgba(239,68,68,0.1)", borderColor: "#ef4444" }}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" style={{ color: "#ef4444" }} />
            <span className="text-sm">⚠ Créditos baixos — você tem apenas <strong>{creditBalance}</strong> créditos.</span>
          </div>
          <Button size="sm" variant="destructive" asChild>
            <Link to="/credits">Recarregar</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          {creditsLoading ? <Skeleton className="h-20 w-full" /> : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Coins className="h-5 w-5" style={{ color: "#f59e0b" }} />
                <span className="text-sm text-muted-foreground">Créditos Disponíveis</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: creditColor }}>{creditBalance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">de {totalPurchased.toLocaleString()} comprados</p>
              <div className="mt-3 h-2 rounded-full overflow-hidden bg-muted">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${creditPercent}%`, background: creditColor }} />
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          {agentsLoading ? <Skeleton className="h-20 w-full" /> : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Agentes Ativos</span>
              </div>
              <p className="text-3xl font-bold">{activeAgents.length} <span className="text-lg text-muted-foreground">/ {safeAgents.length}</span></p>
              <p className="text-xs text-muted-foreground mt-1">agentes trabalhando</p>
              <div className="flex gap-1 mt-3">
                {activeAgents.slice(0, 8).map((a) => (
                  <div key={a.id} className="w-3 h-3 rounded-full animate-pulse" style={{ background: a.avatar_color || "#6366f1" }} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          {statsLoading ? <Skeleton className="h-20 w-full" /> : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <CheckSquare className="h-5 w-5" style={{ color: "#6366f1" }} />
                <span className="text-sm text-muted-foreground">Tarefas em Andamento</span>
              </div>
              <p className="text-3xl font-bold">{taskStats.inProgress}</p>
              <p className="text-xs text-muted-foreground mt-1">{taskStats.todo} a fazer · {taskStats.doneToday} concluídas hoje</p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          {statsLoading ? <Skeleton className="h-20 w-full" /> : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Video className="h-5 w-5" style={{ color: "#22c55e" }} />
                <span className="text-sm text-muted-foreground">Reuniões Hoje</span>
              </div>
              <p className="text-3xl font-bold">{meetingsToday.total}</p>
              <p className="text-xs text-muted-foreground mt-1">{meetingsToday.inProgress} em andamento agora</p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Consumo de créditos — últimos 7 dias</h3>
          {statsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Nenhum consumo registrado ainda</div>
          ) : (
            <div className="space-y-3">
              {chartData.map((day) => (
                <div key={day.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{day.name}</span>
                    <span className="text-muted-foreground">{day.total} créditos</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(day.total / chartMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Status dos agentes</h3>
            <Link to="/agents" className="text-xs text-primary hover:underline">Ver todos →</Link>
          </div>
          {agentsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : safeAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agente ainda</p>
          ) : (
            <div className="space-y-3">
              {safeAgents.slice(0, 5).map((agent) => {
                const st = statusBadge[agent.status || "idle"] || statusBadge.idle;
                return (
                  <div key={agent.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: agent.avatar_color || "#6366f1" }}>
                      {agent.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs" style={{ background: `${st.color}20`, color: st.color }}>
                      <div className={`w-1.5 h-1.5 rounded-full ${st.anim}`} style={{ background: st.color }} />
                      {st.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Atividade recente</h3>
          {eventsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : safeEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {safeEvents.map((ev) => {
                const ei = eventIcons[ev.event_type] || { icon: Clock, color: "#94a3b8" };
                const Icon = ei.icon;
                return (
                  <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${ei.color}20` }}>
                      <Icon className="h-4 w-4" style={{ color: ei.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{ev.description}</p>
                      <p className="text-xs text-muted-foreground">{ev.actor === "user" ? "Você" : ev.actor} · {timeAgo(ev.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {urgentTasks.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Tarefas que precisam de atenção</h3>
              <Link to="/tasks" className="text-xs text-primary hover:underline">Ver todas →</Link>
            </div>
            <div className="space-y-3">
              {urgentTasks.map((task) => {
                const overdue = task.due_date && task.due_date < new Date().toISOString();
                return (
                  <div key={task.id || task.title} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {task.priority === "urgent" && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>Urgente</span>}
                      {overdue && <span className="text-xs" style={{ color: "#ef4444" }}>Vencida</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
