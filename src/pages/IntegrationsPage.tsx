import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar, Table, HardDrive, Search, Image, Camera, MessageCircle,
  Instagram, Zap, CreditCard, ExternalLink,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Integration {
  id: string; workspace_id: string; type: string; is_connected: boolean | null;
  config: any; connected_at: string | null; created_at: string | null;
}

const INTEGRATIONS_DEF = [
  { type: "google_calendar", name: "Google Calendar", icon: Calendar, color: "#22c55e", desc: "Agentes podem criar e visualizar eventos", status: "available", fields: [{ key: "oauth", label: "Conectar com Google", type: "oauth" }] },
  { type: "google_sheets", name: "Google Sheets", icon: Table, color: "#22c55e", desc: "Agentes podem ler e escrever em planilhas", status: "available", fields: [{ key: "sheet_url", label: "URL da planilha", type: "text", placeholder: "https://docs.google.com/spreadsheets/..." }, { key: "sheet_tab", label: "Nome da aba (opcional)", type: "text" }] },
  { type: "google_drive", name: "Google Drive", icon: HardDrive, color: "#3b82f6", desc: "Agentes salvam documentos no Drive", status: "available", fields: [{ key: "oauth", label: "Conectar com Google", type: "oauth" }] },
  { type: "perplexity", name: "Perplexity", icon: Search, color: "#6366f1", desc: "Agentes buscam informações atualizadas na web", status: "available", fields: [{ key: "api_key", label: "API Key do Perplexity", type: "text", placeholder: "pplx-..." }], link: "https://perplexity.ai/settings" },
  { type: "unsplash", name: "Unsplash", icon: Image, color: "#94a3b8", desc: "Agentes buscam fotos profissionais gratuitas", status: "available", fields: [{ key: "access_key", label: "Access Key", type: "text" }] },
  { type: "pexels", name: "Pexels", icon: Camera, color: "#22c55e", desc: "Banco de fotos e vídeos gratuitos", status: "available", fields: [{ key: "api_key", label: "API Key", type: "text" }] },
  { type: "whatsapp", name: "WhatsApp", icon: MessageCircle, color: "#25D366", desc: "Agentes enviam mensagens pelo WhatsApp", status: "available", fields: [{ key: "api_url", label: "URL da instância Evolution API", type: "text", placeholder: "https://sua-instancia.evolution.com" }, { key: "api_key", label: "API Key", type: "text" }, { key: "instance_name", label: "Nome da instância", type: "text" }] },
  { type: "instagram", name: "Instagram", icon: Instagram, color: "#E1306C", desc: "Agentes criam e agendam posts", status: "available", fields: [{ key: "oauth", label: "Conectar com Meta", type: "oauth" }] },
  { type: "openai", name: "OpenAI (GPT-4o)", icon: Zap, color: "#000000", desc: "Habilita modelo GPT-4o para seus agentes", status: "available", fields: [{ key: "api_key", label: "OpenAI API Key", type: "text", placeholder: "sk-..." }] },
  { type: "groq", name: "Groq (Llama)", icon: Zap, color: "#f97316", desc: "Llama ultra-rápido via Groq — velocidade máxima", status: "available", fields: [{ key: "api_key", label: "Groq API Key", type: "text", placeholder: "gsk_..." }] },
  { type: "stripe", name: "Stripe", icon: CreditCard, color: "#6366f1", desc: "Processe pagamentos reais de créditos", status: "coming_soon", fields: [] },
  { type: "zapier", name: "Zapier", icon: Zap, color: "#f97316", desc: "Conecte com mais de 5.000 aplicativos", status: "coming_soon", fields: [] },
];

