import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "./api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("admin_user") || "null");
    } catch { return null; }
  });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) { setChecking(false); return; }
    apiClient.get("/admin-auth/me").then((r) => {
      setAdmin(r.data.admin);
      localStorage.setItem("admin_user", JSON.stringify(r.data.admin));
    }).catch(() => {
      setAdmin(null);
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
    }).finally(() => setChecking(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await apiClient.post("/admin-auth/login", { email, password });
    localStorage.setItem("admin_token", data.access_token);
    localStorage.setItem("admin_user", JSON.stringify(data.admin));
    setAdmin(data.admin);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setAdmin(null);
    window.location.href = "/login";
  };

  return (
    <AuthCtx.Provider value={{ admin, checking, login, logout, setAdmin }}>
      {children}
    </AuthCtx.Provider>
  );
}
