import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Agent } from "@/hooks/useRealtimeAgents";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface FireAgentModalProps {
  agent: Agent;
  onClose: () => void;
}

export default function FireAgentModal({ agent, onClose }: FireAgentModalProps) {
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(false);

  const handleFire = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      await supabase
        .from("agents")
        .update({ is_active: false, status: "offline" })
        .eq("id", agent.id);

      await supabase.from("event_logs").insert({
        workspace_id: workspace.id,
        event_type: "fired",
        actor: "user",
        description: `Agente ${agent.name} foi desligado do escritório`,
        target: agent.name,
      });

      toast({ title: `${agent.name} foi desligado do escritório` });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm glassmorphism rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-2">Demitir {agent.name}?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Esta ação não pode ser desfeita. O histórico de mensagens será mantido.
        </p>
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
            style={{ background: agent.avatar_color || "#6366f1" }}
          >
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" className="flex-1" onClick={handleFire} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Demitir"}
          </Button>
        </div>
      </div>
    </div>
  );
}
