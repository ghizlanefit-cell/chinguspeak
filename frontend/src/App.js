import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import LlmKeys from "./pages/LlmKeys";
import Users from "./pages/Users";
import Languages from "./pages/Languages";
import Scenarios from "./pages/Scenarios";
import Settings from "./pages/Settings";
import Admins from "./pages/Admins";
import Placeholder from "./pages/Placeholder";
import MobilePreview from "./pages/MobilePreview";

function Protected({ children }) {
  const { admin, checking } = useAuth();
  if (checking) return <div className="empty">Loading…</div>;
  if (!admin) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard/></Protected>} />
            <Route path="/mobile-preview" element={<Protected><MobilePreview/></Protected>} />
            <Route path="/llm-keys" element={<Protected><LlmKeys/></Protected>} />
            <Route path="/users" element={<Protected><Users/></Protected>} />
            <Route path="/languages" element={<Protected><Languages/></Protected>} />
            <Route path="/scenarios" element={<Protected><Scenarios/></Protected>} />
            <Route path="/settings" element={<Protected><Settings/></Protected>} />
            <Route path="/admins" element={<Protected><Admins/></Protected>} />
            <Route path="/styles" element={<Protected><Placeholder title="Styles" description="Manage app themes and visual styles"/></Protected>} />
            <Route path="/apps" element={<Protected><Placeholder title="Apps" description="Manage app builds and versions"/></Protected>} />
            <Route path="/subscription" element={<Protected><Placeholder title="Subscription" description="Pricing tiers, coupons and revenue"/></Protected>} />
            <Route path="/analytics" element={<Protected><Placeholder title="Analytics" description="Deep usage analytics and funnels"/></Protected>} />
            <Route path="/conversations" element={<Protected><Placeholder title="Conversations" description="Browse user chat sessions"/></Protected>} />
            <Route path="/reports" element={<Protected><Placeholder title="Reports" description="Auto-generated weekly/monthly reports"/></Protected>} />
            <Route path="/phrases" element={<Protected><Placeholder title="Phrases" description="Manage learning phrase bank"/></Protected>} />
            <Route path="/voices" element={<Protected><Placeholder title="Voices" description="TTS voice library configuration"/></Protected>} />
            <Route path="/categories" element={<Protected><Placeholder title="Categories" description="Group scenarios and content"/></Protected>} />
            <Route path="/integrations" element={<Protected><Placeholder title="Integrations" description="Payments, push, email, analytics"/></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
