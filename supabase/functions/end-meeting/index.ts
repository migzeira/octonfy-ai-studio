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

    const { meeting_id, workspace_id } = await req.json();
    if (!meeting_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "meeting_id and workspace_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch meeting with transcript
    const { data: meeting } = await admin.from("meetings").select("*").eq("id", meeting_id).single();
    if (!meeting) {
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ws } = await admin.from("workspaces").select("*").eq("id", workspace_id).single();
    const { data: credits } = await admin.from("credits").select("*").eq("workspace_id", workspace_id).single();

    // Format transcript for summary
    const transcriptArr = (meeting.transcript as any[]) || [];
    const formattedTranscript = transcriptArr
      .map((t: any) => `${t.agent_name}: ${t.content}`)
      .join("\n\n");

    // Generate summary via AI
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
            content: "Você é um assistente especializado em gerar resumos executivos de reuniões. Responda em português brasileiro.",
          },
          {
            role: "user",
            content: `Com base na transcrição desta reunião "${meeting.title}", crie um resumo executivo contendo:
1. Tema principal discutido
2. Principais pontos levantados por cada participante
3. Decisões tomadas (se houver)
4. Próximos passos identificados

Transcrição:
${formattedTranscript || "Sem transcrição disponível."}`,
          },
        ],
        max_tokens: 1500, temperature: 0.5,
      }),
    });

    let summary = "Resumo não disponível.";
    let creditsUsed = 8;

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      summary = aiData.choices?.[0]?.message?.content || summary;
      const tokensUsed = aiData.usage?.total_tokens || 200;
      creditsUsed = Math.max(1, Math.ceil(tokensUsed / 1000) * 8);
    }

    // Save summary as document
    const today = new Date().toLocaleDateString("pt-BR");
    const { data: doc } = await admin.from("documents").insert({
      workspace_id,
      title: `Resumo: ${meeting.title} - ${today}`,
      content: summary,
      type: "meeting_summary",
      created_by: "system",
      tags: ["reunião", "resumo"],
    }).select("id").single();

    // Update meeting
    await admin.from("meetings").update({
      status: "completed",
      ended_at: new Date().toISOString(),
      summary,
    }).eq("id", meeting_id);

    // Set all participants to idle
    const participantIds: string[] = meeting.participants || [];
    if (participantIds.length > 0) {
      await admin.from("agents").update({ status: "idle" }).in("id", participantIds);
    }

    // Debit credits
    if (credits) {
      await admin.from("credits").update({
        balance: Math.max(0, (credits.balance || 0) - creditsUsed),
        total_consumed: (credits.total_consumed || 0) + creditsUsed,
      }).eq("workspace_id", workspace_id);
    }

    // Transaction
    await admin.from("transactions").insert({
      workspace_id, type: "consumption", amount: creditsUsed,
      model: "gemini-2.5-flash",
      description: `Resumo da reunião: ${meeting.title}`,
    });

    // Event log
    await admin.from("event_logs").insert({
      workspace_id, event_type: "meeting_ended",
      actor: "Sistema",
      description: `Reunião "${meeting.title}" encerrada. Resumo gerado.`,
      metadata: { meeting_id, document_id: doc?.id, credits_used: creditsUsed },
    });

    return new Response(JSON.stringify({
      summary, document_id: doc?.id, credits_used: creditsUsed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
