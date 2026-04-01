import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

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

    const channel = supabase
      .channel(`credits-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credits",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.new) setCredits(payload.new as Credits);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  return { credits, loading };
}
