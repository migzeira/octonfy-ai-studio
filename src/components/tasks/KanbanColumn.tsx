import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task } from "@/hooks/useRealtimeTasks";
import { Agent } from "@/hooks/useRealtimeAgents";
import { TaskCard } from "./TaskCard";

interface Props {
  id: string;
  label: string;
  color: string;
  border: boolean;
  tasks: Task[];
  agents: Agent[];
  onClickTask: (t: Task) => void;
}

export function KanbanColumn({ id, label, color, border, tasks, agents, onClickTask }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 min-w-[250px] flex flex-col rounded-xl bg-background"
      style={{ borderTop: border ? `2px solid ${color}` : undefined }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color }}>{label}</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{tasks.length}</span>
        </div>
      </div>
      <div className={`flex-1 overflow-y-auto px-2 pb-2 space-y-2 transition-colors rounded-b-xl ${isOver ? "bg-muted/50 border border-dashed border-accent" : ""}`}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma tarefa</div>
          ) : (
            tasks.map((task) => <TaskCard key={task.id} task={task} agents={agents} onClick={onClickTask} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}
