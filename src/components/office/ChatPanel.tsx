import { useState, useRef, useEffect } from "react";
import { Send, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Agent } from "@/hooks/useRealtimeAgents";
import type { Message } from "@/hooks/useRealtimeMessages";

const MODEL_COSTS: Record<string, number> = {
  "claude-haiku": 2, "llama-groq": 2, "gemini-pro": 6,
  "claude-sonnet": 8, "gpt-4o": 10, "claude-opus": 20,
};

interface ChatPanelProps {
  agents: Agent[];
  messages: Message[];
  workspaceId: string;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
}

function useTypewriter(text: string, speed = 15) {
  const [displayed, setDisplayed] = useState("");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayed("");
      setIsDone(true);
      return;
    }
    setDisplayed("");
    setIsDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setIsDone(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, isDone };
}

function TypingIndicator({ agentName, agentColor }: { agentName: string; agentColor: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex gap-2 items-end">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: agentColor }}
        >
          {agentName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">{agentName} está digitando...</div>
          <div className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-border inline-flex gap-1.5 items-center">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                style={{
                  animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypewriterMessage({
  content, isNew, agentName, agentColor, agentRole, model, timestamp,
}: {
  content: string;
  isNew: boolean;
  agentName: string;
  agentColor: string;
  agentRole: string;
  model: string;
  timestamp: string;
}) {
  const { displayed, isDone } = useTypewriter(isNew ? content : "", 15);
  const text = isNew ? displayed : content;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] flex gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-5"
          style={{ background: agentColor }}
        >
          {agentName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-foreground">{agentName}</span>
            <span className="text-[10px] text-muted-foreground">{agentRole}</span>
          </div>
          <div className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-border text-sm text-foreground whitespace-pre-wrap">
            {text}
            {isNew && !isDone && (
              <span className="inline-block w-[2px] h-4 bg-primary animate-pulse ml-0.5 align-middle" />
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
            {timestamp}
            <span className="px-1.5 py-0.5 rounded text-[9px]"
              style={{ background: "rgba(99,102,241,0.2)", color: "#94a3b8" }}>
              {model}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel({ agents, messages, workspaceId, selectedAgentId, onSelectAgent }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typewriterMsg, setTypewriterMsg] = useState<{ content: string; agent: Agent } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayedIds = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeAgent = agents.find(a => a.id === selectedAgentId);
  const isBroadcast = !selectedAgentId;

  const filteredMessages = messages.filter(m => {
    if (isBroadcast) return m.type === "broadcast" || m.type === "system";
    return (m.from_agent_id === selectedAgentId || m.to_agent_id === selectedAgentId) &&
      (m.type === "dm" || m.type === "user");
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages.length, isTyping, typewriterMsg]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();

    // ── Office command interception ────────────────────────────────────
    // Patterns: "descanse [nome]" | "/rest [nome]" → send agent to lounge
    //           "trabalhe [nome]" | "/work [nome]" → call agent back to desk
    //           "reunião [nome]"  | "/meeting [nome]" → mark agent in_meeting
    const cmdRest = text.match(
      /^(?:\/rest|descanse?|vai\s+descansar?|manda?\s+descansar?)\s+(.+)$/i
    );
    const cmdWork = text.match(
      /^(?:\/work|trabalhe?|volta(?:r)?\s+trabalhar?|chama(?:r)?\s+(?:para\s+)?trabalhar?)\s+(.+)$/i
    );
    const cmdMeet = text.match(
      /^(?:\/meeting|reuni[aã]o|chama(?:r)?\s+(?:para\s+)?reuni[aã]o)\s+(.+)$/i
    );

    const cmd = cmdRest ?? cmdWork ?? cmdMeet;
    if (cmd) {
      const nameQuery = cmd[1].trim().toLowerCase();
      // Match by first name or substring of full name
      const target = agents.find(a => {
        const n = a.name.toLowerCase();
        return n === nameQuery || n.startsWith(nameQuery) || n.includes(nameQuery);
      });
      if (target) {
        setInput("");
        let systemMsg = "";
        if (cmdRest) {
          await supabase.from("agents")
            .update({ is_active: false, status: "idle" })
            .eq("id", target.id);
          systemMsg = `🛋️ ${target.name} foi mandado(a) descansar.`;
        } else if (cmdWork) {
          await supabase.from("agents")
            .update({ is_active: true, status: "working" })
            .eq("id", target.id);
          systemMsg = `💼 ${target.name} foi chamado(a) para trabalhar.`;
        } else if (cmdMeet) {
          await supabase.from("agents")
            .update({ status: "in_meeting" })
            .eq("id", target.id);
          systemMsg = `📊 ${target.name} foi chamado(a) para a reunião.`;
        }
        if (systemMsg) {
          await supabase.from("messages").insert({
            workspace_id: workspaceId, content: systemMsg, type: "system",
          });
        }
        return; // don't send to AI
      }
      // Agent not found — fall through to normal message
    }

    setInput("");
    setSending(true);

    if (isBroadcast) {
      await supabase.from("messages").insert({
        workspace_id: workspaceId, content: text, type: "broadcast",
      });
      setSending(false);
      return;
    }

    if (!selectedAgentId || !activeAgent) {
      setSending(false);
      return;
    }

    setIsTyping(true);

    try {
      const history = filteredMessages.slice(-20).map(m => ({
        role: m.from_agent_id ? "assistant" : "user",
        content: m.content,
      }));

      const res = await supabase.functions.invoke("send-message", {
        body: { message: text, agent_id: selectedAgentId, workspace_id: workspaceId, history },
      });

      if (res.error) {
        // Reset agent status on error
        await supabase.from("agents").update({ status: "idle" }).eq("id", selectedAgentId);

        if (res.error.message?.includes("402") || res.error.message?.includes("créditos")) {
          toast({ title: "Créditos insuficientes", description: "Recarregue seus créditos para continuar.", variant: "destructive" });
        } else {
          toast({ title: "Erro", description: res.error.message, variant: "destructive" });
        }
      } else if (res.data?.content) {
        setIsTyping(false);
        setTypewriterMsg({ content: res.data.content, agent: activeAgent });
        // Typewriter will show, then clear after it finishes
        // The real message will appear via realtime subscription
      }
    } catch (err: any) {
      // Reset agent on error
      await supabase.from("agents").update({ status: "idle" }).eq("id", selectedAgentId);
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setIsTyping(false);
      setSending(false);
      // Clear typewriter after delay to let realtime message appear
      setTimeout(() => setTypewriterMsg(null), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const estimatedCost = activeAgent
    ? Math.ceil(50 / 1000 * (MODEL_COSTS[activeAgent.model || "claude-sonnet"] || 8))
    : 0;

  const agentById = (id: string | null) => agents.find(a => a.id === id);

  const formatTime = (ts: string | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Typing bounce keyframes */}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>

      {/* Agent selector */}
      <div className="p-3 border-b border-border">
        <select
          value={selectedAgentId || "broadcast"}
          onChange={e => onSelectAgent(e.target.value === "broadcast" ? null : e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground"
        >
          <option value="broadcast">📢 Broadcast — todos os agentes</option>
          {agents.filter(a => a.is_active).map(a => (
            <option key={a.id} value={a.id}>{a.name} — {a.role}</option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredMessages.length === 0 && !isTyping && !typewriterMsg && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            Nenhuma mensagem ainda. Comece a conversa!
          </div>
        )}
        {filteredMessages.map(msg => {
          const isUser = !msg.from_agent_id;
          const agent = agentById(msg.from_agent_id);
          const isSystem = msg.type === "system";

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center text-muted-foreground text-xs italic py-1">
                — {msg.content} —
              </div>
            );
          }

          // Check if this is a new message for typewriter
          const isNew = !displayedIds.current.has(msg.id);
          if (isNew) displayedIds.current.add(msg.id);

          if (!isUser && agent) {
            return (
              <TypewriterMessage
                key={msg.id}
                content={msg.content}
                isNew={isNew}
                agentName={agent.name}
                agentColor={agent.avatar_color || "#6366f1"}
                agentRole={agent.role}
                model={agent.model || "ai"}
                timestamp={formatTime(msg.created_at)}
              />
            );
          }

          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                <div className="px-3 py-2 rounded-lg text-sm bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white">
                  {msg.content}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 text-right">
                  {formatTime(msg.created_at)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && activeAgent && (
          <TypingIndicator agentName={activeAgent.name} agentColor={activeAgent.avatar_color || "#6366f1"} />
        )}

        {/* Typewriter for streamed response */}
        {typewriterMsg && (
          <TypewriterMessage
            content={typewriterMsg.content}
            isNew={true}
            agentName={typewriterMsg.agent.name}
            agentColor={typewriterMsg.agent.avatar_color || "#6366f1"}
            agentRole={typewriterMsg.agent.role}
            model={typewriterMsg.agent.model || "ai"}
            timestamp={new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border" style={{ background: "#0a0a0f" }}>
        <div className="flex items-end gap-2">
          <button className="p-2 text-muted-foreground hover:text-foreground">
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Mensagem para ${activeAgent?.name || "todos"}...`}
            className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            style={{ maxHeight: 120, minHeight: 36 }}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2 rounded-lg flex items-center justify-center transition-all active:scale-95"
            style={{
              background: input.trim() ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "transparent",
              opacity: input.trim() ? 1 : 0.5,
            }}
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
        {activeAgent && (
          <div className="text-[10px] text-muted-foreground mt-1 pl-9">
            ~{estimatedCost} créditos · {activeAgent.model}
          </div>
        )}
      </div>
    </div>
  );
}
