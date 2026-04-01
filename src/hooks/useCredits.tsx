import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

export function useCredits() {
  const { workspace } = useWorkspace();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("credits")
        .select("balance")
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      if (data) setBalance(data.balance);
      setLoading(false);
    };
    fetch();
  }, [workspace]);

  return { balance, loading };
}
