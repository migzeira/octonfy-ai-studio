import { useState, useEffect, useCallback } from "react";
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
import { Building2, Monitor, Bell, User, Info, Palette, LogOut, Save, RotateCcw } from "lucide-react";

/* ── Navigation tabs ── */
const SECTIONS = [
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "office", label: "Escritório", icon: Monitor },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "account", label: "Conta", icon: User },
] as const;

const CEO_INTERVALS = [5, 10, 15, 30, 60];

/* ── Helpers: isolate office JSON inside additional_notes ── */
interface OfficeSettings {
  ceo_interval: number;
  default_mode: "silent" | "autonomous";
  user_notes: string;
}

function parseOfficeSettings(raw: string | null): OfficeSettings {
  try {
    const p = JSON.parse(raw || "{}");
    return {
      ceo_interval: p.ceo_interval ?? 10,
      default_mode: p.default_mode ?? "silent",
      user_notes: p.user_notes ?? "",
    };
  } catch {
    return { ceo_interval: 10, default_mode: "silent", user_notes: raw ?? "" };
  }
}

function buildAdditionalNotes(s: OfficeSettings): string {
  return JSON.stringify(s);
}

/* ── Notification prefs (localStorage) ── */
interface NotifPrefs {
  creditLow: boolean;
  creditThreshold: number;
  agentTask: boolean;
  dailySummary: boolean;
  schedule: boolean;
}
const NOTIF_KEY = "octonfy-notifications";
function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) { const p = JSON.parse(raw); return { creditLow: p.creditLow ?? true, creditThreshold: p.creditThreshold ?? 100, agentTask: p.agentTask ?? true, dailySummary: p.dailySummary ?? false, schedule: p.schedule ?? true }; }
  } catch {}
  return { creditLow: true, creditThreshold: 100, agentTask: true, dailySummary: false, schedule: true };
}
function saveNotifPrefs(p: NotifPrefs) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(p));
}

/* ── Theme / density helpers ── */
function applyTheme(t: "dark" | "light") {
  localStorage.setItem("octonfy-theme", t);
  document.documentElement.classList.toggle("light", t === "light");
}
function applyDensity(d: "comfortable" | "compact") {
  localStorage.setItem("octonfy-density", d);
  document.documentElement.classList.toggle("density-compact", d === "compact");
}

