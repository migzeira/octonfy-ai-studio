import { useState, useEffect, useCallback } from "react";
import { Coins, Plus, Zap, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface OfficeTopBarProps {
  workspaceName: string;
  creditBalance: number;
  workspaceId: string;
  onHireClick: () => void;
  onNewMeetingClick: () => void;
  onNewTaskClick: () => void;
}

export default function OfficeTopBar({
  workspaceName, creditBalance, workspaceId, onHireClick, onNewMeetingClick, onNewTaskClick,
}: OfficeTopBarProps) {
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 min in seconds
  const [running, setRunning] = useState(false);

  const creditColor = creditBalance > 200 ? "#22c55e" : creditBalance > 50 ? "#f59e0b" : "#ef4444";

  useEffect(() => {
    const saved = localStorage.getItem("octonfy_autonomous");
    if (saved === "true") {
      setAutonomousMode(true);
      setRunning(true);
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          triggerCeo();
          return 600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, workspaceId]);

  const triggerCeo = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke("autonomous-ceo", {
        body: { workspace_id: workspaceId },
      });

      if (res.error) {
        toast({ title: "Erro no CEO autônomo", description: res.error.message, variant: "destructive" });
      } else {
        toast({ title: "CEO autônomo atuou", description: "Uma nova ação foi executada pelo CEO." });
      }
    } catch (err) {
      console.error("Autonomous CEO error:", err);
    }
  }, [workspaceId]);

  const toggleAutonomous = (checked: boolean) => {
    setAutonomousMode(checked);
    setRunning(checked);
    setCountdown(600);
    localStorage.setItem("octonfy_autonomous", String(checked));
    if (checked) {
      toast({ title: "Modo autônomo ativado", description: "O CEO agirá a cada 10 minutos." });
    }
  };

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="absolute top-0 left-0 right-0 z-20 h-14 flex items-center justify-between px-5"
      style={{
        background: "rgba(10,10,15,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1e1e2e",
      }}>
      {/* Left */}
      <div className="flex items-center gap-3">
        <span className="text-foreground font-bold text-sm">{workspaceName}</span>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-card border border-border">
          <Coins className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />
          <span className="text-xs font-medium" style={{ color: creditColor }}>{creditBalance}</span>
        </div>
      </div>

      {/* Center */}
      <div className="flex items-center gap-2">
        <button onClick={onHireClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium hover:bg-accent/20 transition-colors" style={{ borderColor: "#3b82f6", color: "#3b82f6" }}>
          <Plus className="h-3.5 w-3.5" /> Contratar
        </button>
        <button onClick={onNewMeetingClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium hover:bg-accent/20 transition-colors" style={{ borderColor: "#6366f1", color: "#6366f1" }}>
          <Zap className="h-3.5 w-3.5" /> Nova Reunião
        </button>
        <button onClick={onNewTaskClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium hover:bg-accent/20 transition-colors" style={{ borderColor: "#22c55e", color: "#22c55e" }}>
          <Check className="h-3.5 w-3.5" /> Nova Tarefa
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">CEO Autônomo</span>
        <Switch checked={autonomousMode} onCheckedChange={toggleAutonomous} />
        {autonomousMode && (
          <span className="text-xs font-mono animate-pulse" style={{ color: "#22c55e" }}>
            próximo em {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
        )}
        {!autonomousMode && <span className="text-xs text-muted-foreground">desativado</span>}
      </div>
    </div>
  );
}
