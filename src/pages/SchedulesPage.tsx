import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeAgents } from "@/hooks/useRealtimeAgents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, PenLine, BarChart, FileText, Trash2, Pencil, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Schedule {
  id: string; workspace_id: string; name: string; description: string | null;
  agent_id: string | null; instruction: string; frequency: string;
  scheduled_time: string | null; scheduled_days: string[] | null;
  cron_expression: string | null; is_active: boolean | null;
  last_run: string | null; next_run: string | null; run_count: number | null;
  created_at: string | null;
}

const FREQ_OPTIONS = ["once", "daily", "weekly", "monthly", "custom"];
const FREQ_LABELS: Record<string, string> = { once: "Uma vez", daily: "Diário", weekly: "Semanal", monthly: "Mensal", custom: "Personalizado" };
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const SUGGESTIONS = [
  { name: "Post diário de conteúdo", icon: PenLine, desc: "Todo dia às 8h, agente de conteúdo cria um post", instruction: "Crie um post para as redes sociais sobre nosso produto principal", frequency: "daily", time: "08:00" },
  { name: "Review semanal do CEO", icon: BarChart, desc: "Toda segunda às 9h, CEO revisa tarefas da semana", instruction: "Revise todas as tarefas pendentes e em andamento e faça um resumo executivo", frequency: "weekly", time: "09:00" },
  { name: "Relatório diário", icon: FileText, desc: "Todo dia às 18h, relatório de produtividade", instruction: "Gere um relatório de produtividade do dia com métricas de tarefas e mensagens", frequency: "daily", time: "18:00" },
];