/* ══════════════════════════════════════════════════════════════════════
   SETTINGS PAGE
   ══════════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const { workspace, refetch, loading: wsLoading } = useWorkspace();
  const { user, signOut } = useAuth();
  const { credits } = useRealtimeCredits(workspace?.id);
  const [section, setSection] = useState("workspace");
  const [saving, setSaving] = useState(false);

  /* ── Workspace fields ── */
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [products, setProducts] = useState("");
  const [culture, setCulture] = useState("");
  const [userNotes, setUserNotes] = useState("");

  /* ── Office fields ── */
  const [ceoInterval, setCeoInterval] = useState(10);
  const [defaultMode, setDefaultMode] = useState<"silent" | "autonomous">("silent");

  /* ── Notifications ── */
  const [notif, setNotif] = useState<NotifPrefs>(loadNotifPrefs);

  /* ── Appearance ── */
  const [theme, setThemeState] = useState<"dark" | "light">(
    () => (localStorage.getItem("octonfy-theme") as "dark" | "light") ?? "dark"
  );
  const [density, setDensityState] = useState<"comfortable" | "compact">(
    () => (localStorage.getItem("octonfy-density") as "comfortable" | "compact") ?? "comfortable"
  );

  /* ── Account ── */
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  /* ── Load from workspace ── */
  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    setMission(workspace.mission || "");
    setProducts(workspace.products || "");
    setCulture(workspace.culture || "");
    const parsed = parseOfficeSettings(workspace.additional_notes);
    setUserNotes(parsed.user_notes);
    setCeoInterval(parsed.ceo_interval);
    setDefaultMode(parsed.default_mode);
  }, [workspace]);

  /* ── Loading state ── */
  if (wsLoading || !workspace) {
    return (
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  /* ── Save: Workspace ── */
  const saveWorkspace = async () => {
    setSaving(true);
    const officeSettings: OfficeSettings = { ceo_interval: ceoInterval, default_mode: defaultMode, user_notes: userNotes };
    const { error } = await supabase.from("workspaces").update({
      name, mission, products, culture,
      additional_notes: buildAdditionalNotes(officeSettings),
    }).eq("id", workspace.id);
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✓ Workspace atualizado" });
    refetch();
  };

  /* ── Save: Office ── */
  const saveOffice = async () => {
    setSaving(true);
    const officeSettings: OfficeSettings = { ceo_interval: ceoInterval, default_mode: defaultMode, user_notes: userNotes };
    const { error } = await supabase.from("workspaces").update({
      additional_notes: buildAdditionalNotes(officeSettings),
    }).eq("id", workspace.id);
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✓ Configurações do escritório salvas" });
    refetch();
  };

  /* ── Save: Notifications (instant) ── */
  const updateNotif = (patch: Partial<NotifPrefs>) => {
    const next = { ...notif, ...patch };
    setNotif(next);
    saveNotifPrefs(next);
    toast({ title: "✓ Notificação atualizada" });
  };

  /* ── Appearance (instant apply) ── */
  const handleTheme = (t: "dark" | "light") => {
    setThemeState(t);
    applyTheme(t);
    toast({ title: t === "dark" ? "🌙 Tema escuro ativado" : "☀️ Tema claro ativado" });
  };
  const handleDensity = (d: "comfortable" | "compact") => {
    setDensityState(d);
    applyDensity(d);
    toast({ title: d === "compact" ? "Interface compacta ativada" : "Interface confortável ativada" });
  };

  /* ── Account actions ── */
  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) { toast({ title: "Digite o novo email", variant: "destructive" }); return; }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    toast({ title: "📧 Email de verificação enviado para " + newEmail });
    setNewEmail("");
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) { toast({ title: "Senhas não conferem", variant: "destructive" }); return; }
    if (newPassword.length < 6) { toast({ title: "Mínimo 6 caracteres", variant: "destructive" }); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    toast({ title: "✓ Senha atualizada com sucesso" });
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleResetPositions = async () => {
    const { error } = await supabase.from("agents").update({ position_x: 100, position_y: 100 }).eq("workspace_id", workspace.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✓ Posições dos agentes resetadas" });
  };

  const handleResetLayout = () => {
    const key = `octonfy-office-v3-${workspace.id}`;
    localStorage.removeItem(key);
    toast({ title: "✓ Layout do escritório restaurado ao padrão", description: "Recarregue a página do escritório para ver." });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "CONFIRMAR") return;
    const { error } = await supabase.from("workspaces").delete().eq("id", workspace.id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    await signOut();
  };

  const realBalance = credits?.balance ?? 0;
  const planLabel = workspace.plan || "Starter";

  /* ── Render ── */
  return (
    <div className="flex h-full">
      {/* Sidebar de seções */}
      <div className="w-[180px] border-r border-border p-4 space-y-1 shrink-0">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                section === s.id
                  ? "gradient-cta text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" /> {s.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-6 overflow-y-auto max-w-2xl">
        {/* ═══════ WORKSPACE ═══════ */}
        {section === "workspace" && (
          <div className="space-y-6 page-enter">
            <h2 className="text-2xl font-bold">Configurações do Workspace</h2>

            <div className="space-y-4">
              <Field label="Nome da empresa">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Minha Empresa" />
              </Field>
              <Field label="Missão">
                <Textarea rows={3} value={mission} onChange={(e) => setMission(e.target.value)} placeholder="Descreva a missão da empresa..." />
              </Field>
              <Field label="Produtos/Serviços">
                <Textarea rows={3} value={products} onChange={(e) => setProducts(e.target.value)} placeholder="Quais produtos ou serviços vocês oferecem?" />
              </Field>
              <Field label="Cultura da empresa">
                <Textarea rows={3} value={culture} onChange={(e) => setCulture(e.target.value)} placeholder="Valores, tom de voz, princípios..." />
              </Field>
              <Field label="Notas adicionais">
                <Textarea rows={2} value={userNotes} onChange={(e) => setUserNotes(e.target.value)} placeholder="Informações extras para os agentes..." />
              </Field>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Essas informações são usadas por todos os agentes como contexto da empresa. Mantenha sempre atualizado para respostas mais precisas.
                </p>
              </div>

              <Button className="gradient-cta border-0 gap-2" onClick={saveWorkspace} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        )}

        {/* ═══════ ESCRITÓRIO ═══════ */}
        {section === "office" && (
          <div className="space-y-6 page-enter">
            <h2 className="text-2xl font-bold">Comportamento do Escritório</h2>

            <div className="space-y-5">
              <Field label="Intervalo de verificação do CEO Autônomo">
                <p className="text-xs text-muted-foreground mb-2">A cada quantos minutos o CEO verifica tarefas e toma decisões automaticamente.</p>
                <div className="flex gap-1">
                  {CEO_INTERVALS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setCeoInterval(m)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        ceoInterval === m ? "gradient-cta text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Modo padrão ao abrir o escritório">
                <p className="text-xs text-muted-foreground mb-2">Define se o CEO começa em modo silencioso ou autônomo ao abrir a página.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDefaultMode("silent")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      defaultMode === "silent" ? "gradient-cta text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🔇 Silencioso
                  </button>
                  <button
                    onClick={() => setDefaultMode("autonomous")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      defaultMode === "autonomous" ? "gradient-cta text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🤖 Autônomo
                  </button>
                </div>
              </Field>

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-sm font-medium">Ações rápidas</p>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleResetPositions}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Resetar posições dos agentes
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetLayout}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restaurar layout padrão
                  </Button>
                </div>
              </div>

              <Button className="gradient-cta border-0 gap-2" onClick={saveOffice} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar configurações"}
              </Button>
            </div>
          </div>
        )}

        {/* ═══════ NOTIFICAÇÕES ═══════ */}
        {section === "notifications" && (
          <div className="space-y-6 page-enter">
            <h2 className="text-2xl font-bold">Preferências de Notificação</h2>
            <p className="text-sm text-muted-foreground">As notificações aparecem como toasts dentro do app. Alterações são salvas automaticamente.</p>

            <div className="space-y-1">
              <NotifRow
                title="Alerta de créditos baixos"
                desc="Receba aviso quando o saldo ficar abaixo do limite"
                checked={notif.creditLow}
                onChange={(v) => updateNotif({ creditLow: v })}
              />
              {notif.creditLow && (
                <div className="pl-12 pb-3">
                  <label className="text-xs text-muted-foreground">Alertar quando abaixo de:</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      className="w-28"
                      value={notif.creditThreshold}
                      onChange={(e) => updateNotif({ creditThreshold: Number(e.target.value) || 0 })}
                    />
                    <span className="text-xs text-muted-foreground">créditos</span>
                  </div>
                </div>
              )}

              <NotifRow
                title="Tarefas criadas por agentes"
                desc="Toast quando um agente criar ou completar uma tarefa"
                checked={notif.agentTask}
                onChange={(v) => updateNotif({ agentTask: v })}
              />
              <NotifRow
                title="Resumo diário"
                desc="Notificação ao abrir o app com resumo de atividades do dia"
                checked={notif.dailySummary}
                onChange={(v) => updateNotif({ dailySummary: v })}
              />
              <NotifRow
                title="Conclusão de agendamentos"
                desc="Toast quando um agendamento automático for executado"
                checked={notif.schedule}
                onChange={(v) => updateNotif({ schedule: v })}
              />
            </div>
          </div>
        )}

        {/* ═══════ APARÊNCIA ═══════ */}
        {section === "appearance" && (
          <div className="space-y-6 page-enter">
            <h2 className="text-2xl font-bold">Aparência</h2>
            <p className="text-sm text-muted-foreground">Mudanças são aplicadas instantaneamente e salvas automaticamente.</p>

            <Field label="Tema">
              <div className="flex gap-2">
                <ThemeBtn active={theme === "dark"} onClick={() => handleTheme("dark")} label="🌙 Escuro" />
                <ThemeBtn active={theme === "light"} onClick={() => handleTheme("light")} label="☀️ Claro" />
              </div>
            </Field>

            <Field label="Densidade da interface">
              <p className="text-xs text-muted-foreground mb-2">Compacto reduz espaçamentos para mais conteúdo na tela.</p>
              <div className="flex gap-2">
                <ThemeBtn active={density === "comfortable"} onClick={() => handleDensity("comfortable")} label="Confortável" />
                <ThemeBtn active={density === "compact"} onClick={() => handleDensity("compact")} label="Compacto" />
              </div>
            </Field>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <p className="text-foreground font-semibold">Texto principal</p>
                <p className="text-muted-foreground text-sm">Texto secundário com cor muted</p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded gradient-cta text-white text-xs">Primário</span>
                  <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs">Muted</span>
                  <span className="px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs">Destrutivo</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ CONTA ═══════ */}
        {section === "account" && (
          <div className="space-y-6 page-enter">
            <h2 className="text-2xl font-bold">Sua Conta</h2>

            {/* User card */}
            <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full gradient-cta flex items-center justify-center text-lg font-bold text-white">
                {(workspace.name || "U").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold">{workspace.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            {/* Plan & Credits */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-lg">Plano {planLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    Saldo: <span className="font-semibold text-primary">{realBalance}</span> créditos
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.href = "/credits"}>
                  Gerenciar créditos
                </Button>
              </div>
              {credits && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Consumido: {credits.total_consumed ?? 0}</span>
                  <span>Comprado: {credits.total_purchased ?? 0}</span>
                  <span>Reservado: {credits.reserved ?? 0}</span>
                </div>
              )}
              {/* Credit bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full gradient-cta rounded-full transition-all"
                  style={{ width: `${Math.min(100, (realBalance / 500) * 100)}%` }}
                />
              </div>
            </div>

            {/* Email */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Alterar email</h3>
              <p className="text-xs text-muted-foreground">Um email de verificação será enviado para o novo endereço.</p>
              <div className="flex gap-2">
                <Input placeholder="Novo email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <Button variant="outline" onClick={handleUpdateEmail} disabled={!newEmail.trim()}>Atualizar</Button>
              </div>
            </div>

            {/* Password */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Alterar senha</h3>
              <Input type="password" placeholder="Nova senha (mínimo 6 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Input type="password" placeholder="Confirmar nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <Button variant="outline" onClick={handleUpdatePassword} disabled={!newPassword || !confirmPassword}>
                Alterar senha
              </Button>
            </div>

            {/* Logout */}
            <Button variant="outline" className="w-full flex items-center gap-2" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" /> Sair da conta
            </Button>

            {/* Danger zone */}
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
              <h3 className="font-semibold text-destructive">Zona de Perigo</h3>
              <p className="text-sm text-muted-foreground">
                Excluir permanentemente seu workspace, todos os agentes, documentos, tarefas e mensagens. Esta ação não pode ser desfeita.
              </p>
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowDeleteDialog(true)}>
                Cancelar conta
              </Button>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar conta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os dados serão permanentemente excluídos (agentes, documentos, tarefas, mensagens, créditos).
                    <br /><br />
                    Digite <strong>CONFIRMAR</strong> para prosseguir.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  placeholder='Digite "CONFIRMAR"'
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleteConfirm !== "CONFIRMAR"}
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={handleDeleteAccount}
                  >
                    Excluir conta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function NotifRow({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 px-1 border-b border-border/50 last:border-0">
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ThemeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active ? "gradient-cta text-white shadow-lg" : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
