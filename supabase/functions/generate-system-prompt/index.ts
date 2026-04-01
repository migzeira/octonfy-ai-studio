import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Verify user
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const {
      agent_name,
      agent_role,
      agent_specialty,
      workspace_name,
      workspace_mission,
      workspace_products,
    } = await req.json();

    if (!agent_name || !agent_role) {
      return new Response(
        JSON.stringify({ error: "agent_name and agent_role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get workspace and debit credits using service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: workspace } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!workspace) {
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check and debit credits
    const { data: credits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (!credits || credits.balance < 5) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call AI via Lovable AI gateway
    const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em criar system prompts para agentes de IA. Responda apenas com o system prompt, sem explicações adicionais.",
          },
          {
            role: "user",
            content: `Gere um system prompt profissional em português para um agente de IA com as seguintes características:
Nome: ${agent_name}
Cargo: ${agent_role}
Especialidade: ${agent_specialty || "Geral"}
Empresa: ${workspace_name || "Não informada"}
Missão da empresa: ${workspace_mission || "Não informada"}
Produtos/Serviços: ${workspace_products || "Não informados"}

O system prompt deve:
- Definir claramente o papel e responsabilidades
- Estabelecer o tom de voz e personalidade
- Incluir exemplos de como responder
- Ter entre 200-400 palavras
- Ser escrito em primeira pessoa
- Mencionar o nome da empresa e contexto`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const systemPrompt = aiData.choices?.[0]?.message?.content || "";

    // Debit 5 credits
    await supabaseAdmin
      .from("credits")
      .update({
        balance: credits.balance - 5,
        total_consumed: (credits as any).total_consumed + 5,
      })
      .eq("workspace_id", workspace.id);

    // Log transaction
    await supabaseAdmin.from("transactions").insert({
      workspace_id: workspace.id,
      type: "consumption",
      amount: 5,
      model: "gemini-2.5-flash",
      description: `Geração de system prompt para ${agent_name}`,
    });

    return new Response(
      JSON.stringify({ system_prompt: systemPrompt, credits_used: 5 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
