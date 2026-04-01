import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  role: string;
  specialty: string | null;
  model: string | null;
  system_prompt: string | null;
  status: string | null;
  is_active: boolean | null;
  position_x: number | null;
  position_y: number | null;
  avatar_color: string | null;
  credits_spent: number | null;
  messages_count: number | null;
  tasks_completed: number | null;
  created_at: string | null;
}

export function useRealtimeAgents(workspaceId: string | undefined) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("agents")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (data) setAgents(data as Agent[]);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel(`agents-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agents",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          setAgents((prev) => [payload.new as Agent, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agents",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          setAgents((prev) =>
            prev.map((a) => (a.id === (payload.new as Agent).id ? (payload.new as Agent) : a))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  return { agents, setAgents, loading };
}
