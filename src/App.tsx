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
import OfficePage from "@/pages/OfficePage";
import TasksPage from "@/pages/TasksPage";
import DocumentsPage from "@/pages/DocumentsPage";
import MeetingsPage from "@/pages/MeetingsPage";
import SchedulesPage from "@/pages/SchedulesPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import LogsPage from "@/pages/LogsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

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
              <Route path="/office" element={<PrivateLayout><OfficePage /></PrivateLayout>} />
              <Route path="/agents" element={<PrivateLayout><AgentsPage /></PrivateLayout>} />
              <Route path="/tasks" element={<PrivateLayout><TasksPage /></PrivateLayout>} />
              <Route path="/documents" element={<PrivateLayout><DocumentsPage /></PrivateLayout>} />
              <Route path="/meetings" element={<PrivateLayout><MeetingsPage /></PrivateLayout>} />
              <Route path="/schedules" element={<PrivateLayout><SchedulesPage /></PrivateLayout>} />
              <Route path="/integrations" element={<PrivateLayout><IntegrationsPage /></PrivateLayout>} />
              <Route path="/credits" element={<PrivateLayout><CreditsPage /></PrivateLayout>} />
              <Route path="/logs" element={<PrivateLayout><LogsPage /></PrivateLayout>} />
              <Route path="/settings" element={<PrivateLayout><SettingsPage /></PrivateLayout>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
