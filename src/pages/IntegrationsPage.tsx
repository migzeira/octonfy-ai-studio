import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, Image, Camera, MessageCircle,
  Instagram, Zap, CreditCard, ExternalLink, Check, Copy, Eye, EyeOff,
  ChevronDown, ChevronUp, Plug, PlugZap, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Integration {
  id: string;
  workspace_id: string;
  type: string;
  is_connected: boolean | null;
  config: Record<string, string> | null;
  connected_at: string | null;
  created_at: string | null;
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "oauth";
  placeholder?: string;
  secret?: boolean;
}

interface IntegrationDef {
  type: string;
  name: string;
  icon: React.ElementType;
  color: string;
  desc: string;
  status: "available" | "coming_soon";
  fields: FieldDef[];
  link?: string;
  linkLabel?: string;
  steps: string[];
}

const INTEGRATIONS_DEF: IntegrationDef[] = [
  {
    type: "whatsapp", name: "WhatsApp (Evolution API)", icon: MessageCircle, color: "#25D366",
    desc: "Agentes enviam e recebem mensagens pelo WhatsApp via Evolution API",
    status: "available",
    fields: [
      { key: "api_url", label: "URL da instância", type: "text", placeholder: "https://sua-instancia.evolution.com" },
      { key: "api_key", label: "API Key da instância", type: "text", placeholder: "sua-api-key", secret: true },
      { key: "instance_name", label: "Nome da instância", type: "text", placeholder: "minha-instancia" },
    ],
    link: "https://doc.evolution-api.com",
    linkLabel: "Documentação Evolution API",
    steps: [
      "Crie uma conta na Evolution API ou instale no seu servidor",
      "Crie uma nova instância e escaneie o QR Code com seu WhatsApp",
      "Vá em Configurações da instância e copie a API Key",
      "Cole a URL base, API Key e nome da instância nos campos abaixo",
    ],
  },
  {
    type: "openai", name: "OpenAI (GPT-4o)", icon: Zap, color: "#10a37f",
    desc: "Use modelos GPT diretamente — requer sua própria API Key",
    status: "available",
    fields: [
      { key: "api_key", label: "OpenAI API Key", type: "text", placeholder: "sk-...", secret: true },
    ],
    link: "https://platform.openai.com/api-keys",
    linkLabel: "Gerar API Key na OpenAI",
    steps: [
      "Acesse platform.openai.com e faça login",
      "Vá em API Keys → Create new secret key",
      "Copie a chave gerada (ela só aparece uma vez!)",
      "Cole no campo abaixo e salve",
    ],
  },
  {
    type: "groq", name: "Groq (Llama)", icon: Zap, color: "#f97316",
    desc: "Modelos Llama ultra-rápidos via Groq — velocidade máxima",
    status: "available",
    fields: [
      { key: "api_key", label: "Groq API Key", type: "text", placeholder: "gsk_...", secret: true },
    ],
    link: "https://console.groq.com/keys",
    linkLabel: "Gerar API Key no Groq",
    steps: [
      "Acesse console.groq.com e crie uma conta gratuita",
      "Vá em API Keys → Create API Key",
      "Copie a chave (começa com gsk_)",
      "Cole no campo abaixo e salve",
    ],
  },
  {
    type: "perplexity", name: "Perplexity", icon: Search, color: "#6366f1",
    desc: "Agentes buscam informações atualizadas na web em tempo real",
    status: "available",
    fields: [
      { key: "api_key", label: "Perplexity API Key", type: "text", placeholder: "pplx-...", secret: true },
    ],
    link: "https://www.perplexity.ai/settings/api",
    linkLabel: "Gerar API Key no Perplexity",
    steps: [
      "Acesse perplexity.ai e faça login",
      "Vá em Settings → API",
      "Gere uma nova API Key e copie",
      "Cole no campo abaixo e salve",
    ],
  },
  {
    type: "unsplash", name: "Unsplash", icon: Image, color: "#000000",
    desc: "Agentes buscam fotos profissionais gratuitas para documentos",
    status: "available",
    fields: [
      { key: "access_key", label: "Access Key", type: "text", placeholder: "sua-access-key", secret: true },
    ],
    link: "https://unsplash.com/developers",
    linkLabel: "Criar app no Unsplash",
    steps: [
      "Acesse unsplash.com/developers e registre-se",
      "Clique em 'New Application' e aceite os termos",
      "Copie o Access Key da aplicação criada",
      "Cole no campo abaixo e salve",
    ],
  },
  {
    type: "pexels", name: "Pexels", icon: Camera, color: "#05a081",
    desc: "Banco de fotos e vídeos gratuitos para seus agentes",
    status: "available",
    fields: [
      { key: "api_key", label: "API Key", type: "text", placeholder: "sua-api-key", secret: true },
    ],
    link: "https://www.pexels.com/api/new/",
    linkLabel: "Gerar API Key no Pexels",
    steps: [
      "Acesse pexels.com/api e faça login",
      "Clique em 'Your API Key' e crie uma nova",
      "Copie a chave gerada",
      "Cole no campo abaixo e salve",
    ],
  },
];

