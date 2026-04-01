import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppSidebar } from "@/components/AppSidebar";

import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";
import AgentsPage from "@/pages/AgentsPage";
import CreditsPage from "@/pages/CreditsPage";
import NotFound from "@/pages/NotFound";

import OfficePage from "@/pages/OfficePage";
import {
  LayoutDashboard, Building2, Users, CheckSquare, FileText,
  Video, Clock, Plug, Coins, Activity, Settings,
} from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";

const queryClient = new QueryClient();

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivateRoute>
      <AppSidebar>{children}</AppSidebar>
    </PrivateRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Semi-protected (auth only, no workspace required) */}
              <Route path="/onboarding" element={
                <PrivateRoute requireWorkspace={false}><OnboardingPage /></PrivateRoute>
              } />

              {/* Private */}
              <Route path="/dashboard" element={<PrivateLayout><DashboardPage /></PrivateLayout>} />
              <Route path="/office" element={<PrivateLayout><PlaceholderPage title="Escritório" icon={<Building2 className="h-8 w-8" />} /></PrivateLayout>} />
              <Route path="/agents" element={<PrivateLayout><AgentsPage /></PrivateLayout>} />
              <Route path="/tasks" element={<PrivateLayout><PlaceholderPage title="Tarefas" icon={<CheckSquare className="h-8 w-8" />} /></PrivateLayout>} />
              <Route path="/documents" element={<PrivateLayout><PlaceholderPage title="Documentos" icon={<FileText className="h-8 w-8" />} /></PrivateLayout>} />
              <Route path="/meetings" element={<PrivateLayout><PlaceholderPage title="Reuniões" icon={<Video className="h-8 w-8" />} /></PrivateLayout>} />
              <Route path="/schedules" element={<PrivateLayout><PlaceholderPage title="Agendamentos" icon={<Clock className="h-8 w-8" />} /></PrivateLayout>} />
              <Route path="/integrations" element={<PrivateLayout><PlaceholderPage title="Integrações" icon={<Plug className="h-8 w-8" />} /></PrivateLayout>} />
              <Route path="/credits" element={<PrivateLayout><CreditsPage /></PrivateLayout>} />
              <Route path="/logs" element={<PrivateLayout><PlaceholderPage title="Logs" icon={<Activity className="h-8 w-8" />} /></PrivateLayout>} />
              <Route path="/settings" element={<PrivateLayout><PlaceholderPage title="Configurações" icon={<Settings className="h-8 w-8" />} /></PrivateLayout>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
