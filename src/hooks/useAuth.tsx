import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let initialSessionResolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!isMounted) return;

        setSession(nextSession);

        if (initialSessionResolved || event !== "INITIAL_SESSION") {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;

      initialSessionResolved = true;
      setSession(currentSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
