import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, AppWindow, Palette, Languages, Users, MessageSquare, FileText,
  Mic2, Crown, BarChart3, BookOpen, Boxes, KeyRound, Settings as SettingsIcon,
  Bell, Search, ShieldCheck, ChevronRight, LogOut, Plug, Smartphone
} from "lucide-react";
import { useAuth } from "../lib/auth";

const navGroups = [
  { label: null, items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
      { to: "/mobile-preview", icon: Smartphone, label: "Mobile Preview", id: "mobile-preview", badge: "Live" },
  ]},
  { label: "App Management", items: [
      { to: "/apps", icon: AppWindow, label: "Apps", id: "apps" },
      { to: "/styles", icon: Palette, label: "Styles", id: "styles", badge: "New" },
      { to: "/languages", icon: Languages, label: "Languages", id: "languages" },
      { to: "/scenarios", icon: MessageSquare, label: "Scenarios", id: "scenarios" },
      { to: "/users", icon: Users, label: "Users", id: "users" },
      { to: "/subscription", icon: Crown, label: "Subscription", id: "subscription" },
  ]},
  { label: "Analytics", items: [
      { to: "/analytics", icon: BarChart3, label: "Analytics", id: "analytics" },
      { to: "/conversations", icon: MessageSquare, label: "Conversations", id: "conversations" },
      { to: "/reports", icon: FileText, label: "Reports", id: "reports" },
  ]},
  { label: "Content", items: [
      { to: "/phrases", icon: BookOpen, label: "Phrases", id: "phrases" },
      { to: "/voices", icon: Mic2, label: "Voices", id: "voices" },
      { to: "/categories", icon: Boxes, label: "Categories", id: "categories" },
  ]},
  { label: "Settings", items: [
      { to: "/llm-keys", icon: KeyRound, label: "LLM & APIs", id: "llm-keys" },
      { to: "/integrations", icon: Plug, label: "Integrations", id: "integrations" },
      { to: "/admins", icon: ShieldCheck, label: "Admins", id: "admins" },
      { to: "/settings", icon: SettingsIcon, label: "Settings", id: "settings" },
  ]},
];

export default function Layout({ children }) {
  const { admin, logout } = useAuth();
  const loc = useLocation();
  return (
    <div className="shell">
      <aside className="sidebar" data-testid="sidebar">
        <div className="logo">
          <div className="mark">CS</div>
          <div>
            <div style={{fontFamily:"'Sora'",fontWeight:800,fontSize:18,lineHeight:1}}>chingu<span style={{color:"#EC4899"}}>speak</span></div>
            <div className="dim" style={{fontSize:11,marginTop:2,letterSpacing:"0.06em"}}>ADMIN CONSOLE</div>
          </div>
        </div>

        {navGroups.map((g, gi) => (
          <div key={gi}>
            {g.label && <div className="group-label">{g.label}</div>}
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/"}
                data-testid={`nav-${it.id}`}
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              >
                <it.icon size={18} strokeWidth={1.8} />
                <span>{it.label}</span>
                {it.badge && <span className="badge">{it.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}

        <div style={{marginTop:32, padding:14, borderRadius:18, background:"linear-gradient(180deg, rgba(168,85,247,0.18), rgba(236,72,153,0.08))", border:"1px solid rgba(168,85,247,0.3)"}}>
          <div style={{fontSize:11,letterSpacing:"0.12em",color:"#C4B5FD"}}>CURRENT PLAN</div>
          <div style={{fontFamily:"'Sora'",fontWeight:800,fontSize:18,marginTop:4}}>Enterprise <span style={{fontSize:14}}>👑</span></div>
          <button className="btn primary" style={{width:"100%",justifyContent:"center",marginTop:12}} data-testid="upgrade-plan-btn">Upgrade Plan</button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1 data-testid="page-title">{titleFromPath(loc.pathname)}</h1>
            <div className="muted" style={{marginTop:6,fontSize:14}}>Welcome back, {admin?.name || "Admin"}! 👋</div>
          </div>
          <div className="row" style={{gap:14}}>
            <div className="search-wrap"><Search size={16} /><input placeholder="Search anything..." data-testid="global-search" /></div>
            <button className="btn ghost" data-testid="notifications-btn"><Bell size={18}/></button>
            <div className="row" style={{gap:10}}>
              <div className="avatar">{(admin?.name || "A").slice(0,1).toUpperCase()}</div>
              <div style={{lineHeight:1.2}}>
                <div style={{fontWeight:700,fontSize:14}} data-testid="admin-name">{admin?.name || "Admin"}</div>
                <div className="dim" style={{fontSize:11}} data-testid="admin-role">{admin?.role || "admin"}</div>
              </div>
              <button className="btn sm ghost" onClick={logout} data-testid="logout-btn" title="Logout"><LogOut size={14}/></button>
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function titleFromPath(p) {
  if (p === "/") return "Dashboard";
  const seg = p.split("/").filter(Boolean)[0] || "";
  return seg.split("-").map(s => s[0].toUpperCase()+s.slice(1)).join(" ");
}
