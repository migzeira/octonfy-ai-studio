import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeAgents } from "@/hooks/useRealtimeAgents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, PenLine, BarChart, FileText, Trash2, Pencil, Clock, Play,
  CalendarClock, Zap, Loader2, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Schedule {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  agent_id: string | null;
  instruction: string;
  frequency: string;
  scheduled_time: string | null;
  scheduled_days: string[] | null;
  cron_expression: string | null;
  is_active: boolean | null;
  last_run: string | null;
  next_run: string | null;
  run_count: number | null;
  created_at: string | null;
}

const FREQ_OPTIONS = ["once", "daily", "weekly", "monthly", "custom"];
const FREQ_LABELS: Record<string, string> = {
  once: "Uma vez",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  custom: "Cron",
};
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const SUGGESTIONS = [
  {
    name: "Post diário de conteúdo",
    icon: PenLine,
    desc: "Todo dia às 8h, agente de conteúdo cria um post",
    instruction: "Crie um post para as redes sociais sobre nosso produto principal. Inclua uma legenda criativa e sugestões de hashtags.",
    frequency: "daily",
    time: "08:00",
  },
  {
    name: "Review semanal do CEO",
    icon: BarChart,
    desc: "Toda segunda às 9h, CEO revisa tarefas",
    instruction: "Revise todas as tarefas pendentes e em andamento, analise a produtividade da equipe e faça um resumo executivo com recomendações.",
    frequency: "weekly",
    time: "09:00",
  },
  {
    name: "Relatório diário",
    icon: FileText,
    desc: "Todo dia às 18h, relatório de produtividade",
    instruction: "Gere um relatório completo de produtividade do dia incluindo tarefas concluídas, pendentes, mensagens trocadas e métricas gerais.",
    frequency: "daily",
    time: "18:00",
  },
];

