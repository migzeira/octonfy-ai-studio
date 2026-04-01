import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, CheckSquare, FileText,
  Video, Clock, Plug, Coins, Activity, Settings, LogOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeCredits } from "@/hooks/useRealtimeCredits";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Building2, label: "Escritório", path: "/office" },
  { icon: Users, label: "Agentes", path: "/agents" },
  { icon: CheckSquare, label: "Tarefas", path: "/tasks" },
  { icon: FileText, label: "Documentos", path: "/documents" },
  { icon: Video, label: "Reuniões", path: "/meetings" },
  { icon: Clock, label: "Agendamentos", path: "/schedules" },
  { icon: Plug, label: "Integrações", path: "/integrations" },
  { icon: Coins, label: "Créditos", path: "/credits" },
  { icon: Activity, label: "Logs", path: "/logs" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { workspace } = useWorkspace();
  const { credits } = useRealtimeCredits(workspace?.id);
  
  const balance = credits?.balance || 0;
  const [collapsed, setCollapsed] = useState(false);

  const creditColor = balance > 200 ? "text-success" : balance >= 50 ? "text-warning" : "text-destructive";

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen flex flex-col border-r border-border bg-sidebar z-40 transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold gradient-text">Octonfy</span>
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">{workspace?.name}</span>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground p-1">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {menuItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                  active
                    ? "gradient-cta text-white font-medium glow-neon"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-3 space-y-3">
          <div className={cn("flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2", collapsed && "justify-center")}>
            <Coins className={cn("h-4 w-4 shrink-0", creditColor)} />
            {!collapsed && <span className={cn("text-sm font-semibold", creditColor)}>{balance.toLocaleString()}</span>}
          </div>
          {!collapsed && (
          <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full gradient-cta flex items-center justify-center text-xs font-bold text-white shrink-0">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                {isAdmin && <span className="text-[10px] font-bold text-primary">👑 Admin</span>}
              </div>
              <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground" title="Sair">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
          {collapsed && (
            <button onClick={handleLogout} className="w-full flex justify-center text-muted-foreground hover:text-foreground" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn("flex-1 transition-all duration-300", collapsed ? "ml-16" : "ml-60")}>
        {children}
      </main>
    </div>
  );
}
