import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ensureWorkspaceForUser } from "@/lib/ensureWorkspace";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace, loading, refetch } = useWorkspace();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || loading) return;

    if (workspace) {
      navigate("/dashboard", { replace: true });
      return;
    }

    let active = true;

    const setupWorkspace = async () => {
      try {
        await ensureWorkspaceForUser(user);
        await refetch();
        if (active) navigate("/dashboard", { replace: true });
      } catch (err: any) {
        if (active) {
          setError(err?.message || "Não foi possível preparar sua conta.");
        }
      }
    };

    void setupWorkspace();

    return () => {
      active = false;
    };
  }, [user, loading, workspace, navigate, refetch]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dot-grid p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)]" />
      <div className="relative w-full max-w-md glassmorphism rounded-2xl p-8 text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <div>
          <h1 className="text-2xl font-bold gradient-text mb-2">Preparando seu workspace</h1>
          <p className="text-sm text-muted-foreground">
            Você vai entrar direto no dashboard e poderá editar as informações da empresa depois.
          </p>
        </div>

        {error && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button className="w-full gradient-cta border-0" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
