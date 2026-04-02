import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey       = Deno.env.get("ANTHROPIC_API_KEY")!;

    if (!anthropicKey) return jsonResponse({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { agent_name, agent_role, agent_specialty, workspace_id } = await req.json();
    if (!agent_name || !agent_role) {
      return jsonResponse({ error: "agent_name and agent_role required" }, 400);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: workspace } = await admin
      .from("workspaces").select("*")
      .eq("id", workspace_id).eq("user_id", user.id).single();
    if (!workspace) return jsonResponse({ error: "Workspace not found" }, 404);

    const { data: credits } = await admin
      .from("credits").select("*").eq("workspace_id", workspace.id).single();
    if (!credits || (credits.balance ?? 0) < 5) {
      return jsonResponse({ error: "Insufficient credits" }, 402);
    }

    // Use Claude Haiku — fast and cheap for generation
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1200,
        system: "Você é um especialista em criar system prompts para agentes de IA. Retorne APENAS o system prompt, sem explicações adicionais, sem markdown, sem aspas.",
        messages: [
          {
            role: "user",
            content: `Gere um system prompt profissional e completo em português brasileiro para um agente de IA.

Nome do agente: ${agent_name}
Cargo: ${agent_role}
Especialidade: ${agent_specialty || "Geral"}
Empresa: ${workspace.name}
Missão: ${workspace.mission || "Não definida"}
Produtos: ${workspace.products || "Não definidos"}

O system prompt deve:
- Ser escrito em primeira pessoa (Você é ${agent_name}...)
- Ter tom profissional, direto e humano
- Definir responsabilidades claras do cargo
- Definir o estilo de comunicação ideal
- Incluir o que o agente DEVE fazer
- Incluir o que o agente NÃO deve fazer
- Mencionar a empresa e seu contexto
- Ter entre 200 e 350 palavras

Retorne APENAS o system prompt pronto para uso.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic error:", await res.text());
      return jsonResponse({ error: "Falha ao gerar prompt" }, 500);
    }

    const data = await res.json();
    const systemPrompt = data.content?.[0]?.text ?? "";
    const tokensUsed   = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    const creditsUsed  = Math.max(5, Math.ceil(tokensUsed / 1000) * 2); // haiku rate

    await admin.from("credits").update({
      balance: Math.max(0, (credits.balance ?? 0) - creditsUsed),
      total_consumed: (credits.total_consumed ?? 0) + creditsUsed,
    }).eq("workspace_id", workspace.id);

    await admin.from("transactions").insert({
      workspace_id: workspace.id, type: "consumption", amount: creditsUsed,
      model: "claude-haiku",
      description: `Geração de system prompt para ${agent_name}`,
    });

    return jsonResponse({ system_prompt: systemPrompt, credits_used: creditsUsed });

  } catch (err) {
    console.error("generate-system-prompt error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
