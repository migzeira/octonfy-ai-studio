import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeAgents } from "@/hooks/useRealtimeAgents";
import { useRealtimeMeetings } from "@/hooks/useRealtimeMeetings";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { NewMeetingModal } from "@/components/meetings/NewMeetingModalPage";
import { TranscriptModal } from "@/components/meetings/TranscriptModal";
import { useNavigate } from "react-router-dom";

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Agendada", color: "#94a3b8" },
  in_progress: { label: "Em andamento", color: "#22c55e" },
  completed: { label: "Concluída", color: "#6366f1" },
};
const FILTERS = ["all", "scheduled", "in_progress", "completed"];

export default function MeetingsPage() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const { agents } = useRealtimeAgents(workspace?.id);
  const { meetings, loading } = useRealtimeMeetings(workspace?.id);
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [transcriptMeeting, setTranscriptMeeting] = useState<any>(null);

  if (wsLoading || !workspace) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      </div>
    );
  }

  const filtered = useMemo(() => {
    if (filter === "all") return meetings;
    return meetings.filter((m) => m.status === filter);
  }, [meetings, filter]);

  const getAgentName = (id: string) => agents.find((a) => a.id === id)?.name || "Agente";
  const getAgentColor = (id: string) => agents.find((a) => a.id === id)?.avatar_color || "#6366f1";

  const getDuration = (m: any) => {
    if (!m.started_at) return null;
    const start = new Date(m.started_at).getTime();
    const end = m.ended_at ? new Date(m.ended_at).getTime() : Date.now();
    return Math.floor((end - start) / 60000);
  };

  const handleExportTranscript = async (meeting: any) => {
    const transcript = (meeting.transcript || []) as any[];
    const content = transcript.map((t: any) => `**${t.agent_name || "Agente"}**: ${t.content}`).join("\n\n");
    await supabase.from("documents").insert({
      workspace_id: workspace!.id, title: `Transcrição: ${meeting.title}`,
      content, type: "meeting_summary", created_by: "system",
    });
    toast({ title: "✓ Transcrição exportada como documento" });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Reuniões</h1></div>
        <Button className="gradient-cta border-0" onClick={() => setNewOpen(true)}>
          <Video className="h-4 w-4 mr-2" /> Nova Reunião
        </Button>
      </div>

      <div className="flex gap-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-xs transition-all ${filter === f ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>
            {f === "all" ? "Todas" : STATUS_INFO[f]?.label || f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center"><Video className="h-10 w-10 text-muted-foreground" /></div>
          <h2 className="text-xl font-bold">Nenhuma reunião</h2>
          <Button className="gradient-cta border-0" onClick={() => setNewOpen(true)}>Criar primeira reunião</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((meeting) => {
            const st = STATUS_INFO[meeting.status || "scheduled"] || STATUS_INFO.scheduled;
            const duration = getDuration(meeting);
            const participants = (meeting.participants || []) as string[];
            return (
              <div key={meeting.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-accent transition-all">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meeting.status === "in_progress" ? "animate-pulse" : ""}`} style={{ background: `${st.color}20` }}>
                  <Video className="h-5 w-5" style={{ color: st.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">{meeting.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${st.color}20`, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex -space-x-2">
                      {participants.slice(0, 5).map((pid) => (
                        <div key={pid} className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[8px] font-bold text-white" style={{ background: getAgentColor(pid) }}>
                          {getAgentName(pid).slice(0, 2).toUpperCase()}
                        </div>
                      ))}
                      {participants.length > 5 && <span className="text-xs text-muted-foreground ml-2">+{participants.length - 5}</span>}
                    </div>
                    {meeting.status === "completed" && duration != null && <span className="text-xs text-muted-foreground">Duração: {duration} min</span>}
                    {meeting.status === "in_progress" && duration != null && <span className="text-xs text-success">Em andamento há {duration} min</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{meeting.created_at ? new Date(meeting.created_at).toLocaleDateString("pt-BR") : ""}</span>
                  {(meeting.status === "scheduled" || meeting.status === "in_progress") && (
                    <Button variant="outline" size="sm" onClick={() => navigate("/office")}>Entrar</Button>
                  )}
                  {meeting.status === "completed" && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setTranscriptMeeting(meeting)}>Transcrição</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleExportTranscript(meeting)}>Exportar</Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {newOpen && <NewMeetingModal agents={agents} workspaceId={workspace!.id} onClose={() => setNewOpen(false)} />}
      {transcriptMeeting && <TranscriptModal meeting={transcriptMeeting} agents={agents} onClose={() => setTranscriptMeeting(null)} />}
    </div>
  );
}
