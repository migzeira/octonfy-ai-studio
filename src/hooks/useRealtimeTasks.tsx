import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string | null;
}

export function useRealtimeTasks(workspaceId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const fetchTasks = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (data) setTasks(data as Task[]);
      setLoading(false);
    };
    fetchTasks();

    const channel = supabase
      .channel(`tasks-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        if (payload.eventType === "INSERT") setTasks((prev) => [payload.new as Task, ...prev]);
        else if (payload.eventType === "UPDATE") setTasks((prev) => prev.map((t) => t.id === (payload.new as Task).id ? payload.new as Task : t));
        else if (payload.eventType === "DELETE") setTasks((prev) => prev.filter((t) => t.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  return { tasks, loading };
}
