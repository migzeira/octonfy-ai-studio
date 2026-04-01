import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL_COSTS: Record<string, number> = {
  "claude-haiku": 2,
  "llama-groq": 2,
  "gemini-pro": 6,
  "claude-sonnet": 8,
  "gpt-4o": 10,
  "claude-opus": 20,
};

const MODEL_MAP: Record<string, string> = {
  "claude-haiku": "google/gemini-2.5-flash-lite",
  "llama-groq": "google/gemini-2.5-flash-lite",
  "gemini-pro": "google/gemini-2.5-pro",
  "claude-sonnet": "google/gemini-2.5-flash",
  "gpt-4o": "openai/gpt-5-mini",
  "claude-opus": "openai/gpt-5",
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

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, agent_id, workspace_id, history } = await req.json();
    if (!message || !agent_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "message, agent_id, workspace_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch agent
    const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).single();
    if (!agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workspace
    const { data: ws } = await admin.from("workspaces").select("*").eq("id", workspace_id).single();

    // Check credits
    const { data: credits } = await admin.from("credits").select("*").eq("workspace_id", workspace_id).single();
    const costPer1k = MODEL_COSTS[agent.model || "claude-sonnet"] || 8;
    if (!credits || (credits.balance || 0) < costPer1k) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set agent thinking
    await admin.from("agents").update({ status: "thinking" }).eq("id", agent_id);

    // Save user message
    await admin.from("messages").insert({
      workspace_id, content: message, type: "dm",
      to_agent_id: agent_id, from_agent_id: null,
    });

    // Build conversation
    const systemPrompt = `${agent.system_prompt || `Você é ${agent.name}, ${agent.role}.`}

Empresa: ${ws?.name || ""}
Missão: ${ws?.mission || ""}
Produtos: ${ws?.products || ""}
Cultura: ${ws?.culture || ""}

Responda de forma concisa e profissional em português. Seja útil e proativo.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-20),
      { role: "user", content: message },
    ];

    const aiModel = MODEL_MAP[agent.model || "claude-sonnet"] || "google/gemini-2.5-flash";

    const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({ model: aiModel, messages, max_tokens: 2000, temperature: 0.7 }),
    });

    if (!aiResponse.ok) {
      await admin.from("agents").update({ status: "idle" }).eq("id", agent_id);
      console.error("AI error:", await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
    const tokensUsed = (aiData.usage?.total_tokens || 200);
    const creditsUsed = Math.max(1, Math.ceil(tokensUsed / 1000) * costPer1k);

    // Save agent message
    await admin.from("messages").insert({
      workspace_id, content, type: "dm",
      from_agent_id: agent_id, to_agent_id: null,
      tokens_used: tokensUsed, credits_used: creditsUsed,
    });

    // Debit credits
    await admin.from("credits").update({
      balance: Math.max(0, (credits.balance || 0) - creditsUsed),
      total_consumed: (credits.total_consumed || 0) + creditsUsed,
    }).eq("workspace_id", workspace_id);

    // Transaction log
    await admin.from("transactions").insert({
      workspace_id, type: "consumption", amount: creditsUsed,
      agent_id, model: agent.model, tokens_input: aiData.usage?.prompt_tokens,
      tokens_output: aiData.usage?.completion_tokens,
      description: `Mensagem de ${agent.name}`,
    });

    // Update agent stats
    await admin.from("agents").update({
      status: "idle",
      messages_count: (agent.messages_count || 0) + 1,
      credits_spent: (agent.credits_spent || 0) + creditsUsed,
    }).eq("id", agent_id);

    // Event log
    await admin.from("event_logs").insert({
      workspace_id, event_type: "dm_sent", actor: agent.name,
      target: "user", description: `${agent.name} respondeu uma mensagem`,
    });

    return new Response(JSON.stringify({ content, tokens_used: tokensUsed, credits_used: creditsUsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
