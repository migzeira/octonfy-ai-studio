import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background dot-grid">
      <div className="text-center page-enter">
        <h1 className="mb-4 text-8xl font-black gradient-text">404</h1>
        <p className="mb-2 text-xl font-semibold text-foreground">Página não encontrada</p>
        <p className="mb-8 text-muted-foreground">
          O caminho que você tentou não existe no escritório.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg gradient-cta text-white font-medium hover:brightness-110 transition-all active:scale-[0.98]"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
