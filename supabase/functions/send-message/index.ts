import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Model registry ────────────────────────────────────────────────────
// "internal label" → real provider + model ID + credit cost per 1k tokens
const MODEL_REGISTRY: Record<string, {
  provider: "anthropic" | "openai";
  model: string;
  costPer1k: number;
}> = {
  "claude-haiku":  { provider: "anthropic", model: "claude-3-5-haiku-20241022",   costPer1k: 2  },
  "llama-groq":    { provider: "anthropic", model: "claude-3-5-haiku-20241022",   costPer1k: 2  },
  "gemini-pro":    { provider: "anthropic", model: "claude-3-5-sonnet-20241022",  costPer1k: 6  },
  "claude-sonnet": { provider: "anthropic", model: "claude-3-5-sonnet-20241022",  costPer1k: 8  },
  "gpt-4o":        { provider: "openai",    model: "gpt-4o",                      costPer1k: 10 },
  "claude-opus":   { provider: "anthropic", model: "claude-3-opus-20240229",      costPer1k: 20 },
};

// ── Helpers ───────────────────────────────────────────────────────────
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Call Anthropic Messages API
// System prompt goes in the top-level `system` field;
// history messages must only have role "user" | "assistant".
async function callAnthropic(
  model: string,
  systemPrompt: string,
  history: { role: string; content: string }[],
  userMessage: string,
  apiKey: string,
  maxTokens = 1024,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  // Build messages: filter out any "system" roles from history, append current user msg
  const messages = [
    ...history
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    content: data.content?.[0]?.text ?? "",
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

// Call OpenAI Chat Completions API
async function callOpenAI(
  model: string,
  systemPrompt: string,
  history: { role: string; content: string }[],
  userMessage: string,
  apiKey: string,
  maxTokens = 1024,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.filter(m => m.role === "user" || m.role === "assistant"),
    { role: "user", content: userMessage },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.7, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

// ── Handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Não autenticado" }, 401);

    const supabaseUrl         = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey        = Deno.env.get("ANTHROPIC_API_KEY")!;
    const openaiKey           = Deno.env.get("OPENAI_API_KEY") ?? "";

    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Token inválido" }, 401);

    // ── Parse body ────────────────────────────────────────────────────
    const {
      message, agent_id, workspace_id,
      history = [], meeting_id = null,
      message_type = "dm",
    } = await req.json();

    if (!message || !agent_id || !workspace_id) {
      return jsonResponse({ error: "Campos obrigatórios ausentes" }, 400);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // ── Verify workspace ──────────────────────────────────────────────
    const { data: workspace, error: wsError } = await admin
      .from("workspaces").select("*")
      .eq("id", workspace_id).eq("user_id", user.id).single();
    if (wsError || !workspace) return jsonResponse({ error: "Workspace não encontrado" }, 404);

    // ── Fetch agent ───────────────────────────────────────────────────
    const { data: agent } = await admin
      .from("agents").select("*")
      .eq("id", agent_id).eq("workspace_id", workspace_id).single();
    if (!agent) return jsonResponse({ error: "Agente não encontrado" }, 404);

    // ── Fetch colleagues ──────────────────────────────────────────────
    const { data: allAgents } = await admin
      .from("agents").select("name, role, specialty")
      .eq("workspace_id", workspace_id).eq("is_active", true).neq("id", agent_id);

    // ── Check credits ─────────────────────────────────────────────────
    const { data: credits } = await admin
      .from("credits").select("*").eq("workspace_id", workspace_id).single();
    if (!credits || (credits.balance ?? 0) <= 0) {
      return jsonResponse({ error: "Saldo insuficiente de créditos" }, 402);
    }

    // ── Resolve model ─────────────────────────────────────────────────
    const agentModelKey = agent.model ?? "claude-sonnet";
    const modelConf = MODEL_REGISTRY[agentModelKey] ?? MODEL_REGISTRY["claude-sonnet"];
    const estimatedCost = Math.ceil((250 / 1000) * modelConf.costPer1k);

    if ((credits.balance ?? 0) < estimatedCost) {
      return jsonResponse({ error: "Saldo insuficiente para esta operação" }, 402);
    }

    // ── Reserve credits + set agent status ───────────────────────────
    await admin.from("credits").update({
      reserved: (credits.reserved ?? 0) + estimatedCost,
    }).eq("workspace_id", workspace_id);
    await admin.from("agents").update({ status: "thinking" }).eq("id", agent_id);

    // ── Build system prompt ───────────────────────────────────────────
    const colleaguesList = allAgents
      ?.map(a => `- ${a.name} (${a.role}): ${a.specialty ?? "Geral"}`)
      .join("\n") ?? "Nenhum colega ainda";

    const systemPrompt = `${agent.system_prompt ?? `Você é ${agent.name}, ${agent.role}.`}

CONTEXTO DA EMPRESA:
Empresa: ${workspace.name}
Missão: ${workspace.mission ?? "Não definida"}
Produtos/Serviços: ${workspace.products ?? "Não definidos"}
Cultura: ${workspace.culture ?? "Não definida"}
${workspace.additional_notes ? "Notas: " + workspace.additional_notes : ""}

SEUS COLEGAS DE TRABALHO:
${colleaguesList}

INSTRUÇÕES DE COMPORTAMENTO:
- Responda sempre no contexto do seu cargo: ${agent.role}
- Seja objetivo e profissional
- Quando mencionar colegas, use o nome deles
- Responda em português brasileiro
- Não quebre o personagem em hipótese alguma`;

    // ── Call AI provider ──────────────────────────────────────────────
    let aiResult: { content: string; inputTokens: number; outputTokens: number };

    try {
      if (modelConf.provider === "anthropic") {
        if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY não configurada");
        aiResult = await callAnthropic(
          modelConf.model, systemPrompt, history, message, anthropicKey,
        );
      } else {
        if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada");
        aiResult = await callOpenAI(
          modelConf.model, systemPrompt, history, message, openaiKey,
        );
      }
    } catch (aiError) {
      // Rollback: release credits + reset agent status
      await admin.from("agents").update({ status: "idle" }).eq("id", agent_id);
      await admin.from("credits").update({
        reserved: Math.max(0, (credits.reserved ?? 0) - estimatedCost),
      }).eq("workspace_id", workspace_id);
      console.error("AI call failed:", aiError);
      return jsonResponse({ error: `Erro na IA: ${(aiError as Error).message}` }, 500);
    }

    // ── Debit real credits ────────────────────────────────────────────
    const totalTokens = aiResult.inputTokens + aiResult.outputTokens || 200;
    const realCost    = Math.max(1, Math.ceil(totalTokens / 1000) * modelConf.costPer1k);
    const newBalance  = Math.max(0, (credits.balance ?? 0) - realCost);

    await admin.from("credits").update({
      balance: newBalance,
      reserved: Math.max(0, (credits.reserved ?? 0) - estimatedCost),
      total_consumed: (credits.total_consumed ?? 0) + realCost,
      updated_at: new Date().toISOString(),
    }).eq("workspace_id", workspace_id);

    // ── Persist messages ──────────────────────────────────────────────
    await admin.from("messages").insert({
      workspace_id, to_agent_id: agent_id, meeting_id,
      content: message, type: "user",
      tokens_used: 0, credits_used: 0,
    });
    await admin.from("messages").insert({
      workspace_id, from_agent_id: agent_id, meeting_id,
      content: aiResult.content, type: message_type,
      tokens_used: totalTokens, credits_used: realCost,
    });

    // ── Logs & stats ──────────────────────────────────────────────────
    await admin.from("transactions").insert({
      workspace_id, type: "consumption", amount: realCost,
      agent_id, model: agentModelKey,
      tokens_input: aiResult.inputTokens, tokens_output: aiResult.outputTokens,
      description: `Mensagem para ${agent.name} (${agent.role}) via ${modelConf.provider}/${modelConf.model}`,
    });
    await admin.from("agents").update({
      status: "idle",
      messages_count: (agent.messages_count ?? 0) + 1,
      credits_spent: (agent.credits_spent ?? 0) + realCost,
    }).eq("id", agent_id);
    await admin.from("event_logs").insert({
      workspace_id,
      event_type: message_type === "broadcast" ? "broadcast_sent" : "dm_sent",
      actor: agent.name,
      description: `${agent.name} respondeu via ${modelConf.provider}`,
      metadata: { tokens: totalTokens, credits: realCost, model: modelConf.model },
    });

    if (newBalance < 100) {
      await admin.from("event_logs").insert({
        workspace_id, event_type: "credit_low", actor: "system",
        description: `Créditos baixos: ${newBalance} restantes`,
        metadata: { balance: newBalance },
      });
    }

    return jsonResponse({
      content: aiResult.content,
      tokens_used: totalTokens,
      credits_used: realCost,
      new_balance: newBalance,
      provider: modelConf.provider,
      model: modelConf.model,
    });

  } catch (error) {
    console.error("send-message fatal:", error);
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});
