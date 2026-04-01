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
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id } = await req.json();
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ws } = await admin.from("workspaces").select("*").eq("id", workspace_id).single();
    const { data: credits } = await admin.from("credits").select("*").eq("workspace_id", workspace_id).single();

    if (!credits || (credits.balance || 0) < 50) {
      return new Response(JSON.stringify({ error: "Insufficient credits for autonomous mode", minimum: 50 }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: agents } = await admin.from("agents").select("*").eq("workspace_id", workspace_id).eq("is_active", true);
    const ceo = agents?.find(a => a.role.toLowerCase().includes("ceo")) || agents?.[0];
    if (!ceo) {
      return new Response(JSON.stringify({ error: "No CEO agent found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tasks } = await admin.from("tasks").select("*").eq("workspace_id", workspace_id).in("status", ["todo", "in_progress"]).limit(10);
    const { data: recentMsgs } = await admin.from("messages").select("*").eq("workspace_id", workspace_id).order("created_at", { ascending: false }).limit(10);

    await admin.from("agents").update({ status: "thinking" }).eq("id", ceo.id);

    const context = `
Empresa: ${ws?.name}. Missão: ${ws?.mission}. Produtos: ${ws?.products}.
Agentes ativos: ${agents?.map(a => `${a.name} (${a.role})`).join(", ")}
Tarefas pendentes: ${tasks?.length || 0} — ${tasks?.map(t => t.title).join(", ") || "nenhuma"}
Créditos: ${credits.balance}
`;

    const systemPrompt = `${ceo.system_prompt || `Você é ${ceo.name}, CEO da empresa ${ws?.name}.`}

Você está no modo autônomo. Analise o contexto abaixo e DECIDA UMA ação para tomar agora.

${context}

Responda em JSON com o formato:
{"action": "broadcast|delegate|report", "content": "sua mensagem", "target_agent": "nome do agente (se delegate)"}

Escolha a ação mais útil no momento. Seja conciso e prático.`;

    const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analise a situação e tome uma ação agora." },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    let actionContent = "O CEO está analisando a situação...";
    let creditsUsed = 8;

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const raw = aiData.choices?.[0]?.message?.content || "";
      const tokensUsed = aiData.usage?.total_tokens || 200;
      creditsUsed = Math.max(1, Math.ceil(tokensUsed / 1000) * 8);

      // Try parse JSON action
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const action = JSON.parse(jsonMatch[0]);
          actionContent = action.content || raw;

          // Execute action
          if (action.action === "broadcast") {
            await admin.from("messages").insert({
              workspace_id, content: actionContent, type: "broadcast",
              from_agent_id: ceo.id,
            });
          } else if (action.action === "delegate" && action.target_agent) {
            const target = agents?.find(a => a.name.toLowerCase().includes(action.target_agent.toLowerCase()));
            if (target) {
              await admin.from("messages").insert({
                workspace_id, content: actionContent, type: "dm",
                from_agent_id: ceo.id, to_agent_id: target.id,
              });
            }
          } else {
            await admin.from("messages").insert({
              workspace_id, content: actionContent, type: "broadcast",
              from_agent_id: ceo.id,
            });
          }
        } else {
          actionContent = raw;
          await admin.from("messages").insert({
            workspace_id, content: actionContent, type: "broadcast",
            from_agent_id: ceo.id,
          });
        }
      } catch {
        actionContent = raw;
        await admin.from("messages").insert({
          workspace_id, content: actionContent, type: "broadcast",
          from_agent_id: ceo.id,
        });
      }
    }

    // Debit credits
    await admin.from("credits").update({
      balance: Math.max(0, (credits.balance || 0) - creditsUsed),
      total_consumed: (credits.total_consumed || 0) + creditsUsed,
    }).eq("workspace_id", workspace_id);

    await admin.from("transactions").insert({
      workspace_id, type: "consumption", amount: creditsUsed,
      agent_id: ceo.id, model: ceo.model,
      description: `Ação autônoma do CEO`,
    });

    await admin.from("agents").update({
      status: "idle",
      messages_count: (ceo.messages_count || 0) + 1,
      credits_spent: (ceo.credits_spent || 0) + creditsUsed,
    }).eq("id", ceo.id);

    await admin.from("event_logs").insert({
      workspace_id, event_type: "schedule_triggered", actor: ceo.name,
      description: `CEO autônomo executou uma ação: ${actionContent.substring(0, 100)}`,
    });

    return new Response(JSON.stringify({ action: actionContent, credits_used: creditsUsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
