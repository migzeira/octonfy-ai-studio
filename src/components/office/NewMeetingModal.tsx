import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { Agent } from "@/hooks/useRealtimeAgents";

interface NewMeetingModalProps {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  workspaceId: string;
}

export default function NewMeetingModal({ open, onClose, agents, workspaceId }: NewMeetingModalProps) {
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const activeAgents = agents.filter(a => a.is_active);

  const toggleAgent = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleStart = async () => {
    if (!title.trim() || selected.length < 2) {
      toast({ title: "Selecione pelo menos 2 participantes", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Create meeting
      const { data: meeting, error } = await supabase.from("meetings").insert({
        workspace_id: workspaceId,
        title: title.trim(),
        summary: agenda.trim() || null,
        participants: selected,
        status: "in_progress",
        started_at: new Date().toISOString(),
        transcript: [],
      }).select().single();

      if (error) throw error;

      // Update agents status
      for (const id of selected) {
        await supabase.from("agents").update({ status: "in_meeting" }).eq("id", id);
      }

      // Log event
      await supabase.from("event_logs").insert({
        workspace_id: workspaceId,
        event_type: "meeting_started",
        actor: "user",
        description: `Reunião "${title}" iniciada com ${selected.length} participantes`,
      });

      toast({ title: "Reunião iniciada!", description: `${selected.length} participantes` });
      onClose();

      // Trigger meeting in background
      supabase.functions.invoke("start-meeting", {
        body: { meeting_id: meeting.id, workspace_id: workspaceId },
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="glassmorphism relative z-10 w-full max-w-md rounded-xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">Nova Reunião</h2>

        <div>
          <label className="text-xs text-muted-foreground">Título</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Alinhamento semanal" />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Pauta (opcional)</label>
          <Textarea value={agenda} onChange={e => setAgenda(e.target.value)} placeholder="Tópicos a discutir..." rows={2} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Participantes (mín. 2)</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activeAgents.map(agent => (
              <label key={agent.id} className="flex items-center gap-3 p-2 rounded-lg bg-card border border-border cursor-pointer hover:bg-accent/10">
                <input type="checkbox" checked={selected.includes(agent.id)} onChange={() => toggleAgent(agent.id)}
                  className="rounded border-border" />
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: agent.avatar_color || "#6366f1" }}>
                  {agent.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm text-foreground">{agent.name}</div>
                  <div className="text-[10px] text-muted-foreground">{agent.role}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleStart} disabled={loading} className="bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar Reunião"}
          </Button>
        </div>
      </div>
    </div>
  );
}
