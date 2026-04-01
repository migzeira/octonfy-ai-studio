import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeAgents } from "@/hooks/useRealtimeAgents";
import { useRealtimeTasks, Task } from "@/hooks/useRealtimeTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, CheckSquare, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/tasks/KanbanColumn";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskModal } from "@/components/tasks/TaskModal";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";

const COLUMNS = [
  { id: "todo", label: "A Fazer", color: "#94a3b8", border: false },
  { id: "in_progress", label: "Em Andamento", color: "#3b82f6", border: true },
  { id: "done", label: "Concluído", color: "#22c55e", border: true },
  { id: "cancelled", label: "Cancelado", color: "#ef4444", border: true },
] as const;

const PRIORITIES = ["all", "urgent", "high", "medium", "low"] as const;
const DATE_FILTERS = ["all", "today", "week", "overdue"] as const;

export default function TasksPage() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const { agents } = useRealtimeAgents(workspace?.id);
  const { tasks, loading } = useRealtimeTasks(workspace?.id);

  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(() => {
    const now = new Date();
    return tasks.filter((t) => {
      if (search) {
        const s = search.toLowerCase();
        if (!t.title.toLowerCase().includes(s) && !(t.description || "").toLowerCase().includes(s)) return false;
      }
      if (agentFilter && t.assigned_to !== agentFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (dateFilter === "today") {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        if (d.toDateString() !== now.toDateString()) return false;
      }
      if (dateFilter === "week") {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (d > weekEnd) return false;
      }
      if (dateFilter === "overdue") {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        if (d >= now || t.status === "done" || t.status === "cancelled") return false;
      }
      return true;
    });
  }, [tasks, search, agentFilter, priorityFilter, dateFilter]);

  const columnTasks = (status: string) => filtered.filter((t) => t.status === status);
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newStatus = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const updates: any = { status: newStatus };
    if (newStatus === "done") updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;

    const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
    if (error) { toast({ title: "Erro ao mover tarefa", variant: "destructive" }); return; }

    if (newStatus === "done" && task.assigned_to) {
      await supabase.rpc("is_workspace_owner", { _workspace_id: workspace?.id || "" });
      // Increment tasks_completed
      const agent = agents.find((a) => a.id === task.assigned_to);
      if (agent) {
        await supabase.from("agents").update({ tasks_completed: (agent.tasks_completed || 0) + 1 }).eq("id", agent.id);
      }
    }

    await supabase.from("event_logs").insert({
      workspace_id: workspace!.id,
      event_type: newStatus === "done" ? "task_completed" : "task_updated",
      actor: "Você",
      target: task.title,
      description: `Tarefa movida para ${COLUMNS.find((c) => c.id === newStatus)?.label}`,
    });

    toast({ title: `Tarefa movida para ${COLUMNS.find((c) => c.id === newStatus)?.label}` });
  };

  const draggedTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  if (wsLoading || !workspace) {
    return (
      <div className="p-6 flex flex-col h-[calc(100vh-0px)] max-h-screen">
        <Skeleton className="h-12 w-64 mb-4" />
        <div className="flex gap-4 flex-1">
          {COLUMNS.map((c) => <Skeleton key={c.id} className="flex-1 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-0px)] max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">
            {tasks.length} tarefas · {inProgressCount} em andamento
          </p>
        </div>
        <Button className="gradient-cta border-0" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarefas..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
          <option value="">Todos os agentes</option>
          {agents.filter((a) => a.is_active).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {PRIORITIES.map((p) => (
            <button key={p} onClick={() => setPriorityFilter(p)} className={`px-3 py-1 rounded-full text-xs transition-all ${priorityFilter === p ? "gradient-cta text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {p === "all" ? "Todas" : p === "urgent" ? "Urgente" : p === "high" ? "Alta" : p === "medium" ? "Média" : "Baixa"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {DATE_FILTERS.map((d) => (
            <button key={d} onClick={() => setDateFilter(d)} className={`px-3 py-1 rounded-full text-xs transition-all ${dateFilter === d ? "gradient-cta text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {d === "all" ? "Todas" : d === "today" ? "Hoje" : d === "week" ? "Esta semana" : "Vencidas"}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="flex gap-4 flex-1">
          {COLUMNS.map((c) => <Skeleton key={c.id} className="flex-1 rounded-xl" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 flex-1 overflow-hidden">
            {COLUMNS.map((col) => (
              <KanbanColumn key={col.id} id={col.id} label={col.label} color={col.color} border={col.border} tasks={columnTasks(col.id)} agents={agents} onClickTask={setDetailTask} />
            ))}
          </div>
          <DragOverlay>
            {draggedTask ? <TaskCard task={draggedTask} agents={agents} onClick={() => {}} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {createOpen && <TaskModal agents={agents} workspaceId={workspace!.id} onClose={() => setCreateOpen(false)} />}
      {editTask && <TaskModal task={editTask} agents={agents} workspaceId={workspace!.id} onClose={() => setEditTask(null)} />}
      {detailTask && <TaskDetailModal task={detailTask} agents={agents} workspaceId={workspace!.id} onClose={() => setDetailTask(null)} onEdit={(t) => { setDetailTask(null); setEditTask(t); }} />}
    </div>
  );
}
