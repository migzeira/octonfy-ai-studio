import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agent_name, agent_role, agent_specialty, workspace_id } = await req.json();
    if (!agent_name || !agent_role) {
      return new Response(JSON.stringify({ error: "agent_name and agent_role required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch workspace
    const { data: workspace } = await admin
      .from("workspaces").select("*")
      .eq("id", workspace_id).eq("user_id", user.id).single();
    if (!workspace) {
      return new Response(JSON.stringify({ error: "Workspace not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check credits
    const { data: credits } = await admin
      .from("credits").select("*")
      .eq("workspace_id", workspace.id).single();
    if (!credits || (credits.balance || 0) < 5) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em criar system prompts para agentes de IA. Retorne APENAS o system prompt, sem explicações.",
          },
          {
            role: "user",
            content: `Gere um system prompt profissional em português brasileiro para um agente de IA.

Nome do agente: ${agent_name}
Cargo: ${agent_role}
Especialidade: ${agent_specialty || "Geral"}
Empresa: ${workspace.name}
Missão: ${workspace.mission || "Não definida"}
Produtos: ${workspace.products || "Não definidos"}

Requisitos do system prompt:
- Escrever em primeira pessoa
- Tom profissional e direto
- Definir responsabilidades claras
- Definir como o agente deve se comunicar
- Mencionar a empresa e o contexto
- Entre 150 e 300 palavras
- Incluir exemplos de respostas típicas

Retorne APENAS o system prompt, sem explicações.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const systemPrompt = aiData.choices?.[0]?.message?.content || "";

    // Debit 5 credits
    await admin.from("credits").update({
      balance: (credits.balance || 0) - 5,
      total_consumed: (credits.total_consumed || 0) + 5,
    }).eq("workspace_id", workspace.id);

    // Transaction log
    await admin.from("transactions").insert({
      workspace_id: workspace.id, type: "consumption", amount: 5,
      model: "gemini-2.5-flash-lite",
      description: `Geração de system prompt para ${agent_name}`,
    });

    return new Response(JSON.stringify({ system_prompt: systemPrompt, credits_used: 5 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