export default function IntegrationsPage() {
  const { workspace } = useWorkspace();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectModal, setConnectModal] = useState<typeof INTEGRATIONS_DEF[0] | null>(null);
  const [disconnectType, setDisconnectType] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const fetchIntegrations = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase.from("integrations").select("*").eq("workspace_id", workspace.id);
    if (data) setIntegrations(data as Integration[]);
    setLoading(false);
  };

  useEffect(() => { fetchIntegrations(); }, [workspace?.id]);

  const isConnected = (type: string) => integrations.find((i) => i.type === type && i.is_connected);

  const handleConnect = async () => {
    if (!connectModal || !workspace) return;
    const nonOauthFields = connectModal.fields.filter((f) => f.type !== "oauth");
    for (const f of nonOauthFields) {
      if (!fieldValues[f.key] || fieldValues[f.key].length < 5) {
        toast({ title: `${f.label} inválido`, variant: "destructive" }); return;
      }
    }
    const config: any = {};
    for (const f of connectModal.fields) {
      if (f.type === "oauth") config[f.key] = "simulated";
      else config[f.key] = fieldValues[f.key];
    }
    const existing = integrations.find((i) => i.type === connectModal.type);
    if (existing) {
      await supabase.from("integrations").update({ is_connected: true, config, connected_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("integrations").insert({ workspace_id: workspace.id, type: connectModal.type, is_connected: true, config, connected_at: new Date().toISOString() });
    }
    await supabase.from("event_logs").insert({ workspace_id: workspace.id, event_type: "integration_connected", actor: "Você", target: connectModal.name, description: `${connectModal.name} conectado` });
    toast({ title: `${connectModal.name} conectado com sucesso!` });
    setConnectModal(null); setFieldValues({}); fetchIntegrations();
  };

  const handleDisconnect = async () => {
    if (!disconnectType) return;
    const integration = integrations.find((i) => i.type === disconnectType);
    if (integration) {
      await supabase.from("integrations").update({ is_connected: false, config: {} }).eq("id", integration.id);
    }
    toast({ title: "Integração desconectada" });
    setDisconnectType(null); fetchIntegrations();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Integrações</h1>
        <p className="text-muted-foreground">Conecte suas ferramentas e amplie as capacidades dos seus agentes</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS_DEF.map((intDef) => {
            const Icon = intDef.icon;
            const connected = isConnected(intDef.type);
            const comingSoon = intDef.status === "coming_soon";
            return (
              <div key={intDef.type} className={`rounded-xl border border-border bg-card p-5 space-y-3 ${comingSoon ? "opacity-60" : "hover:glow-neon"} transition-all relative`}>
                <div className="absolute top-3 right-3">
                  {connected ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-success/20 text-success">● Conectado</span>
                  ) : comingSoon ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">Em breve</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">Disponível</span>
                  )}
                </div>
                <Icon className="h-8 w-8" style={{ color: intDef.color }} />
                <h3 className="font-bold">{intDef.name}</h3>
                <p className="text-sm text-muted-foreground">{intDef.desc}</p>
                <div>
                  {connected ? (
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => setDisconnectType(intDef.type)}>Desconectar</Button>
                  ) : comingSoon ? (
                    <Button variant="outline" size="sm" disabled>Em breve</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => { setFieldValues({}); setConnectModal(intDef); }}>Conectar</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Modal */}
      {connectModal && (
        <Dialog open onOpenChange={() => setConnectModal(null)}>
          <DialogContent className="glassmorphism max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <connectModal.icon className="h-5 w-5" style={{ color: connectModal.color }} />
                {connectModal.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {connectModal.fields.map((f) => (
                f.type === "oauth" ? (
                  <p key={f.key} className="text-sm text-muted-foreground">Conecte sua conta para permitir que agentes acessem este serviço.</p>
                ) : (
                  <div key={f.key}>
                    <label className="text-sm font-medium mb-1 block">{f.label}</label>
                    <Input placeholder={f.placeholder || ""} value={fieldValues[f.key] || ""} onChange={(e) => setFieldValues({ ...fieldValues, [f.key]: e.target.value })} />
                  </div>
                )
              ))}
              {connectModal.link && (
                <a href={connectModal.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1">
                  Obter API Key <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <Button className="w-full gradient-cta border-0" onClick={handleConnect}>
                {connectModal.fields.some((f) => f.type === "oauth") ? `Conectar com ${connectModal.name}` : "Salvar e conectar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!disconnectType} onOpenChange={() => setDisconnectType(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desconectar integração?</AlertDialogTitle><AlertDialogDescription>A integração será desconectada.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDisconnect} className="bg-destructive">Desconectar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