export default function SchedulesPage() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const { agents } = useRealtimeAgents(workspace?.id);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<Schedule | null>(null);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
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

  const fetchSchedules = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase.from("schedules").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false });
    if (data) setSchedules(data as Schedule[]);
    setLoading(false);
  };

  useEffect(() => { fetchSchedules(); }, [workspace?.id]);

  if (wsLoading || !workspace) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      </div>
    );
  }

  const fetchSchedules = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase.from("schedules").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false });
    if (data) setSchedules(data as Schedule[]);
    setLoading(false);
  };

  useEffect(() => { fetchSchedules(); }, [workspace?.id]);

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormAgent(""); setFormInstruction("");
    setFormFreq("daily"); setFormTime("08:00"); setFormDate(""); setFormDays([]);
    setFormMonthDay("1"); setFormCron("");
  };

  const openCreate = (suggestion?: typeof SUGGESTIONS[0]) => {
    resetForm();
    if (suggestion) {
      setFormName(suggestion.name); setFormInstruction(suggestion.instruction);
      setFormFreq(suggestion.frequency); setFormTime(suggestion.time);
    }
    setCreateOpen(true);
  };

  const calcNextRun = () => {
    const now = new Date();
    const [h, m] = formTime.split(":").map(Number);
    if (formFreq === "once" && formDate) return new Date(formDate + "T" + formTime).toISOString();
    const next = new Date(now); next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  };

  const handleSave = async () => {
    if (!formName.trim() || !formInstruction.trim()) { toast({ title: "Preencha nome e instrução", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      workspace_id: workspace!.id, name: formName.trim(), description: formDesc.trim() || null,
      agent_id: formAgent || null, instruction: formInstruction.trim(), frequency: formFreq,
      scheduled_time: formTime || null, scheduled_days: formFreq === "weekly" ? formDays : null,
      cron_expression: formFreq === "custom" ? formCron : null,
      next_run: calcNextRun(), is_active: true,
    };
    const { error } = await supabase.from("schedules").insert(payload);
    if (error) { toast({ title: "Erro ao criar", variant: "destructive" }); setSaving(false); return; }
    await supabase.from("event_logs").insert({ workspace_id: workspace!.id, event_type: "schedule_created", actor: "Você", target: formName.trim(), description: "Agendamento criado" });
    toast({ title: "✓ Agendamento criado" });
    setSaving(false); setCreateOpen(false); fetchSchedules();
  };

  const handleToggle = async (s: Schedule) => {
    await supabase.from("schedules").update({ is_active: !s.is_active }).eq("id", s.id);
    toast({ title: s.is_active ? "Agendamento pausado" : "Agendamento ativado" });
    fetchSchedules();
  };

  const handleDelete = async () => {
    if (!deleteSchedule) return;
    await supabase.from("schedules").delete().eq("id", deleteSchedule.id);
    toast({ title: "Agendamento excluído" });
    setDeleteSchedule(null); fetchSchedules();
  };

  const relativeTime = (date: string | null) => {
    if (!date) return "Nunca";
    const d = new Date(date);
    const diff = d.getTime() - Date.now();
    if (diff < 0) { const mins = Math.abs(Math.floor(diff / 60000)); if (mins < 60) return `${mins}min atrás`; return `${Math.floor(mins / 60)}h atrás`; }
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `em ${mins}min`;
    return `em ${Math.floor(mins / 60)}h`;
  };

  const getAgentName = (id: string | null) => { if (!id) return "Sem agente"; return agents.find((a) => a.id === id)?.name || "Agente"; };
  const getAgentColor = (id: string | null) => { if (!id) return "#94a3b8"; return agents.find((a) => a.id === id)?.avatar_color || "#6366f1"; };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agendamentos</h1>
          <p className="text-muted-foreground">Automações que rodam sozinhas</p>
        </div>
        <Button className="gradient-cta border-0" onClick={() => openCreate()}>
          <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
        </Button>
      </div>

      {/* Suggestions */}
      {schedules.length === 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SUGGESTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Icon className="h-8 w-8 text-muted-foreground" />
                <h3 className="font-bold text-sm">{s.name}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
                <Button variant="outline" size="sm" onClick={() => openCreate(s)}>Usar este modelo</Button>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : schedules.length > 0 && (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">{s.name}</h3>
                {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[6px] font-bold text-white" style={{ background: getAgentColor(s.agent_id) }}>
                      {getAgentName(s.agent_id).slice(0, 2).toUpperCase()}
                    </div>
                    {getAgentName(s.agent_id)}
                  </div>
                  <span>·</span>
                  <span>{FREQ_LABELS[s.frequency] || s.frequency}{s.scheduled_time ? ` às ${s.scheduled_time}` : ""}</span>
                </div>
              </div>
              <div className="text-right text-xs space-y-1">
                <p className={s.is_active ? "text-success" : "text-muted-foreground"}>
                  {s.is_active ? `Próxima: ${relativeTime(s.next_run)}` : "Pausado"}
                </p>
                <p className="text-muted-foreground">Última: {relativeTime(s.last_run)}</p>
                <p className="text-muted-foreground">{s.run_count || 0} execuções</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={s.is_active || false} onCheckedChange={() => handleToggle(s)} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteSchedule(s)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="glassmorphism max-w-lg">
          <DialogHeader><DialogTitle>Novo Agendamento</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <Input placeholder="Nome do agendamento" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <Input placeholder="Descrição (opcional)" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            <div>
              <label className="text-sm font-medium mb-2 block">Agente</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={formAgent} onChange={(e) => setFormAgent(e.target.value)}>
                <option value="">Selecione um agente</option>
                {agents.filter((a) => a.is_active).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {a.role}</option>
                ))}
              </select>
            </div>
            <Textarea placeholder="Instrução para o agente..." rows={3} value={formInstruction} onChange={(e) => setFormInstruction(e.target.value)} />
            <p className="text-xs text-muted-foreground">Esta instrução será enviada ao agente toda vez que o agendamento disparar</p>
            <div>
              <label className="text-sm font-medium mb-2 block">Frequência</label>
              <div className="flex gap-1 flex-wrap">
                {FREQ_OPTIONS.map((f) => (
                  <button key={f} onClick={() => setFormFreq(f)} className={`px-3 py-1.5 rounded-full text-xs transition-all ${formFreq === f ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>
                    {FREQ_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
            {formFreq === "once" && <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />}
            {(formFreq === "daily" || formFreq === "once" || formFreq === "weekly" || formFreq === "monthly") && (
              <Input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
            )}
            {formFreq === "weekly" && (
              <div className="flex gap-1">
                {DAYS.map((d, i) => (
                  <button key={d} onClick={() => setFormDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
                    className={`w-9 h-9 rounded-full text-xs font-medium ${formDays.includes(d) ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>
                    {d}
                  </button>
                ))}
              </div>
            )}
            {formFreq === "monthly" && <Input type="number" min={1} max={31} placeholder="Dia do mês" value={formMonthDay} onChange={(e) => setFormMonthDay(e.target.value)} />}
            {formFreq === "custom" && (
              <>
                <Input placeholder="0 8 * * 1-5" value={formCron} onChange={(e) => setFormCron(e.target.value)} />
                <p className="text-xs text-muted-foreground">Expressão cron (minuto hora dia_mês mês dia_semana)</p>
              </>
            )}
          </div>
          <Button className="w-full gradient-cta border-0" onClick={handleSave} disabled={saving}>{saving ? "Criando..." : "Criar Agendamento"}</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSchedule} onOpenChange={() => setDeleteSchedule(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir agendamento?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
