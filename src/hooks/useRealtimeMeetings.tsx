import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Meeting {
  id: string;
  workspace_id: string;
  title: string;
  participants: string[] | null;
  status: string | null;
  transcript: any;
  summary: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
}

export function useRealtimeMeetings(workspaceId: string | undefined) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("meetings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (data) {
        const typed = data as Meeting[];
        setMeetings(typed);
        setActiveMeeting(typed.find(m => m.status === "in_progress") || null);
      }
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel(`meetings-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetings", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const m = payload.new as Meeting;
            setMeetings(prev => [m, ...prev]);
            if (m.status === "in_progress") setActiveMeeting(m);
          } else if (payload.eventType === "UPDATE") {
            const m = payload.new as Meeting;
            setMeetings(prev => prev.map(x => x.id === m.id ? m : x));
            if (m.status === "in_progress") setActiveMeeting(m);
            else if (activeMeeting?.id === m.id && m.status !== "in_progress") setActiveMeeting(null);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  return { meetings, activeMeeting, setActiveMeeting, loading };
}