export default function IntegrationsPage() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectModal, setConnectModal] = useState<IntegrationDef | null>(null);
  const [disconnectType, setDisconnectType] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [expandedGuide, setExpandedGuide] = useState(true);

  const fetchIntegrations = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase.from("integrations").select("*").eq("workspace_id", workspace.id);
    if (data) setIntegrations(data as Integration[]);
    setLoading(false);
  };

  useEffect(() => {
    if (workspace?.id) fetchIntegrations();
  }, [workspace?.id]);

  const connectedCount = useMemo(() => integrations.filter((i) => i.is_connected).length, [integrations]);

  const getIntegration = (type: string) => integrations.find((i) => i.type === type);
  const isConnected = (type: string) => {
    const i = getIntegration(type);
    return i?.is_connected === true;
  };

  const openConnectModal = (intDef: IntegrationDef) => {
    const existing = getIntegration(intDef.type);
    const initialValues: Record<string, string> = {};
    if (existing?.config) {
      intDef.fields.forEach((f) => {
        if (existing.config && (existing.config as Record<string, string>)[f.key]) {
          initialValues[f.key] = (existing.config as Record<string, string>)[f.key];
        }
      });
    }
    setFieldValues(initialValues);
    setShowSecrets({});
    setExpandedGuide(true);
    setConnectModal(intDef);
  };

  const handleConnect = async () => {
    if (!connectModal || !workspace) return;
    const nonOauthFields = connectModal.fields.filter((f) => f.type !== "oauth");
    for (const f of nonOauthFields) {
      if (!fieldValues[f.key] || fieldValues[f.key].trim().length < 3) {
        toast({ title: `"${f.label}" é obrigatório`, description: "Preencha todos os campos corretamente", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    const config: Record<string, string> = {};
    for (const f of connectModal.fields) {
      if (f.type !== "oauth") config[f.key] = fieldValues[f.key].trim();
    }

    try {
      const existing = getIntegration(connectModal.type);
      if (existing) {
        const { error } = await supabase.from("integrations")
          .update({ is_connected: true, config, connected_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations")
          .insert({ workspace_id: workspace.id, type: connectModal.type, is_connected: true, config, connected_at: new Date().toISOString() });
        if (error) throw error;
      }

      // Log event
      await supabase.from("event_logs").insert({
        workspace_id: workspace.id,
        event_type: "integration_connected",
        actor: "Você",
        target: connectModal.name,
        description: `${connectModal.name} foi conectado ao workspace`,
      });

      toast({ title: `${connectModal.name} conectado!`, description: "A integração está ativa e pronta para uso" });
      setConnectModal(null);
      setFieldValues({});
      await fetchIntegrations();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message || "Tente novamente", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectType || !workspace) return;
    const integration = getIntegration(disconnectType);
    if (integration) {
      await supabase.from("integrations")
        .update({ is_connected: false, config: {} })
        .eq("id", integration.id);

      const def = INTEGRATIONS_DEF.find((d) => d.type === disconnectType);
      await supabase.from("event_logs").insert({
        workspace_id: workspace.id,
        event_type: "integration_disconnected",
        actor: "Você",
        target: def?.name || disconnectType,
        description: `${def?.name || disconnectType} foi desconectado`,
      });
    }
    toast({ title: "Integração desconectada" });
    setDisconnectType(null);
    await fetchIntegrations();
  };

  const maskSecret = (val: string) => {
    if (val.length <= 8) return "••••••••";
    return val.slice(0, 4) + "••••••••" + val.slice(-4);
  };

  if (wsLoading || !workspace) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrações</h1>
          <p className="text-muted-foreground">Conecte ferramentas e amplie as capacidades dos seus agentes</p>
        </div>
        <Badge variant="outline" className="text-sm gap-1">
          <PlugZap className="h-3.5 w-3.5" />
          {connectedCount} ativa{connectedCount !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Plug className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">Disponíveis</p><p className="text-lg font-bold">{INTEGRATIONS_DEF.filter((d) => d.status === "available").length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-green-500" />
          <div><p className="text-xs text-muted-foreground">Conectadas</p><p className="text-lg font-bold">{connectedCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <div><p className="text-xs text-muted-foreground">Em breve</p><p className="text-lg font-bold">{INTEGRATIONS_DEF.filter((d) => d.status === "coming_soon").length}</p></div>
        </CardContent></Card>
      </div>

      {/* Grid */}
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
            const integration = getIntegration(intDef.type);
            return (
              <div key={intDef.type} className={`rounded-xl border border-border bg-card p-5 space-y-3 transition-all relative ${comingSoon ? "opacity-50" : "hover:border-primary/30"}`}>
                {/* Status badge */}
                <div className="absolute top-3 right-3">
                  {connected ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-500/20 text-green-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Conectado
                    </span>
                  ) : comingSoon ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">Em breve</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">Disponível</span>
                  )}
                </div>

                <Icon className="h-8 w-8" style={{ color: intDef.color }} />
                <h3 className="font-bold">{intDef.name}</h3>
                <p className="text-sm text-muted-foreground">{intDef.desc}</p>

                {/* Connected info */}
                {connected && integration?.connected_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Conectado em {new Date(integration.connected_at).toLocaleDateString("pt-BR")}
                  </p>
                )}

                <div className="flex gap-2">
                  {connected ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openConnectModal(intDef)}>
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDisconnectType(intDef.type)}>
                        Desconectar
                      </Button>
                    </>
                  ) : comingSoon ? (
                    <Button variant="outline" size="sm" disabled>Em breve</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => openConnectModal(intDef)}>
                      Conectar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect / Edit Modal */}
      {connectModal && (
        <Dialog open onOpenChange={() => { if (!saving) setConnectModal(null); }}>
          <DialogContent className="glassmorphism max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <connectModal.icon className="h-5 w-5" style={{ color: connectModal.color }} />
                {isConnected(connectModal.type) ? `Editar ${connectModal.name}` : `Conectar ${connectModal.name}`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Step-by-step guide */}
              {connectModal.steps.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <button
                    onClick={() => setExpandedGuide(!expandedGuide)}
                    className="flex items-center justify-between w-full text-sm font-medium"
                  >
                    📋 Como conectar
                    {expandedGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {expandedGuide && (
                    <ol className="mt-3 space-y-2">
                      {connectModal.steps.map((step, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">{i + 1}</span>
                          <span className="text-muted-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* Link to service */}
              {connectModal.link && (
                <a href={connectModal.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {connectModal.linkLabel || "Obter credenciais"}
                </a>
              )}

              {/* Fields */}
              {connectModal.fields.filter((f) => f.type !== "oauth").map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="text-sm font-medium">{f.label}</label>
                  <div className="relative">
                    <Input
                      type={f.secret && !showSecrets[f.key] ? "password" : "text"}
                      placeholder={f.placeholder || ""}
                      value={fieldValues[f.key] || ""}
                      onChange={(e) => setFieldValues({ ...fieldValues, [f.key]: e.target.value })}
                    />
                    {f.secret && fieldValues[f.key] && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                        <Button
                          type="button" variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setShowSecrets({ ...showSecrets, [f.key]: !showSecrets[f.key] })}
                        >
                          {showSecrets[f.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          type="button" variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { navigator.clipboard.writeText(fieldValues[f.key]); toast({ title: "Copiado!" }); }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Save button */}
              {connectModal.fields.length > 0 && (
                <Button className="w-full gradient-cta border-0" onClick={handleConnect} disabled={saving}>
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
                  ) : isConnected(connectModal.type) ? (
                    <><Check className="h-4 w-4 mr-2" /> Salvar alterações</>
                  ) : (
                    <><PlugZap className="h-4 w-4 mr-2" /> Salvar e conectar</>
                  )}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Disconnect confirmation */}
      <AlertDialog open={!!disconnectType} onOpenChange={() => setDisconnectType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar integração?</AlertDialogTitle>
            <AlertDialogDescription>
              As credenciais salvas serão removidas e a integração deixará de funcionar.
              Você pode reconectar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive hover:bg-destructive/90">Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
