import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { meeting_id, workspace_id } = await req.json();
    if (!meeting_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "meeting_id and workspace_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: meeting } = await admin.from("meetings").select("*").eq("id", meeting_id).single();
    if (!meeting) {
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ws } = await admin.from("workspaces").select("*").eq("id", workspace_id).single();
    const { data: credits } = await admin.from("credits").select("*").eq("workspace_id", workspace_id).single();

    const participantIds: string[] = meeting.participants || [];
    const { data: agents } = await admin.from("agents").select("*").in("id", participantIds);
    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ error: "No participants found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript: Array<{ agent_id: string; agent_name: string; content: string; timestamp: string }> = [];
    let totalCredits = 0;

    for (const agent of agents) {
      await admin.from("agents").update({ status: "thinking" }).eq("id", agent.id);

      const prevSpeech = transcript.map(t => `${t.agent_name}: ${t.content}`).join("\n\n");

      const systemPrompt = `${agent.system_prompt || `Você é ${agent.name}, ${agent.role}.`}

Empresa: ${ws?.name || ""}. Missão: ${ws?.mission || ""}. Produtos: ${ws?.products || ""}.

Você está em uma reunião chamada "${meeting.title}".
${meeting.summary ? `Pauta: ${meeting.summary}` : ""}

${prevSpeech ? `O que já foi dito:\n${prevSpeech}` : "Você é o primeiro a falar. Abra a reunião."}

Faça sua contribuição de forma concisa (2-4 parágrafos). Seja construtivo e específico.`;

      const aiModel = MODEL_MAP[agent.model || "claude-sonnet"] || "google/gemini-2.5-flash";

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
            { role: "user", content: "Faça sua contribuição na reunião agora." },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      let content = "...";
      let tokensUsed = 100;
      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        content = aiData.choices?.[0]?.message?.content || "Sem contribuição.";
        tokensUsed = aiData.usage?.total_tokens || 100;
      }

      const costPer1k = MODEL_COSTS[agent.model || "claude-sonnet"] || 8;
      const creditsUsed = Math.max(1, Math.ceil(tokensUsed / 1000) * costPer1k);
      totalCredits += creditsUsed;

      const entry = { agent_id: agent.id, agent_name: agent.name, content, timestamp: new Date().toISOString() };
      transcript.push(entry);

      // Save message
      await admin.from("messages").insert({
        workspace_id, content, type: "meeting",
        from_agent_id: agent.id, meeting_id,
        tokens_used: tokensUsed, credits_used: creditsUsed,
      });

      // Update transcript
      await admin.from("meetings").update({ transcript }).eq("id", meeting_id);

      // Update agent
      await admin.from("agents").update({
        status: "in_meeting",
        messages_count: (agent.messages_count || 0) + 1,
        credits_spent: (agent.credits_spent || 0) + creditsUsed,
      }).eq("id", agent.id);

      // Transaction
      await admin.from("transactions").insert({
        workspace_id, type: "consumption", amount: creditsUsed,
        agent_id: agent.id, model: agent.model,
        description: `Fala em reunião: ${meeting.title}`,
      });
    }

    // Debit total credits
    if (credits) {
      await admin.from("credits").update({
        balance: Math.max(0, (credits.balance || 0) - totalCredits),
        total_consumed: (credits.total_consumed || 0) + totalCredits,
      }).eq("workspace_id", workspace_id);
    }

    return new Response(JSON.stringify({ transcript, credits_used: totalCredits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
