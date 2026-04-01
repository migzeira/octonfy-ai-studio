import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EventLog {
  id: string;
  workspace_id: string;
  event_type: string;
  actor: string;
  target: string | null;
  description: string;
  metadata: any;
  created_at: string | null;
}

export function useRealtimeEvents(workspaceId: string | undefined, limit = 20) {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("event_logs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (data) setEvents(data as EventLog[]);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel(`events-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_logs",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          setEvents((prev) => [payload.new as EventLog, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, limit]);

  return { events, loading };
}
