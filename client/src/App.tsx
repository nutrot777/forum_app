import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Settings from "@/pages/Settings";
import DiscussionPage from "@/pages/Discussion";
import { AuthProvider } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { useNotificationWebSocket } from "@/hooks/useNotificationWebSocket";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/settings" component={Settings} />
      <Route path="/discussions/:id" component={DiscussionPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function NotificationWebSocketProvider({ children }: { children: React.ReactNode }) {
  useNotificationWebSocket();
  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <NotificationWebSocketProvider>
            <Layout>
              <Router />
              <Toaster />
            </Layout>
          </NotificationWebSocketProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
