import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeCredits } from "@/hooks/useRealtimeCredits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, Monitor, Bell, User, Info, Palette, LogOut } from "lucide-react";

const SECTIONS = [
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "office", label: "Escritório", icon: Monitor },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "account", label: "Conta", icon: User },
];
const CEO_INTERVALS = [5, 10, 15, 30, 60];

// ---------- helpers to isolate office settings inside additional_notes ----------
function parseOfficeSettings(raw: string | null) {
  try { const p = JSON.parse(raw || "{}"); return { ceoInterval: p.ceo_interval ?? 10, defaultMode: p.default_mode ?? "silent", userNotes: p.user_notes ?? "" }; }
  catch { return { ceoInterval: 10, defaultMode: "silent" as const, userNotes: raw ?? "" }; }
}

function buildAdditionalNotes(ceoInterval: number, defaultMode: string, userNotes: string) {
  return JSON.stringify({ ceo_interval: ceoInterval, default_mode: defaultMode, user_notes: userNotes });
}

export default function SettingsPage() {
  const { workspace, refetch, loading: wsLoading } = useWorkspace();
  const { user, signOut } = useAuth();
  const { credits } = useRealtimeCredits(workspace?.id);
  const [section, setSection] = useState("workspace");

  // workspace fields
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [products, setProducts] = useState("");
  const [culture, setCulture] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [savingWs, setSavingWs] = useState(false);

  // office fields
  const [ceoInterval, setCeoInterval] = useState(10);
  const [defaultMode, setDefaultMode] = useState<"silent" | "autonomous">("silent");

  // notifications
  const [notifCreditLow, setNotifCreditLow] = useState(true);
  const [notifCreditThreshold, setNotifCreditThreshold] = useState(100);
  const [notifAgentTask, setNotifAgentTask] = useState(true);
  const [notifDailySummary, setNotifDailySummary] = useState(false);
  const [notifSchedule, setNotifSchedule] = useState(true);

  // appearance
  const [theme, setTheme] = useState<"dark" | "light">(() => localStorage.getItem("octonfy-theme") as any ?? "dark");
  const [density, setDensity] = useState<"comfortable" | "compact">(() => localStorage.getItem("octonfy-density") as any ?? "comfortable");

  // account
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setMission(workspace.mission || "");
      setProducts(workspace.products || "");
      setCulture(workspace.culture || "");
      const parsed = parseOfficeSettings(workspace.additional_notes);
      setUserNotes(parsed.userNotes);
      setCeoInterval(parsed.ceoInterval);
      setDefaultMode(parsed.defaultMode as any);
    }
    const stored = localStorage.getItem("octonfy-notifications");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setNotifCreditLow(p.creditLow ?? true);
        setNotifCreditThreshold(p.creditThreshold ?? 100);
        setNotifAgentTask(p.agentTask ?? true);
        setNotifDailySummary(p.dailySummary ?? false);
        setNotifSchedule(p.schedule ?? true);
      } catch {}
    }
  }, [workspace]);

  if (wsLoading || !workspace) {
    return (
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const saveWorkspace = async () => {
    setSavingWs(true);
    const notes = buildAdditionalNotes(ceoInterval, defaultMode, userNotes);
    await supabase.from("workspaces").update({ name, mission, products, culture, additional_notes: notes }).eq("id", workspace.id);
    toast({ title: "✓ Workspace atualizado" });
    setSavingWs(false);
    refetch();
  };

  const saveOffice = async () => {
    const notes = buildAdditionalNotes(ceoInterval, defaultMode, userNotes);
    await supabase.from("workspaces").update({ additional_notes: notes }).eq("id", workspace.id);
    toast({ title: "✓ Configurações do escritório salvas" });
    refetch();
  };

  const saveNotifications = () => {
    localStorage.setItem("octonfy-notifications", JSON.stringify({
      creditLow: notifCreditLow, creditThreshold: notifCreditThreshold,
      agentTask: notifAgentTask, dailySummary: notifDailySummary, schedule: notifSchedule,
    }));
    toast({ title: "✓ Preferências salvas" });
  };

  const saveAppearance = () => {
    localStorage.setItem("octonfy-theme", theme);
    localStorage.setItem("octonfy-density", density);
    document.documentElement.classList.toggle("light", theme === "light");
    toast({ title: "✓ Aparência atualizada" });
  };

  const handleUpdateEmail = async () => {
    if (!newEmail) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    toast({ title: "Email de verificação enviado" });
    setNewEmail("");
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) { toast({ title: "Senhas não conferem", variant: "destructive" }); return; }
    if (newPassword.length < 6) { toast({ title: "Mínimo 6 caracteres", variant: "destructive" }); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    toast({ title: "✓ Senha atualizada" });
    setNewPassword(""); setConfirmPassword("");
  };

  const handleResetPositions = async () => {
    await supabase.from("agents").update({ position_x: 100, position_y: 100 }).eq("workspace_id", workspace.id);
    toast({ title: "Posições resetadas" });
  };

  const handleDeleteAccount = async () => {
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    await signOut();
  };

  const handleLogout = async () => {
    await signOut();
  };

  const realBalance = credits?.balance ?? 0;
  const planLabel = workspace.plan || "Starter";

  return (
    <div className="flex h-full">
      {/* Section sidebar */}
      <div className="w-[160px] border-r border-border p-4 space-y-1">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${section === s.id ? "gradient-cta text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
              <Icon className="h-4 w-4" /> {s.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto max-w-2xl">
        {section === "workspace" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Configurações do Workspace</h2>
            <div className="space-y-4">
              <div><label className="text-sm font-medium mb-1 block">Nome da empresa</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label className="text-sm font-medium mb-1 block">Missão</label><Textarea rows={3} value={mission} onChange={(e) => setMission(e.target.value)} /></div>
              <div><label className="text-sm font-medium mb-1 block">Produtos/Serviços</label><Textarea rows={3} value={products} onChange={(e) => setProducts(e.target.value)} /></div>
              <div><label className="text-sm font-medium mb-1 block">Cultura da empresa</label><Textarea rows={3} value={culture} onChange={(e) => setCulture(e.target.value)} /></div>
              <div><label className="text-sm font-medium mb-1 block">Notas adicionais</label><Textarea rows={2} value={userNotes} onChange={(e) => setUserNotes(e.target.value)} placeholder="Informações extras para os agentes..." /></div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">Essas informações são usadas por todos os agentes como contexto da empresa. Mantenha sempre atualizado.</p>
              </div>
              <Button className="gradient-cta border-0" onClick={saveWorkspace} disabled={savingWs}>{savingWs ? "Salvando..." : "Salvar alterações"}</Button>
            </div>
          </div>
        )}

        {section === "office" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Comportamento do Escritório</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Verificação automática do CEO</label>
                <div className="flex gap-1">
                  {CEO_INTERVALS.map((m) => (
                    <button key={m} onClick={() => setCeoInterval(m)} className={`px-3 py-1.5 rounded-full text-xs ${ceoInterval === m ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>{m} min</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Modo padrão ao abrir escritório</label>
                <div className="flex gap-2">
                  <button onClick={() => setDefaultMode("silent")} className={`px-4 py-2 rounded-lg text-sm ${defaultMode === "silent" ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>Silencioso</button>
                  <button onClick={() => setDefaultMode("autonomous")} className={`px-4 py-2 rounded-lg text-sm ${defaultMode === "autonomous" ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>Autônomo</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Reset de posições dos agentes</label>
                <Button variant="outline" onClick={handleResetPositions}>Resetar posições</Button>
              </div>
              <Button className="gradient-cta border-0" onClick={saveOffice}>Salvar configurações</Button>
            </div>
          </div>
        )}

        {section === "notifications" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Preferências de Notificação</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm">Alerta de créditos baixos</p><p className="text-xs text-muted-foreground">Receba aviso quando o saldo ficar baixo</p></div>
                <Switch checked={notifCreditLow} onCheckedChange={setNotifCreditLow} />
              </div>
              {notifCreditLow && (
                <div className="pl-4"><label className="text-xs text-muted-foreground">Alertar abaixo de:</label>
                  <Input type="number" className="w-32 mt-1" value={notifCreditThreshold} onChange={(e) => setNotifCreditThreshold(Number(e.target.value))} /></div>
              )}
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm">Tarefas criadas por agentes</p><p className="text-xs text-muted-foreground">Toast quando um agente cria uma tarefa</p></div>
                <Switch checked={notifAgentTask} onCheckedChange={setNotifAgentTask} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm">Resumo diário</p><p className="text-xs text-muted-foreground">Notificação ao abrir com resumo do dia</p></div>
                <Switch checked={notifDailySummary} onCheckedChange={setNotifDailySummary} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm">Conclusão de agendamentos</p><p className="text-xs text-muted-foreground">Toast quando agendamento for executado</p></div>
                <Switch checked={notifSchedule} onCheckedChange={setNotifSchedule} />
              </div>
              <Button className="gradient-cta border-0" onClick={saveNotifications}>Salvar preferências</Button>
            </div>
          </div>
        )}

        {section === "appearance" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Aparência</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tema</label>
                <div className="flex gap-2">
                  <button onClick={() => setTheme("dark")} className={`px-4 py-2 rounded-lg text-sm ${theme === "dark" ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>🌙 Escuro</button>
                  <button onClick={() => setTheme("light")} className={`px-4 py-2 rounded-lg text-sm ${theme === "light" ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>☀️ Claro</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Densidade da interface</label>
                <div className="flex gap-2">
                  <button onClick={() => setDensity("comfortable")} className={`px-4 py-2 rounded-lg text-sm ${density === "comfortable" ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>Confortável</button>
                  <button onClick={() => setDensity("compact")} className={`px-4 py-2 rounded-lg text-sm ${density === "compact" ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>Compacto</button>
                </div>
              </div>
              <Button className="gradient-cta border-0" onClick={saveAppearance}>Salvar aparência</Button>
            </div>
          </div>
        )}

        {section === "account" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Sua Conta</h2>
            <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                {(workspace?.name || "U").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-bold">{workspace?.name || "Usuário"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Alterar email</h3>
              <div className="flex gap-2"><Input placeholder="Novo email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /><Button variant="outline" onClick={handleUpdateEmail}>Atualizar</Button></div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Alterar senha</h3>
              <Input type="password" placeholder="Nova senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Input type="password" placeholder="Confirmar nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <Button variant="outline" onClick={handleUpdatePassword}>Alterar senha</Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-bold">Plano {planLabel}</p>
              <p className="text-sm text-muted-foreground">Saldo atual: <span className="font-semibold text-primary">{realBalance}</span> créditos</p>
              {credits && <p className="text-xs text-muted-foreground mt-1">Total consumido: {credits.total_consumed ?? 0} · Total comprado: {credits.total_purchased ?? 0}</p>}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => window.location.href = "/credits"}>Fazer upgrade</Button>
            </div>

            <Button variant="outline" className="w-full flex items-center gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Sair da conta
            </Button>

            <div className="rounded-xl border border-destructive/30 p-5 space-y-3">
              <h3 className="font-semibold text-destructive">Zona de Perigo</h3>
              <p className="text-sm text-muted-foreground">Excluir permanentemente seu workspace e todos os dados associados.</p>
              <Button variant="outline" className="text-destructive border-destructive/30" onClick={() => setShowDeleteDialog(true)}>Cancelar conta</Button>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar conta?</AlertDialogTitle>
                  <AlertDialogDescription>Todos os dados serão permanentemente excluídos. Digite "CONFIRMAR" para prosseguir.</AlertDialogDescription>
                </AlertDialogHeader>
                <Input placeholder='Digite "CONFIRMAR"' value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} />
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction disabled={deleteConfirm !== "CONFIRMAR"} className="bg-destructive" onClick={handleDeleteAccount}>Excluir conta</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}
