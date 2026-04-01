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

    if (!credits || (credits.balance || 0) < 20) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes para modo autônomo", minimum: 20 }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find CEO
    const { data: agents } = await admin.from("agents").select("*")
      .eq("workspace_id", workspace_id).eq("is_active", true);
    const ceo = agents?.find(a => a.role.toLowerCase().includes("ceo")) || agents?.[0];
    if (!ceo) {
      return new Response(JSON.stringify({ error: "Nenhum agente CEO encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather context
    const { data: tasks } = await admin.from("tasks").select("*")
      .eq("workspace_id", workspace_id).in("status", ["todo", "in_progress"]).limit(20);
    const urgentTasks = tasks?.filter(t => t.priority === "urgent" || (t.due_date && new Date(t.due_date) < new Date())) || [];
    const { data: recentMsgs } = await admin.from("messages").select("content, type, from_agent_id, created_at")
      .eq("workspace_id", workspace_id).order("created_at", { ascending: false }).limit(5);
    const { data: recentDocs } = await admin.from("documents").select("title, type, created_at")
      .eq("workspace_id", workspace_id).order("created_at", { ascending: false }).limit(5);
    const { data: schedules } = await admin.from("schedules").select("name, frequency, is_active")
      .eq("workspace_id", workspace_id).eq("is_active", true);

    await admin.from("agents").update({ status: "thinking" }).eq("id", ceo.id);

    const agentsList = agents?.map(a => `${a.name} (${a.role}) - status: ${a.status}`).join("\n") || "Nenhum";
    const tasksList = tasks?.map(t => `- "${t.title}" [${t.status}] prioridade: ${t.priority}${t.assigned_to ? "" : " (SEM RESPONSÁVEL)"}`).join("\n") || "Nenhuma";
    const urgentList = urgentTasks.map(t => `- "${t.title}" prioridade: ${t.priority}`).join("\n") || "Nenhuma";

    const systemPrompt = `${ceo.system_prompt || `Você é ${ceo.name}, CEO da empresa ${ws?.name}.`}

Você está no modo autônomo. Analise o status abaixo e tome UMA ação estratégica.

STATUS ATUAL:
Créditos disponíveis: ${credits.balance}
Tarefas pendentes: ${tasks?.length || 0}
${tasksList}
Tarefas urgentes/vencidas:
${urgentList}
Agentes ativos:
${agentsList}
Agendamentos ativos: ${schedules?.length || 0}

AÇÕES POSSÍVEIS (escolha apenas UMA):
1. DELEGAR_TAREFA: Se há tarefa sem responsável
   Formato: AÇÃO: DELEGAR_TAREFA | AGENTE: {nome} | TAREFA: {título} | INSTRUÇÃO: {mensagem}

2. CONVOCAR_REUNIÃO: Se há decisão importante pendente
   Formato: AÇÃO: CONVOCAR_REUNIÃO | TÍTULO: {título} | PARTICIPANTES: {nomes separados por vírgula} | PAUTA: {pauta}

3. ENVIAR_BROADCAST: Para motivar ou informar o time
   Formato: AÇÃO: ENVIAR_BROADCAST | MENSAGEM: {mensagem}

4. CRIAR_DOCUMENTO: Para registrar análise ou plano
   Formato: AÇÃO: CRIAR_DOCUMENTO | TÍTULO: {título} | CONTEÚDO: {conteúdo}

5. NADA: Se tudo está em ordem
   Formato: AÇÃO: NADA | MOTIVO: {motivo}

Responda APENAS com o formato acima.`;

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
        max_tokens: 1500, temperature: 0.7,
      }),
    });

    let actionContent = "O CEO está analisando a situação...";
    let actionType = "nada";
    let creditsUsed = 10;

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const raw = aiData.choices?.[0]?.message?.content || "";
      const tokensUsed = aiData.usage?.total_tokens || 300;
      creditsUsed = Math.max(1, Math.ceil(tokensUsed / 1000) * 8);
      actionContent = raw;

      // Parse and execute action
      if (raw.includes("DELEGAR_TAREFA")) {
        actionType = "delegate";
        const agentMatch = raw.match(/AGENTE:\s*(.+?)(?:\||$)/);
        const taskMatch = raw.match(/TAREFA:\s*(.+?)(?:\||$)/);
        const instrMatch = raw.match(/INSTRUÇÃO:\s*(.+?)(?:\||$)/);
        const targetName = agentMatch?.[1]?.trim();
        const taskTitle = taskMatch?.[1]?.trim();
        const instruction = instrMatch?.[1]?.trim();

        const target = agents?.find(a => a.name.toLowerCase().includes((targetName || "").toLowerCase()));
        if (target && taskTitle) {
          await admin.from("tasks").insert({
            workspace_id, title: taskTitle,
            description: instruction || "",
            assigned_to: target.id,
            created_by: ceo.name, priority: "medium", status: "todo",
          });
          await admin.from("event_logs").insert({
            workspace_id, event_type: "task_created", actor: ceo.name,
            target: target.name,
            description: `CEO criou tarefa "${taskTitle}" para ${target.name}`,
            metadata: { task_title: taskTitle, assigned_to: target.name },
          });
          if (instruction) {
            await admin.from("messages").insert({
              workspace_id, content: instruction, type: "dm",
              from_agent_id: ceo.id, to_agent_id: target.id,
            });
          }
        }
      } else if (raw.includes("CONVOCAR_REUNIÃO")) {
        actionType = "meeting";
        const titleMatch = raw.match(/TÍTULO:\s*(.+?)(?:\||$)/);
        const partMatch = raw.match(/PARTICIPANTES:\s*(.+?)(?:\||$)/);
        const pautaMatch = raw.match(/PAUTA:\s*(.+?)(?:\||$)/);
        const meetTitle = titleMatch?.[1]?.trim() || "Reunião convocada pelo CEO";
        const partNames = partMatch?.[1]?.trim().split(",").map(n => n.trim()) || [];
        const pauta = pautaMatch?.[1]?.trim() || "";

        const participantIds = agents
          ?.filter(a => partNames.some(n => a.name.toLowerCase().includes(n.toLowerCase())))
          .map(a => a.id) || [];
        if (!participantIds.includes(ceo.id)) participantIds.push(ceo.id);

        await admin.from("meetings").insert({
          workspace_id, title: meetTitle,
          participants: participantIds, status: "scheduled",
          summary: pauta,
        });
        await admin.from("event_logs").insert({
          workspace_id, event_type: "meeting_started", actor: ceo.name,
          description: `CEO convocou reunião: ${meetTitle}`,
        });
      } else if (raw.includes("ENVIAR_BROADCAST")) {
        actionType = "broadcast";
        const msgMatch = raw.match(/MENSAGEM:\s*(.+?)$/s);
        const broadcastMsg = msgMatch?.[1]?.trim() || raw;
        await admin.from("messages").insert({
          workspace_id, content: broadcastMsg, type: "broadcast",
          from_agent_id: ceo.id,
        });
        await admin.from("event_logs").insert({
          workspace_id, event_type: "broadcast_sent", actor: ceo.name,
          description: `CEO enviou broadcast: ${broadcastMsg.substring(0, 80)}...`,
        });
      } else if (raw.includes("CRIAR_DOCUMENTO")) {
        actionType = "document";
        const docTitleMatch = raw.match(/TÍTULO:\s*(.+?)(?:\||$)/);
        const docContentMatch = raw.match(/CONTEÚDO:\s*(.+?)$/s);
        const docTitle = docTitleMatch?.[1]?.trim() || "Documento do CEO";
        const docContent = docContentMatch?.[1]?.trim() || raw;
        await admin.from("documents").insert({
          workspace_id, title: docTitle, content: docContent,
          type: "document", created_by: ceo.name,
        });
        await admin.from("event_logs").insert({
          workspace_id, event_type: "document_created", actor: ceo.name,
          description: `CEO criou documento: ${docTitle}`,
        });
      } else {
        actionType = "nada";
        await admin.from("event_logs").insert({
          workspace_id, event_type: "schedule_triggered", actor: ceo.name,
          description: `CEO autônomo: nenhuma ação necessária. ${raw.substring(0, 100)}`,
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
      description: `Ação autônoma do CEO: ${actionType}`,
    });

    await admin.from("agents").update({
      status: "idle",
      messages_count: (ceo.messages_count || 0) + 1,
      credits_spent: (ceo.credits_spent || 0) + creditsUsed,
    }).eq("id", ceo.id);

    return new Response(JSON.stringify({
      action: actionType, result: actionContent, credits_used: creditsUsed,
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