export default function SchedulesPage() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const { agents } = useRealtimeAgents(workspace?.id);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteSchedule, setDeleteSchedule] = useState<Schedule | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAgent, setFormAgent] = useState("");
  const [formInstruction, setFormInstruction] = useState("");
  const [formFreq, setFormFreq] = useState("daily");
  const [formTime, setFormTime] = useState("08:00");
  const [formDate, setFormDate] = useState("");
  const [formDays, setFormDays] = useState<string[]>([]);
  const [formMonthDay, setFormMonthDay] = useState("1");
  const [formCron, setFormCron] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSchedules = useCallback(async () => {
    if (!workspace?.id) return;
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });
    if (data) setSchedules(data as Schedule[]);
    setLoading(false);
  }, [workspace?.id]);

  // Initial fetch
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Realtime subscription
  useEffect(() => {
    if (!workspace?.id) return;
    const channel = supabase
      .channel("schedules-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedules", filter: `workspace_id=eq.${workspace.id}` },
        () => fetchSchedules()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspace?.id, fetchSchedules]);

  // Stats
  const activeCount = useMemo(() => schedules.filter((s) => s.is_active).length, [schedules]);
  const totalRuns = useMemo(() => schedules.reduce((sum, s) => sum + (s.run_count || 0), 0), [schedules]);
  const todayRuns = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return schedules.filter((s) => s.last_run && s.last_run.slice(0, 10) === today).length;
  }, [schedules]);

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormAgent("");
    setFormInstruction("");
    setFormFreq("daily");
    setFormTime("08:00");
    setFormDate("");
    setFormDays([]);
    setFormMonthDay("1");
    setFormCron("");
    setEditingId(null);
  };

  const openCreate = (suggestion?: (typeof SUGGESTIONS)[0]) => {
    resetForm();
    if (suggestion) {
      setFormName(suggestion.name);
      setFormInstruction(suggestion.instruction);
      setFormFreq(suggestion.frequency);
      setFormTime(suggestion.time);
    }
    setModalOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditingId(s.id);
    setFormName(s.name);
    setFormDesc(s.description || "");
    setFormAgent(s.agent_id || "");
    setFormInstruction(s.instruction);
    setFormFreq(s.frequency);
    setFormTime(s.scheduled_time || "08:00");
    setFormDays(s.scheduled_days || []);
    setFormCron(s.cron_expression || "");
    setFormDate("");
    setFormMonthDay("1");
    setModalOpen(true);
  };

  const calcNextRun = () => {
    const now = new Date();
    const [h, m] = formTime.split(":").map(Number);

    if (formFreq === "once" && formDate) {
      return new Date(formDate + "T" + formTime).toISOString();
    }

    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    if (formFreq === "weekly" && formDays.length > 0) {
      const dayMap: Record<string, number> = { Dom: 0, Seg: 1, Ter: 2, Qua: 3, Qui: 4, Sex: 5, "Sáb": 6 };
      const targetDays = formDays.map((d) => dayMap[d] ?? -1).filter((d) => d >= 0).sort((a, b) => a - b);
      const currentDay = now.getDay();
      let nextDay = targetDays.find((d) => d > currentDay);
      let daysToAdd: number;
      if (nextDay !== undefined) {
        daysToAdd = nextDay - currentDay;
      } else {
        daysToAdd = 7 - currentDay + targetDays[0];
      }
      const weekNext = new Date(now);
      weekNext.setDate(weekNext.getDate() + daysToAdd);
      weekNext.setHours(h, m, 0, 0);
      return weekNext.toISOString();
    }

    return next.toISOString();
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: "Preencha o nome do agendamento", variant: "destructive" });
      return;
    }
    if (!formInstruction.trim()) {
      toast({ title: "Preencha a instrução para o agente", variant: "destructive" });
      return;
    }
    if (!formAgent) {
      toast({ title: "Selecione um agente responsável", description: "O agendamento precisa de um agente para executar a instrução", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      workspace_id: workspace!.id,
      name: formName.trim(),
      description: formDesc.trim() || null,
      agent_id: formAgent,
      instruction: formInstruction.trim(),
      frequency: formFreq,
      scheduled_time: formTime || null,
      scheduled_days: formFreq === "weekly" ? formDays : null,
      cron_expression: formFreq === "custom" ? formCron : null,
      next_run: calcNextRun(),
      is_active: true,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("schedules").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("event_logs").insert({
          workspace_id: workspace!.id,
          event_type: "schedule_updated",
          actor: "Você",
          target: formName.trim(),
          description: `Agendamento "${formName.trim()}" atualizado`,
        });
        toast({ title: "✓ Agendamento atualizado" });
      } else {
        const { error } = await supabase.from("schedules").insert(payload);
        if (error) throw error;
        await supabase.from("event_logs").insert({
          workspace_id: workspace!.id,
          event_type: "schedule_created",
          actor: "Você",
          target: formName.trim(),
          description: `Agendamento "${formName.trim()}" criado`,
        });
        toast({ title: "✓ Agendamento criado" });
      }
      setModalOpen(false);
      resetForm();
      fetchSchedules();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s: Schedule) => {
    const newActive = !s.is_active;
    const update: any = { is_active: newActive };

    // If reactivating and next_run is in the past, recalculate
    if (newActive && s.scheduled_time) {
      const now = new Date();
      const [h, m] = s.scheduled_time.split(":").map(Number);
      const next = new Date(now);
      next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      update.next_run = next.toISOString();
    }

    await supabase.from("schedules").update(update).eq("id", s.id);
    toast({ title: newActive ? "Agendamento ativado" : "Agendamento pausado" });
    fetchSchedules();
  };

  const handleDelete = async () => {
    if (!deleteSchedule) return;
    await supabase.from("schedules").delete().eq("id", deleteSchedule.id);
    await supabase.from("event_logs").insert({
      workspace_id: workspace!.id,
      event_type: "schedule_deleted",
      actor: "Você",
      target: deleteSchedule.name,
      description: `Agendamento "${deleteSchedule.name}" excluído`,
    });
    toast({ title: "Agendamento excluído" });
    setDeleteSchedule(null);
    fetchSchedules();
  };

  const handleRunNow = async (s: Schedule) => {
    if (!s.agent_id) {
      toast({ title: "Agendamento sem agente", description: "Edite e selecione um agente antes de executar", variant: "destructive" });
      return;
    }
    setRunningId(s.id);
    try {
      // Temporarily set next_run to now so check-schedules picks it up
      await supabase.from("schedules").update({
        next_run: new Date().toISOString(),
        is_active: true,
      }).eq("id", s.id);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await supabase.functions.invoke("check-schedules", {
        body: {},
      });

      if (res.error) throw new Error(res.error.message);

      const data = res.data as any;
      const result = data?.results?.find((r: any) => r.id === s.id);

      if (result?.status === "ok") {
        toast({ title: "✓ Agendamento executado!", description: `"${s.name}" foi disparado com sucesso` });
      } else if (result?.status === "error") {
        toast({ title: "Erro na execução", description: result.error || "Erro desconhecido", variant: "destructive" });
      } else {
        toast({ title: "Agendamento disparado", description: "Verifique os logs para o resultado" });
      }

      fetchSchedules();
    } catch (err: any) {
      toast({ title: "Erro ao executar", description: err.message, variant: "destructive" });
    } finally {
      setRunningId(null);
    }
  };

  const relativeTime = (date: string | null) => {
    if (!date) return "Nunca";
    const d = new Date(date);
    const diff = d.getTime() - Date.now();
    const absMins = Math.abs(Math.floor(diff / 60000));
    if (diff < 0) {
      if (absMins < 1) return "agora";
      if (absMins < 60) return `${absMins}min atrás`;
      const hrs = Math.floor(absMins / 60);
      if (hrs < 24) return `${hrs}h atrás`;
      return `${Math.floor(hrs / 24)}d atrás`;
    }
    if (absMins < 1) return "agora";
    if (absMins < 60) return `em ${absMins}min`;
    const hrs = Math.floor(absMins / 60);
    if (hrs < 24) return `em ${hrs}h`;
    return `em ${Math.floor(hrs / 24)}d`;
  };

  const getAgent = (id: string | null) => {
    if (!id) return null;
    return agents.find((a) => a.id === id) || null;
  };

  if (wsLoading || !workspace) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agendamentos</h1>
          <p className="text-muted-foreground">Automações que fazem seus agentes agirem sozinhos</p>
        </div>
        <Button className="gradient-cta border-0" onClick={() => openCreate()}>
          <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{schedules.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-lg font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Execuções total</p>
              <p className="text-lg font-bold">{totalRuns}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suggestions when empty */}
      {schedules.length === 0 && !loading && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">Comece com um modelo pronto:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUGGESTIONS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/30 transition-all">
                  <Icon className="h-8 w-8 text-primary/60" />
                  <h3 className="font-bold text-sm">{s.name}</h3>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                  <Button variant="outline" size="sm" onClick={() => openCreate(s)}>
                    Usar este modelo
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Schedule List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : schedules.length > 0 ? (
        <div className="space-y-3">
          {schedules.map((s) => {
            const agent = getAgent(s.agent_id);
            const isRunning = runningId === s.id;
            return (
              <div
                key={s.id}
                className={`rounded-xl border bg-card p-4 transition-all ${
                  s.is_active ? "border-border hover:border-primary/30" : "border-border/50 opacity-60"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm truncate">{s.name}</h3>
                      <Badge variant={s.is_active ? "default" : "secondary"} className="text-[10px] px-1.5">
                        {s.is_active ? "Ativo" : "Pausado"}
                      </Badge>
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    )}

                    {/* Instruction preview */}
                    <p className="text-xs text-muted-foreground/70 italic line-clamp-1">
                      "{s.instruction}"
                    </p>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {/* Agent */}
                      {agent ? (
                        <div className="flex items-center gap-1">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[6px] font-bold text-white"
                            style={{ background: agent.avatar_color || "#6366f1" }}
                          >
                            {agent.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span>{agent.name}</span>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertCircle className="h-3 w-3" /> Sem agente
                        </span>
                      )}

                      <span className="text-border">·</span>

                      {/* Frequency */}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {FREQ_LABELS[s.frequency] || s.frequency}
                        {s.scheduled_time && ` às ${s.scheduled_time}`}
                      </span>

                      {s.scheduled_days && s.scheduled_days.length > 0 && (
                        <>
                          <span className="text-border">·</span>
                          <span>{s.scheduled_days.join(", ")}</span>
                        </>
                      )}

                      <span className="text-border">·</span>
                      <span>{s.run_count || 0} execuções</span>
                    </div>
                  </div>

                  {/* Right: Times + Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right text-xs space-y-0.5">
                      <p className={s.is_active ? "text-green-400" : "text-muted-foreground"}>
                        {s.is_active ? `Próxima: ${relativeTime(s.next_run)}` : "Pausado"}
                      </p>
                      <p className="text-muted-foreground">
                        Última: {relativeTime(s.last_run)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Run now */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary"
                        onClick={() => handleRunNow(s)}
                        disabled={isRunning}
                        title="Executar agora"
                      >
                        {isRunning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(s)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>

                      {/* Toggle */}
                      <Switch
                        checked={s.is_active || false}
                        onCheckedChange={() => handleToggle(s)}
                      />

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteSchedule(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!saving) { setModalOpen(open); if (!open) resetForm(); } }}>
        <DialogContent className="glassmorphism max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              {editingId ? "Editar Agendamento" : "Novo Agendamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-sm font-medium mb-1 block">Nome *</label>
              <Input
                placeholder="Ex: Post diário no Instagram"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição</label>
              <Input
                placeholder="Descrição opcional do agendamento"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>

            {/* Agent */}
            <div>
              <label className="text-sm font-medium mb-1 block">Agente responsável *</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={formAgent}
                onChange={(e) => setFormAgent(e.target.value)}
              >
                <option value="">Selecione um agente</option>
                {agents
                  .filter((a) => a.is_active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.role}
                    </option>
                  ))}
              </select>
              {!formAgent && (
                <p className="text-[11px] text-destructive mt-1">
                  Obrigatório — o agente vai executar a instrução quando o agendamento disparar
                </p>
              )}
            </div>

            {/* Instruction */}
            <div>
              <label className="text-sm font-medium mb-1 block">Instrução para o agente *</label>
              <Textarea
                placeholder="Ex: Crie um post de carrossel para o Instagram com legenda, imagem e hashtags sobre nosso produto..."
                rows={4}
                value={formInstruction}
                onChange={(e) => setFormInstruction(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Esta instrução será enviada ao agente toda vez que o agendamento disparar
              </p>
            </div>

            {/* Frequency */}
            <div>
              <label className="text-sm font-medium mb-2 block">Frequência</label>
              <div className="flex gap-1 flex-wrap">
                {FREQ_OPTIONS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormFreq(f)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                      formFreq === f
                        ? "gradient-cta text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {FREQ_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Once: Date picker */}
            {formFreq === "once" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Data</label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
            )}

            {/* Time */}
            {["daily", "once", "weekly", "monthly"].includes(formFreq) && (
              <div>
                <label className="text-sm font-medium mb-1 block">Horário</label>
                <Input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
              </div>
            )}

            {/* Weekly: Day selector */}
            {formFreq === "weekly" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Dias da semana</label>
                <div className="flex gap-1">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      onClick={() =>
                        setFormDays((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                        )
                      }
                      className={`w-9 h-9 rounded-full text-xs font-medium transition-all ${
                        formDays.includes(d)
                          ? "gradient-cta text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly: Day of month */}
            {formFreq === "monthly" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Dia do mês</label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="1"
                  value={formMonthDay}
                  onChange={(e) => setFormMonthDay(e.target.value)}
                />
              </div>
            )}

            {/* Custom: Cron */}
            {formFreq === "custom" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Expressão cron</label>
                <Input
                  placeholder="0 8 * * 1-5"
                  value={formCron}
                  onChange={(e) => setFormCron(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Formato: minuto hora dia_mês mês dia_semana (ex: "0 17 * * *" = todo dia às 17h)
                </p>
              </div>
            )}

            {/* Save button */}
            <Button
              className="w-full gradient-cta border-0"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...
                </>
              ) : editingId ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" /> Salvar alterações
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" /> Criar Agendamento
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteSchedule} onOpenChange={() => setDeleteSchedule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O agendamento "{deleteSchedule?.name}" será excluído permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
