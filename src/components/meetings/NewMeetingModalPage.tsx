import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Agent } from "@/hooks/useRealtimeAgents";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Props { agents: Agent[]; workspaceId: string; onClose: () => void; }

export function NewMeetingModal({ agents, workspaceId, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const toggle = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleCreate = async () => {
    if (!title.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    if (selected.length < 2) { toast({ title: "Selecione pelo menos 2 participantes", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("meetings").insert({
      workspace_id: workspaceId, title: title.trim(), participants: selected,
      status: "in_progress", started_at: new Date().toISOString(),
    });
    if (error) { toast({ title: "Erro ao criar reunião", variant: "destructive" }); setSaving(false); return; }
    // Update agents status
    await supabase.from("agents").update({ status: "in_meeting" }).in("id", selected);
    toast({ title: "✓ Reunião iniciada" });
    onClose();
    navigate("/office");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glassmorphism max-w-lg">
        <DialogHeader><DialogTitle>Nova Reunião</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Título da reunião" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Descreva o tema ou pauta da reunião..." rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
          <div>
            <label className="text-sm font-medium mb-2 block">Selecionar participantes (mínimo 2)</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {agents.filter((a) => a.is_active).map((a) => (
                <button key={a.id} onClick={() => toggle(a.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left text-sm transition-all ${selected.includes(a.id) ? "border-accent bg-accent/10" : "border-border"}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: a.avatar_color || "#6366f1" }}>
                    {a.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div><p className="font-medium text-xs">{a.name}</p><p className="text-[10px] text-muted-foreground">{a.role}</p></div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{selected.length} agentes selecionados</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gradient-cta border-0" onClick={handleCreate} disabled={saving}>{saving ? "Iniciando..." : "Iniciar agora"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
