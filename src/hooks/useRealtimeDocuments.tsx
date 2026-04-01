import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Document {
  id: string;
  workspace_id: string;
  title: string;
  content: string | null;
  type: string | null;
  tags: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useRealtimeDocuments(workspaceId: string | undefined) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    const fetchDocs = async () => {
      const { data } = await supabase.from("documents").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
      if (data) setDocuments(data as Document[]);
      setLoading(false);
    };
    fetchDocs();

    const channel = supabase.channel(`documents-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        if (payload.eventType === "INSERT") setDocuments((prev) => [payload.new as Document, ...prev]);
        else if (payload.eventType === "UPDATE") setDocuments((prev) => prev.map((d) => d.id === (payload.new as Document).id ? payload.new as Document : d));
        else if (payload.eventType === "DELETE") setDocuments((prev) => prev.filter((d) => d.id !== (payload.old as any).id));
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  return { documents, loading };
}
