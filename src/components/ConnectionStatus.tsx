import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle } from "lucide-react";

export function ConnectionStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from("workspaces").select("id").limit(1);
        if (error && error.message.includes("Failed to fetch")) {
          setIsOffline(true);
        } else {
          if (isOffline) setWasOffline(true);
          setIsOffline(false);
        }
      } catch {
        setIsOffline(true);
      }
    };

    const interval = setInterval(checkConnection, 30000);

    const handleOnline = () => {
      if (isOffline) setWasOffline(true);
      setIsOffline(false);
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOffline]);

  useEffect(() => {
    if (wasOffline) {
      const timer = setTimeout(() => setWasOffline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [wasOffline]);

  if (!isOffline && !wasOffline) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-sm font-medium text-center transition-all ${
        isOffline
          ? "bg-destructive/10 border-b border-destructive/30 text-destructive"
          : "bg-green-500/10 border-b border-green-500/30 text-green-400"
      }`}
    >
      {isOffline ? (
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Sem conexão — alterações podem não ser salvas
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Reconectado ✓
        </span>
      )}
    </div>
  );
}
