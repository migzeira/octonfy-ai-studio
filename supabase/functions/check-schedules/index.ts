import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function calcNextRun(frequency: string, scheduledTime: string | null, scheduledDays: string[] | null): string | null {
  const now = new Date();
  const [h, m] = (scheduledTime || "08:00").split(":").map(Number);

  if (frequency === "once") {
    return null; // One-time, disable after run
  }

  if (frequency === "daily") {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(h, m, 0, 0);
    return next.toISOString();
  }

  if (frequency === "weekly") {
    const dayMap: Record<string, number> = {
      dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6,
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    };
    const targetDays = (scheduledDays || [])
      .map(d => dayMap[d.toLowerCase()] ?? -1)
      .filter(d => d >= 0)
      .sort((a, b) => a - b);

    if (targetDays.length === 0) {
      // Default: same day next week
      const next = new Date(now);
      next.setDate(next.getDate() + 7);
      next.setHours(h, m, 0, 0);
      return next.toISOString();
    }

    const currentDay = now.getDay();
    let nextDay = targetDays.find(d => d > currentDay);
    let daysToAdd: number;
    if (nextDay !== undefined) {
      daysToAdd = nextDay - currentDay;
    } else {
      daysToAdd = 7 - currentDay + targetDays[0];
    }

    const next = new Date(now);
    next.setDate(next.getDate() + daysToAdd);
    next.setHours(h, m, 0, 0);
    return next.toISOString();
  }

  if (frequency === "monthly") {
    const next = new Date(now);
    next.setMonth(next.getMonth() + 1);
    next.setHours(h, m, 0, 0);
    return next.toISOString();
  }

  // custom / unknown — disable
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();
    const { data: schedules, error } = await supabase
      .from("schedules").select("*")
      .eq("is_active", true)
      .not("next_run", "is", null)
      .lte("next_run", now);

    if (error) throw error;
    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ processed: 0, errors: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const schedule of schedules) {
      try {
        if (!schedule.agent_id) {
          results.push({ id: schedule.id, status: "skipped", error: "No agent assigned" });
          continue;
        }

        // Fetch agent and workspace
        const { data: agent } = await supabase.from("agents").select("*").eq("id", schedule.agent_id).single();
        const { data: credits } = await supabase.from("credits").select("*").eq("workspace_id", schedule.workspace_id).single();

        if (!credits || (credits.balance || 0) < 5) {
          await supabase.from("event_logs").insert({
            workspace_id: schedule.workspace_id,
            event_type: "error", actor: "Sistema",
            description: `Agendamento "${schedule.name}" falhou: créditos insuficientes`,
            metadata: { schedule_id: schedule.id },
          });
          results.push({ id: schedule.id, status: "error", error: "Insufficient credits" });
          continue;
        }

        // Update agent status
        if (agent) {
          await supabase.from("agents").update({ status: "working" }).eq("id", agent.id);
        }

        // Call AI directly (not via send-message to avoid auth issues)
        const { data: ws } = await supabase.from("workspaces").select("*").eq("id", schedule.workspace_id).single();

        const MODEL_MAP: Record<string, string> = {
          "claude-haiku": "google/gemini-2.5-flash-lite",
          "llama-groq": "google/gemini-2.5-flash-lite",
          "gemini-pro": "google/gemini-2.5-pro",
          "claude-sonnet": "google/gemini-2.5-flash",
          "gpt-4o": "openai/gpt-5-mini",
          "claude-opus": "openai/gpt-5",
        };
        const MODEL_COSTS: Record<string, number> = {
          "claude-haiku": 2, "llama-groq": 2, "gemini-pro": 6,
          "claude-sonnet": 8, "gpt-4o": 10, "claude-opus": 20,
        };

        const agentModel = agent?.model || "claude-sonnet";
        const aiModel = MODEL_MAP[agentModel] || "google/gemini-2.5-flash";
        const costPer1k = MODEL_COSTS[agentModel] || 8;

        const systemPrompt = `${agent?.system_prompt || `Você é ${agent?.name}, ${agent?.role}.`}
Empresa: ${ws?.name || ""}. Missão: ${ws?.mission || ""}.
Responda em português brasileiro de forma profissional.`;

        const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: schedule.instruction },
            ],
            max_tokens: 1024, temperature: 0.7,
          }),
        });

        let content = "Agendamento executado sem resposta.";
        let creditsUsed = 5;

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          content = aiData.choices?.[0]?.message?.content || content;
          const tokensUsed = aiData.usage?.total_tokens || 200;
          creditsUsed = Math.max(1, Math.ceil(tokensUsed / 1000) * costPer1k);
        }

        // Save messages
        await supabase.from("messages").insert({
          workspace_id: schedule.workspace_id,
          content: schedule.instruction, type: "system",
          to_agent_id: schedule.agent_id,
        });
        await supabase.from("messages").insert({
          workspace_id: schedule.workspace_id,
          content, type: "system",
          from_agent_id: schedule.agent_id,
          credits_used: creditsUsed,
        });

        // Debit credits
        await supabase.from("credits").update({
          balance: Math.max(0, (credits.balance || 0) - creditsUsed),
          total_consumed: (credits.total_consumed || 0) + creditsUsed,
        }).eq("workspace_id", schedule.workspace_id);

        // Transaction
        await supabase.from("transactions").insert({
          workspace_id: schedule.workspace_id, type: "consumption",
          amount: creditsUsed, agent_id: schedule.agent_id,
          model: agentModel,
          description: `Agendamento: ${schedule.name}`,
        });

        // Calculate next_run
        const nextRun = calcNextRun(schedule.frequency, schedule.scheduled_time, schedule.scheduled_days);

        await supabase.from("schedules").update({
          last_run: now,
          run_count: (schedule.run_count || 0) + 1,
          next_run: nextRun,
          is_active: nextRun !== null,
        }).eq("id", schedule.id);

        // Reset agent
        if (agent) {
          await supabase.from("agents").update({
            status: "idle",
            messages_count: (agent.messages_count || 0) + 1,
            credits_spent: (agent.credits_spent || 0) + creditsUsed,
          }).eq("id", agent.id);
        }

        // Event log
        await supabase.from("event_logs").insert({
          workspace_id: schedule.workspace_id,
          event_type: "schedule_triggered", actor: "Sistema",
          target: schedule.name,
          description: `Agendamento "${schedule.name}" executado`,
          metadata: { schedule_id: schedule.id, schedule_name: schedule.name, agent_name: agent?.name, credits_used: creditsUsed },
        });

        results.push({ id: schedule.id, status: "ok" });
      } catch (e) {
        console.error("Schedule error:", e);
        results.push({ id: schedule.id, status: "error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-schedules error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
