import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/hooks/useRealtimeTasks";
import { Agent } from "@/hooks/useRealtimeAgents";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

const STATUS_LABELS: Record<string, string> = { todo: "A Fazer", in_progress: "Em Andamento", done: "Concluído", cancelled: "Cancelado" };
const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  urgent: { label: "🔴 Urgente", color: "#ef4444" },
  high: { label: "🟠 Alta", color: "#f97316" },
  medium: { label: "🔵 Média", color: "#3b82f6" },
  low: { label: "⚪ Baixa", color: "#94a3b8" },
};

interface Props { task: Task; agents: Agent[]; workspaceId: string; onClose: () => void; onEdit: (t: Task) => void; }

export function TaskDetailModal({ task, agents, workspaceId, onClose, onEdit }: Props) {
  const [history, setHistory] = useState<any[]>([]);
  const agent = agents.find((a) => a.id === task.assigned_to);
  const p = PRIORITY_LABELS[task.priority || "medium"] || PRIORITY_LABELS.medium;

  useEffect(() => {
    supabase.from("event_logs").select("*").eq("workspace_id", workspaceId)
      .or(`target.eq.${task.title},metadata->>task_id.eq.${task.id}`)
      .order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setHistory(data); });
  }, [task.id]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glassmorphism max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{task.title}</span>
            <Button variant="ghost" size="icon" onClick={() => onEdit(task)}><Pencil className="h-4 w-4" /></Button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Status:</span> <span className="ml-2 font-medium">{STATUS_LABELS[task.status || "todo"]}</span></div>
            <div><span className="text-muted-foreground">Prioridade:</span> <span className="ml-2" style={{ color: p.color }}>{p.label}</span></div>
            <div><span className="text-muted-foreground">Responsável:</span> <span className="ml-2">{agent ? agent.name : "Sem responsável"}</span></div>
            <div><span className="text-muted-foreground">Criado por:</span> <span className="ml-2">{task.created_by === "user" ? "Você" : "IA"}</span></div>
            {task.due_date && <div><span className="text-muted-foreground">Data limite:</span> <span className="ml-2">{new Date(task.due_date).toLocaleDateString("pt-BR")}</span></div>}
            {task.completed_at && <div><span className="text-muted-foreground">Concluída:</span> <span className="ml-2">{new Date(task.completed_at).toLocaleDateString("pt-BR")}</span></div>}
            <div><span className="text-muted-foreground">Criada em:</span> <span className="ml-2">{task.created_at ? new Date(task.created_at).toLocaleDateString("pt-BR") : "-"}</span></div>
          </div>
          {history.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Histórico</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {history.map((h: any) => (
                  <div key={h.id} className="text-xs flex gap-2 text-muted-foreground">
                    <span>{h.created_at ? new Date(h.created_at).toLocaleString("pt-BR") : ""}</span>
                    <span>{h.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
