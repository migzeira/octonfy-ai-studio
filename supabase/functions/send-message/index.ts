import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL_COSTS: Record<string, number> = {
  "claude-haiku": 2, "llama-groq": 2, "gemini-pro": 6,
  "claude-sonnet": 8, "gpt-4o": 10, "claude-opus": 20,
};

const MODEL_MAP: Record<string, string> = {
  "claude-haiku": "google/gemini-2.5-flash-lite",
  "llama-groq": "google/gemini-2.5-flash-lite",
  "gemini-pro": "google/gemini-2.5-pro",
  "claude-sonnet": "google/gemini-2.5-flash",
  "gpt-4o": "openai/gpt-5-mini",
  "claude-opus": "openai/gpt-5",
};

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Não autenticado", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Verify user auth
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return errorResponse("Token inválido", 401);
    }

    const {
      message, agent_id, workspace_id,
      history = [], meeting_id = null,
      message_type = "dm"
    } = await req.json();

    if (!message || !agent_id || !workspace_id) {
      return errorResponse("Campos obrigatórios ausentes", 400);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify workspace ownership
    const { data: workspace, error: wsError } = await admin
      .from("workspaces").select("*")
      .eq("id", workspace_id).eq("user_id", user.id).single();
    if (wsError || !workspace) {
      return errorResponse("Workspace não encontrado", 404);
    }

    // Fetch agent
    const { data: agent } = await admin
      .from("agents").select("*")
      .eq("id", agent_id).eq("workspace_id", workspace_id).single();
    if (!agent) {
      return errorResponse("Agente não encontrado", 404);
    }

    // Fetch colleagues for context
    const { data: allAgents } = await admin
      .from("agents").select("name, role, specialty")
      .eq("workspace_id", workspace_id).eq("is_active", true)
      .neq("id", agent_id);

    // Check credits
    const { data: credits } = await admin
      .from("credits").select("*")
      .eq("workspace_id", workspace_id).single();
    if (!credits || (credits.balance || 0) <= 0) {
      return errorResponse("Saldo insuficiente de créditos", 402);
    }

    const costPer1k = MODEL_COSTS[agent.model || "claude-sonnet"] || 8;
    const estimatedCost = Math.ceil((250 / 1000) * costPer1k);

    if ((credits.balance || 0) < estimatedCost) {
      return errorResponse("Saldo insuficiente para esta operação", 402);
    }

    // Reserve credits
    await admin.from("credits").update({
      reserved: (credits.reserved || 0) + estimatedCost,
    }).eq("workspace_id", workspace_id);

    // Set agent thinking
    await admin.from("agents").update({ status: "thinking" }).eq("id", agent_id);

    // Build system prompt with full context
    const colleaguesList = allAgents
      ?.map(a => `- ${a.name} (${a.role}): ${a.specialty || "Geral"}`)
      .join("\n") || "Nenhum colega ainda";

    const systemPrompt = `${agent.system_prompt || `Você é ${agent.name}, ${agent.role}.`}

CONTEXTO DA EMPRESA:
Empresa: ${workspace.name}
Missão: ${workspace.mission || "Não definida"}
Produtos/Serviços: ${workspace.products || "Não definidos"}
Cultura: ${workspace.culture || "Não definida"}
${workspace.additional_notes ? "Notas: " + workspace.additional_notes : ""}

SEUS COLEGAS DE TRABALHO:
${colleaguesList}

INSTRUÇÕES DE COMPORTAMENTO:
- Responda sempre no contexto do seu cargo: ${agent.role}
- Seja objetivo e profissional
- Quando mencionar colegas, use o nome deles
- Responda em português brasileiro
- Não quebre o personagem em hipótese alguma`;

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
      body: JSON.stringify({ model: aiModel, messages, max_tokens: 1024, temperature: 0.7 }),
    });

    if (!aiResponse.ok) {
      await admin.from("agents").update({ status: "idle" }).eq("id", agent_id);
      // Release reserved credits
      await admin.from("credits").update({
        reserved: Math.max(0, (credits.reserved || 0)),
      }).eq("workspace_id", workspace_id);
      console.error("AI error:", await aiResponse.text());
      return errorResponse("Erro ao processar mensagem", 500);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar.";
    const inputTokens = aiData.usage?.prompt_tokens || 0;
    const outputTokens = aiData.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens || 200;
    const realCost = Math.max(1, Math.ceil(totalTokens / 1000) * costPer1k);

    // Debit real credits, release reservation
    const newBalance = Math.max(0, (credits.balance || 0) - realCost);
    await admin.from("credits").update({
      balance: newBalance,
      reserved: Math.max(0, (credits.reserved || 0) - estimatedCost),
      total_consumed: (credits.total_consumed || 0) + realCost,
      updated_at: new Date().toISOString(),
    }).eq("workspace_id", workspace_id);

    // Save user message
    await admin.from("messages").insert({
      workspace_id, to_agent_id: agent_id, meeting_id,
      content: message, type: "user",
      tokens_used: 0, credits_used: 0,
    });

    // Save agent response
    await admin.from("messages").insert({
      workspace_id, from_agent_id: agent_id, meeting_id,
      content, type: message_type,
      tokens_used: totalTokens, credits_used: realCost,
    });

    // Transaction log
    await admin.from("transactions").insert({
      workspace_id, type: "consumption", amount: realCost,
      agent_id, model: agent.model,
      tokens_input: inputTokens, tokens_output: outputTokens,
      description: `Mensagem para ${agent.name} (${agent.role})`,
    });

    // Update agent stats
    await admin.from("agents").update({
      status: "idle",
      messages_count: (agent.messages_count || 0) + 1,
      credits_spent: (agent.credits_spent || 0) + realCost,
    }).eq("id", agent_id);

    // Event log
    await admin.from("event_logs").insert({
      workspace_id,
      event_type: message_type === "broadcast" ? "broadcast_sent" : "dm_sent",
      actor: agent.name,
      description: `${agent.name} respondeu uma mensagem`,
      metadata: { tokens: totalTokens, credits: realCost, model: agent.model },
    });

    // Alert low credits
    if (newBalance < 100) {
      await admin.from("event_logs").insert({
        workspace_id, event_type: "credit_low", actor: "system",
        description: `Créditos baixos: ${newBalance} restantes`,
        metadata: { balance: newBalance },
      });
    }

    return new Response(JSON.stringify({
      content, tokens_used: totalTokens,
      credits_used: realCost, new_balance: newBalance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-message error:", error);
    return errorResponse("Erro interno do servidor", 500);
  }
});
