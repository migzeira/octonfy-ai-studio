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

export default function ChatPanel({ agents, messages, workspaceId, selectedAgentId, onSelectAgent }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingAgent, setTypingAgent] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeAgent = agents.find(a => a.id === selectedAgentId);
  const isBroadcast = !selectedAgentId;

  const filteredMessages = messages.filter(m => {
    if (isBroadcast) return m.type === "broadcast" || m.type === "system";
    return (m.from_agent_id === selectedAgentId || m.to_agent_id === selectedAgentId) &&
      (m.type === "dm" || m.type === "user");
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages.length, streamedText]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    if (isBroadcast) {
      // Save broadcast message
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

    setTypingAgent(selectedAgentId);

    try {
      const history = filteredMessages.slice(-20).map(m => ({
        role: m.from_agent_id ? "assistant" : "user",
        content: m.content,
      }));

      const res = await supabase.functions.invoke("send-message", {
        body: { message: text, agent_id: selectedAgentId, workspace_id: workspaceId, history },
      });

      if (res.error) {
        toast({ title: "Erro", description: res.error.message, variant: "destructive" });
      } else if (res.data?.content) {
        // Typewriter effect
        const fullText = res.data.content;
        setStreamedText("");
        for (let i = 0; i <= fullText.length; i++) {
          await new Promise(r => setTimeout(r, 15));
          setStreamedText(fullText.slice(0, i));
        }
        setStreamedText("");
      }
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setTypingAgent(null);
      setSending(false);
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
        {filteredMessages.length === 0 && !streamedText && (
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

          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${isUser ? "" : "flex gap-2"}`}>
                {!isUser && agent && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-5"
                    style={{ background: agent.avatar_color || "#6366f1" }}>
                    {agent.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  {!isUser && agent && (
                    <div className="text-xs text-muted-foreground mb-1">{agent.name} · {agent.role}</div>
                  )}
                  <div className={`px-3 py-2 rounded-lg text-sm ${
                    isUser
                      ? "bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white"
                      : "bg-[#1a1a2e] border border-border text-foreground"
                  }`}>
                    {msg.content}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    {formatTime(msg.created_at)}
                    {!isUser && agent && (
                      <span className="px-1.5 py-0.5 rounded text-[9px]"
                        style={{ background: "rgba(99,102,241,0.2)", color: "#94a3b8" }}>
                        {agent.model}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingAgent && !streamedText && (
          <div className="flex justify-start">
            <div className="flex gap-2 items-end">
              <div className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-border text-sm text-muted-foreground">
                <span className="animate-pulse">
                  {agentById(typingAgent)?.name} está digitando...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Streaming text */}
        {streamedText && activeAgent && (
          <div className="flex justify-start">
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-5"
                style={{ background: activeAgent.avatar_color || "#6366f1" }}>
                {activeAgent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">{activeAgent.name}</div>
                <div className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-border text-sm text-foreground">
                  {streamedText}<span className="animate-pulse">▌</span>
                </div>
              </div>
            </div>
          </div>
        )}
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
            className="p-2 rounded-lg flex items-center justify-center transition-opacity"
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
