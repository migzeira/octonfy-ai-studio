import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppSidebar } from "@/components/AppSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionStatus } from "@/components/ConnectionStatus";

import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";
import AgentsPage from "@/pages/AgentsPage";
import CreditsPage from "@/pages/CreditsPage";
import TasksPage from "@/pages/TasksPage";
import DocumentsPage from "@/pages/DocumentsPage";
import MeetingsPage from "@/pages/MeetingsPage";
import SchedulesPage from "@/pages/SchedulesPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import LogsPage from "@/pages/LogsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

// Lazy-load OfficePage so that react-konva is not in the initial bundle.
// A Konva version mismatch would otherwise crash the entire app at startup.
const OfficePage = lazy(() => import("@/pages/OfficePage"));

const queryClient = new QueryClient();

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivateRoute>
      <AppSidebar>{children}</AppSidebar>
    </PrivateRoute>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ConnectionStatus />
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
                <Route path="/dashboard" element={<PrivateLayout><ErrorBoundary><DashboardPage /></ErrorBoundary></PrivateLayout>} />
                <Route path="/office" element={
                  <PrivateLayout>
                    <ErrorBoundary>
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-full min-h-[400px]">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                      }>
                        <OfficePage />
                      </Suspense>
                    </ErrorBoundary>
                  </PrivateLayout>
                } />
                <Route path="/agents" element={<PrivateLayout><ErrorBoundary><AgentsPage /></ErrorBoundary></PrivateLayout>} />
                <Route path="/tasks" element={<PrivateLayout><ErrorBoundary><TasksPage /></ErrorBoundary></PrivateLayout>} />
                <Route path="/documents" element={<PrivateLayout><ErrorBoundary><DocumentsPage /></ErrorBoundary></PrivateLayout>} />
                <Route path="/meetings" element={<PrivateLayout><ErrorBoundary><MeetingsPage /></ErrorBoundary></PrivateLayout>} />
                <Route path="/schedules" element={<PrivateLayout><ErrorBoundary><SchedulesPage /></ErrorBoundary></PrivateLayout>} />
                <Route path="/integrations" element={<PrivateLayout><ErrorBoundary><IntegrationsPage /></ErrorBoundary></PrivateLayout>} />
                <Route path="/credits" element={<PrivateLayout><ErrorBoundary><CreditsPage /></ErrorBoundary></PrivateLayout>} />
                <Route path="/logs" element={<PrivateLayout><ErrorBoundary><LogsPage /></ErrorBoundary></PrivateLayout>} />
                <Route path="/settings" element={<PrivateLayout><ErrorBoundary><SettingsPage /></ErrorBoundary></PrivateLayout>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
