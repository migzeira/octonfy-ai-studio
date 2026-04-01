import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2 } from "lucide-react";

const STEP_TITLES = [
  "Como se chama sua empresa?",
  "Qual é a missão da sua empresa?",
  "O que você vende ou oferece?",
  "Como é a cultura da sua empresa?",
  "Contrate seu primeiro agente",
];

const STEP_SUBTITLES = [
  "Esse será o nome do seu escritório de IA.",
  "Descreva os objetivos e propósitos principais.",
  "Liste seus produtos ou serviços principais.",
  "Valores, tom de voz e jeito de trabalhar.",
  "Sugerimos começar com um CEO para coordenar seu time.",
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [mission, setMission] = useState("");
  const [products, setProducts] = useState("");
  const [culture, setCulture] = useState("");

  const [agentName, setAgentName] = useState("CEO");
  const [agentRole, setAgentRole] = useState("Chief Executive Officer");
  const [agentSpecialty, setAgentSpecialty] = useState("Gestão estratégica e coordenação de equipes");
  const [agentModel, setAgentModel] = useState("claude-sonnet");
  const [agentColor, setAgentColor] = useState("#6366f1");
  const [agentPrompt, setAgentPrompt] = useState("");

  // Set default prompt when company name changes
  const getDefaultPrompt = (name: string) =>
    `Você é o CEO da empresa ${name || "[nome]"}. Sua função é coordenar a equipe, delegar tarefas, conduzir reuniões e garantir que os objetivos da empresa sejam alcançados. Tome decisões estratégicas, motive a equipe e mantenha o foco nos resultados.`;

  const canContinue = () => {
    if (step === 0) return companyName.trim().length > 0;
    if (step === 4) return agentName.trim().length > 0 && agentRole.trim().length > 0;
    return true;
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Guard: if workspace already exists, skip creation
      const { data: existing } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (existing) {
        navigate("/office", { replace: true });
        return;
      }

      // 1. Create workspace
      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .insert({ user_id: user.id, name: companyName, mission, products, culture })
        .select()
        .single();

      if (wsErr || !ws) throw wsErr;

      // 2. Create credits
      await supabase.from("credits").insert({ workspace_id: ws.id, balance: 500 });

      // 3. Create CEO agent
      const prompt = agentPrompt || getDefaultPrompt(companyName);
      await supabase.from("agents").insert({
        workspace_id: ws.id,
        name: agentName,
        role: agentRole,
        specialty: agentSpecialty,
        model: agentModel,
        avatar_color: agentColor,
        system_prompt: prompt,
      });

      // 4. Log event
      await supabase.from("event_logs").insert({
        workspace_id: ws.id,
        event_type: "hired",
        actor: "user",
        description: `Agente ${agentName} contratado como ${agentRole}`,
        target: agentName,
      });

      navigate("/office", { replace: true });
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else handleFinish();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Progress Bar */}
      <div className="w-full max-w-lg mb-10">
        <div className="flex items-center justify-between">
          {[0, 1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  s < step
                    ? "bg-accent text-white"
                    : s === step
                    ? "bg-primary text-white animate-pulse-slow glow-neon"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? <Check className="h-5 w-5" /> : s + 1}
              </div>
              {s < 4 && (
                <div className={`w-12 sm:w-20 h-0.5 mx-1 ${s < step ? "bg-accent" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-lg glassmorphism rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-2">{STEP_TITLES[step]}</h2>
        <p className="text-muted-foreground text-sm mb-6">{STEP_SUBTITLES[step]}</p>

        {step === 0 && (
          <div className="space-y-2">
            <Label>Nome da empresa</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: Acme Corp" autoFocus />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <Label>Missão</Label>
            <Textarea value={mission} onChange={(e) => setMission(e.target.value)} placeholder="Descreva a missão da sua empresa..." rows={4} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label>Produtos ou serviços</Label>
            <Textarea value={products} onChange={(e) => setProducts(e.target.value)} placeholder="O que sua empresa vende ou oferece..." rows={4} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <Label>Cultura</Label>
            <Textarea value={culture} onChange={(e) => setCulture(e.target.value)} placeholder="Valores, tom de voz, jeito de trabalhar..." rows={4} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do agente</Label>
                <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={agentRole} onChange={(e) => setAgentRole(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Input value={agentSpecialty} onChange={(e) => setAgentSpecialty(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modelo de IA</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={agentModel}
                  onChange={(e) => setAgentModel(e.target.value)}
                >
                  <option value="claude-sonnet">Claude Sonnet</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gemini-pro">Gemini Pro</option>
                  <option value="llama-3">Llama 3</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cor do avatar</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={agentColor}
                    onChange={(e) => setAgentColor(e.target.value)}
                    className="w-10 h-10 rounded-md cursor-pointer border-0 bg-transparent"
                  />
                  <span className="text-sm text-muted-foreground">{agentColor}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea
                value={agentPrompt || getDefaultPrompt(companyName)}
                onChange={(e) => setAgentPrompt(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              Voltar
            </Button>
          )}
          <Button
            className="flex-1 gradient-cta border-0"
            onClick={handleNext}
            disabled={!canContinue() || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 4 ? "Finalizar" : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
