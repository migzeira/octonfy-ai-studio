import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Agent } from "@/hooks/useRealtimeAgents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const MODELS = [
  { value: "claude-haiku", label: "Claude Haiku" },
  { value: "llama-groq", label: "Llama Groq" },
  { value: "gemini-pro", label: "Gemini Pro" },
  { value: "claude-sonnet", label: "Claude Sonnet" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-opus", label: "Claude Opus" },
];

const COLOR_OPTIONS = ["#6366f1", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

interface EditAgentModalProps {
  agent: Agent;
  onClose: () => void;
}

export default function EditAgentModal({ agent, onClose }: EditAgentModalProps) {
  const [tab, setTab] = useState<"edit" | "perf">("edit");
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [specialty, setSpecialty] = useState(agent.specialty || "");
  const [color, setColor] = useState(agent.avatar_color || "#6366f1");
  const [model, setModel] = useState(agent.model || "claude-sonnet");
  const [prompt, setPrompt] = useState(agent.system_prompt || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("agents")
      .update({ name, role, specialty, avatar_color: color, model, system_prompt: prompt })
      .eq("id", agent.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Alterações salvas!" });
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg glassmorphism rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Editar {agent.name}</h2>

        <div className="flex gap-2 mb-4">
          <button className={`text-sm px-3 py-1 rounded-full ${tab === "edit" ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`} onClick={() => setTab("edit")}>
            Editar
          </button>
          <button className={`text-sm px-3 py-1 rounded-full ${tab === "perf" ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`} onClick={() => setTab("perf")}>
            Performance
          </button>
        </div>

        {tab === "edit" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modelo</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={model} onChange={(e) => setModel(e.target.value)}>
                  {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cor do avatar</Label>
                <div className="flex items-center gap-1">
                  {COLOR_OPTIONS.map((c) => (
                    <button key={c} className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} onClick={() => setColor(c)} />
                  ))}
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 cursor-pointer border-0 bg-transparent" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[150px]" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button className="flex-1 gradient-cta border-0" onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
              </Button>
            </div>
          </div>
        )}

        {tab === "perf" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold">{agent.credits_spent || 0}</p>
                <p className="text-xs text-muted-foreground">Créditos gastos</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold">{agent.messages_count || 0}</p>
                <p className="text-xs text-muted-foreground">Mensagens</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold">{agent.tasks_completed || 0}</p>
                <p className="text-xs text-muted-foreground">Tarefas concluídas</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-sm font-medium">{agent.created_at ? format(new Date(agent.created_at), "dd/MM/yyyy") : "—"}</p>
                <p className="text-xs text-muted-foreground">Membro desde</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
