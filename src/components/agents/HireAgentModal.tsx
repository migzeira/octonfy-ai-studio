import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Check } from "lucide-react";

const COLOR_OPTIONS = ["#6366f1", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

const MODELS = [
  { value: "claude-haiku", label: "Claude Haiku", cost: "2 créditos/1k tokens", tag: "Rápido" },
  { value: "llama-groq", label: "Llama Groq", cost: "2 créditos/1k tokens", tag: "Velocidade máx" },
  { value: "gemini-pro", label: "Gemini Pro", cost: "6 créditos/1k tokens", tag: "Contexto longo" },
  { value: "claude-sonnet", label: "Claude Sonnet", cost: "8 créditos/1k tokens", tag: "Recomendado" },
  { value: "gpt-4o", label: "GPT-4o", cost: "10 créditos/1k tokens", tag: "Generalista" },
  { value: "claude-opus", label: "Claude Opus", cost: "20 créditos/1k tokens", tag: "Máx inteligência" },
];

const DEFAULT_PERMISSIONS = {
  can_create_tasks: true,
  can_create_documents: true,
  can_send_dm: true,
  can_start_meetings: false,
  can_hire_agents: false,
  can_fire_agents: false,
};

interface HireAgentModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HireAgentModal({ open, onClose }: HireAgentModalProps) {
  const { workspace } = useWorkspace();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [customColor, setCustomColor] = useState("");
  const [model, setModel] = useState("claude-sonnet");
  const [prompt, setPrompt] = useState("");
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!workspace) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-system-prompt", {
        body: {
          agent_name: name,
          agent_role: role,
          agent_specialty: specialty,
          workspace_name: workspace.name,
          workspace_mission: workspace.mission,
          workspace_products: workspace.products,
        },
      });
      if (error) throw error;
      setPrompt(data.system_prompt);
      toast({ title: `✨ Gerado! Custo: ~${data.credits_used} créditos` });
    } catch (err: any) {
      toast({ title: "Erro ao gerar prompt", description: err.message, variant: "destructive" });
    } finally {
      setGenLoading(false);
    }
  };

  const handleHire = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const finalPrompt = prompt + `\n\nPERMISSÕES: ${JSON.stringify(permissions)}`;
      const { error } = await supabase.from("agents").insert({
        workspace_id: workspace.id,
        name,
        role,
        specialty,
        model,
        avatar_color: customColor || color,
        system_prompt: finalPrompt,
        is_active: true,
        status: "idle",
      });
      if (error) throw error;

      await supabase.from("event_logs").insert({
        workspace_id: workspace.id,
        event_type: "hired",
        actor: "user",
        description: `Agente ${name} contratado como ${role}`,
        target: name,
      });

      toast({ title: `✓ ${name} foi contratado e está pronto!` });
      resetAndClose();
    } catch (err: any) {
      toast({ title: "Erro ao contratar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep(0);
    setName("");
    setRole("");
    setSpecialty("");
    setColor("#6366f1");
    setCustomColor("");
    setModel("claude-sonnet");
    setPrompt("");
    setPermissions(DEFAULT_PERMISSIONS);
    onClose();
  };

  const permLabels: Record<string, string> = {
    can_create_tasks: "Pode criar tarefas",
    can_create_documents: "Pode criar documentos",
    can_send_dm: "Pode enviar mensagens diretas",
    can_start_meetings: "Pode iniciar reuniões",
    can_hire_agents: "Pode contratar agentes",
    can_fire_agents: "Pode demitir agentes",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={resetAndClose}>
      <div className="w-full max-w-lg glassmorphism rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[0, 1, 2].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                s < step ? "bg-accent text-white" : s === step ? "gradient-cta text-white" : "bg-muted text-muted-foreground"
              }`}>
                {s < step ? <Check className="h-4 w-4" /> : s + 1}
              </div>
              {s < 2 && <div className={`w-8 h-0.5 mx-1 ${s < step ? "bg-accent" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Informações básicas</h2>
            <div className="space-y-2">
              <Label>Nome do agente</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Ex: "Sofia", "Marcus"' />
            </div>
            <div className="space-y-2">
              <Label>Cargo / título</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder='Ex: "Head de Marketing"' />
            </div>
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder='Ex: "Copywriting e SEO"' />
            </div>
            <div className="space-y-2">
              <Label>Cor do avatar</Label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c && !customColor ? "border-white scale-110" : "border-transparent"}`}
                    style={{ background: c }}
                    onClick={() => { setColor(c); setCustomColor(""); }}
                  />
                ))}
                <Input
                  type="color"
                  className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer"
                  value={customColor || color}
                  onChange={(e) => setCustomColor(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Modelo de IA</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={model} onChange={(e) => setModel(e.target.value)}>
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} — {m.cost} ({m.tag})
                  </option>
                ))}
              </select>
            </div>
            <Button className="w-full gradient-cta border-0" disabled={!name || !role} onClick={() => setStep(1)}>
              Continuar
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">System Prompt</h2>
            <p className="text-sm text-muted-foreground">
              O system prompt define a personalidade e comportamento do agente. Seja específico.
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva como este agente deve se comportar, seu tom de voz, responsabilidades e o que ele NÃO deve fazer..."
              className="min-h-[200px]"
            />
            <Button variant="outline" className="w-full" onClick={handleGenerate} disabled={genLoading || !name || !role}>
              {genLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {genLoading ? "Gerando..." : "✨ Gerar com IA"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Voltar</Button>
              <Button className="flex-1 gradient-cta border-0" onClick={() => setStep(2)}>Continuar</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Permissões</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(permLabels).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(permissions as any)[key]}
                    onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                    className="rounded"
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* Preview */}
            <div className="border border-border rounded-xl p-4 bg-card/50 mt-4">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: customColor || color }}>
                  {name.slice(0, 2).toUpperCase() || "??"}
                </div>
                <div>
                  <p className="font-semibold">{name || "Nome"}</p>
                  <p className="text-xs text-muted-foreground">{role || "Cargo"} · {model}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="flex-1 gradient-cta border-0" onClick={handleHire} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Contratar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
