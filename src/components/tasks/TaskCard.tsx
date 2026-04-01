import { Task } from "@/hooks/useRealtimeTasks";
import { Agent } from "@/hooks/useRealtimeAgents";
import { AlertTriangle } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";

const PRIORITY_BADGE: Record<string, { label: string; emoji: string; color: string }> = {
  urgent: { label: "Urgente", emoji: "🔴", color: "#ef4444" },
  high: { label: "Alta", emoji: "🟠", color: "#f97316" },
  medium: { label: "Média", emoji: "🔵", color: "#3b82f6" },
  low: { label: "Baixa", emoji: "⚪", color: "#94a3b8" },
};

interface Props {
  task: Task;
  agents: Agent[];
  onClick: (t: Task) => void;
  isDragging?: boolean;
}

export function TaskCard({ task, agents, onClick, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id, data: { type: "task" } });
  const agent = agents.find((a) => a.id === task.assigned_to);
  const priority = PRIORITY_BADGE[task.priority || "medium"] || PRIORITY_BADGE.medium;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done" && task.status !== "cancelled";

  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-accent transition-all group"
    >
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${priority.color}20`, color: priority.color }}>
        {priority.emoji} {priority.label}
      </span>
      <p className="font-bold text-sm mt-2 line-clamp-2">{task.title}</p>
      {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
      {task.created_by !== "user" && (
        <span className="text-[10px] px-2 py-0.5 rounded-full mt-2 inline-block" style={{ background: "hsl(var(--accent) / 0.2)", color: "hsl(var(--accent))" }}>Criada por IA</span>
      )}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {agent ? (
            <>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: agent.avatar_color || "#6366f1" }}>
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <span>{agent.name}</span>
            </>
          ) : <span>Sem responsável</span>}
        </div>
        {task.due_date && (
          <span className={isOverdue ? "text-destructive flex items-center gap-1" : ""}>
            {isOverdue && <AlertTriangle className="h-3 w-3" />}
            {new Date(task.due_date).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </div>
  );
}
