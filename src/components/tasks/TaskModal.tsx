import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/hooks/useRealtimeTasks";
import { Agent } from "@/hooks/useRealtimeAgents";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const PRIORITIES = [
  { value: "low", label: "Baixa", color: "#94a3b8" },
  { value: "medium", label: "Média", color: "#3b82f6" },
  { value: "high", label: "Alta", color: "#f97316" },
  { value: "urgent", label: "Urgente", color: "#ef4444" },
];

interface Props {
  task?: Task;
  agents: Agent[];
  workspaceId: string;
  onClose: () => void;
}

export function TaskModal({ task, agents, workspaceId, onClose }: Props) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to || "");
  const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.split("T")[0] : "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigned_to: assignedTo || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      workspace_id: workspaceId,
    };

    if (task) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
      if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); setSaving(false); return; }
      toast({ title: "✓ Tarefa atualizada" });
    } else {
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) { toast({ title: "Erro ao criar", variant: "destructive" }); setSaving(false); return; }
      await supabase.from("event_logs").insert({ workspace_id: workspaceId, event_type: "task_created", actor: "Você", target: title.trim(), description: "Tarefa criada" });
      toast({ title: "✓ Tarefa criada" });
    }
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glassmorphism max-w-md">
        <DialogHeader><DialogTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Título da tarefa" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Descrição" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <label className="text-sm font-medium mb-2 block">Prioridade</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button key={p.value} onClick={() => setPriority(p.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${priority === p.value ? "text-white" : "bg-muted text-muted-foreground"}`}
                  style={priority === p.value ? { background: p.color } : {}}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Agente responsável</label>
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Sem responsável</option>
              {agents.filter((a) => a.is_active).map((a) => (
                <option key={a.id} value={a.id}>{a.name} — {a.role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Data limite</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button className="w-full gradient-cta border-0" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : task ? "Salvar" : "Criar Tarefa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
