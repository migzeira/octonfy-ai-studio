import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find active schedules that are due
    const now = new Date().toISOString();
    const { data: schedules, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("is_active", true)
      .lte("next_run", now);

    if (error) throw error;
    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: "No schedules to run" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results = [];

    for (const schedule of schedules) {
      try {
        // Call send-message for this schedule's agent
        if (schedule.agent_id) {
          const { data: smData, error: smError } = await supabase.functions.invoke("send-message", {
            body: {
              message: schedule.instruction,
              agent_id: schedule.agent_id,
              workspace_id: schedule.workspace_id,
              history: [],
            },
          });

          if (smError) console.error("send-message error:", smError);
        }

        // Calculate next_run
        const calcNext = (freq: string, time: string | null, days: string[] | null) => {
          const next = new Date();
          const [h, m] = (time || "08:00").split(":").map(Number);

          if (freq === "daily") {
            next.setDate(next.getDate() + 1);
            next.setHours(h, m, 0, 0);
          } else if (freq === "weekly") {
            next.setDate(next.getDate() + 7);
            next.setHours(h, m, 0, 0);
          } else if (freq === "monthly") {
            next.setMonth(next.getMonth() + 1);
            next.setHours(h, m, 0, 0);
          } else {
            // once or custom - disable after run
            return null;
          }
          return next.toISOString();
        };

        const nextRun = calcNext(schedule.frequency, schedule.scheduled_time, schedule.scheduled_days);

        await supabase.from("schedules").update({
          last_run: now,
          run_count: (schedule.run_count || 0) + 1,
          next_run: nextRun,
          is_active: nextRun !== null,
        }).eq("id", schedule.id);

        // Log the event
        await supabase.from("event_logs").insert({
          workspace_id: schedule.workspace_id,
          event_type: "schedule_triggered",
          actor: "Sistema",
          target: schedule.name,
          description: `Agendamento "${schedule.name}" executado`,
          metadata: { schedule_id: schedule.id },
        });

        results.push({ id: schedule.id, status: "ok" });
      } catch (e) {
        console.error("Schedule error:", e);
        results.push({ id: schedule.id, status: "error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
