import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Medicos from "./pages/Medicos";
import Pagamentos from "./pages/Pagamentos";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import Usuarios from "./pages/Usuarios";
import TesteWhatsApp from "./pages/TesteWhatsApp";
import UserProfile from "./pages/UserProfile";
import NotasMedicos from "./pages/NotasMedicos";
import DashboardMedicos from "./pages/DashboardMedicos";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/medicos" element={
            <ProtectedRoute>
              <Medicos />
            </ProtectedRoute>
          } />
          <Route path="/pagamentos" element={
            <ProtectedRoute>
              <Pagamentos />
            </ProtectedRoute>
          } />
          <Route path="/configuracoes" element={
            <ProtectedRoute>
              <Configuracoes />
            </ProtectedRoute>
          } />
          <Route path="/relatorios" element={
            <ProtectedRoute>
              <Relatorios />
            </ProtectedRoute>
          } />
          <Route path="/teste-whatsapp" element={
            <ProtectedRoute>
              <TesteWhatsApp />
            </ProtectedRoute>
          } />
          <Route path="/usuarios" element={
            <ProtectedRoute>
              <Usuarios />
            </ProtectedRoute>
          } />
          <Route path="/perfil" element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          } />
            <Route path="/notas-medicos" element={<NotasMedicos />} />
            <Route path="/dashboard-medicos" element={<DashboardMedicos />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
