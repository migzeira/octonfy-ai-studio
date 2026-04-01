import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Workspace {
  id: string;
  name: string;
  mission: string | null;
  products: string | null;
  culture: string | null;
  additional_notes: string | null;
  plan: string | null;
  created_at: string | null;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: null,
  loading: true,
  refetch: async () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = async () => {
    if (!user) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setWorkspace(data);
    } else {
      setWorkspace(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspace();
  }, [user]);

  return (
    <WorkspaceContext.Provider value={{ workspace, loading, refetch: fetchWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
