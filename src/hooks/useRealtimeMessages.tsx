import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  workspace_id: string;
  from_agent_id: string | null;
  to_agent_id: string | null;
  meeting_id: string | null;
  content: string;
  type: string;
  tokens_used: number | null;
  credits_used: number | null;
  created_at: string | null;
}

export function useRealtimeMessages(workspaceId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) setMessages(data as Message[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!workspaceId) return;
    fetchMessages();

    const channel = supabase
      .channel(`messages-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  return { messages, setMessages, loading, refetch: fetchMessages };
}
