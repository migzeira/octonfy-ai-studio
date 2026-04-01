import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Credits {
  balance: number;
  reserved: number;
  total_purchased: number;
  total_consumed: number;
  updated_at: string | null;
}

export function useRealtimeCredits(workspaceId: string | undefined) {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [loading, setLoading] = useState(true);
  const channelInstanceRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!workspaceId) {
      setCredits(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetch = async () => {
      const { data } = await supabase
        .from("credits")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (data) setCredits(data as Credits);
      setLoading(false);
    };
    fetch();

    const channel = supabase.channel(`credits-${workspaceId}-${channelInstanceRef.current}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "credits",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          setCredits(null);
          return;
        }

        if (payload.new) {
          setCredits(payload.new as Credits);
        }
      }
    );

    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  return { credits, loading };
}
