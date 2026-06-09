import axios from "axios";

// Backend URL resolution:
//   - In development (Emergent preview), REACT_APP_BACKEND_URL is set to the preview URL.
//   - In production (Hostinger), leave REACT_APP_BACKEND_URL empty → axios uses a
//     relative "/api" path which hits the PHP backend on the same domain.
const BASE = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BASE}/api`;

export const apiClient = axios.create({ baseURL: API });

apiClient.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("admin_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      if (!window.location.pathname.endsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function formatErr(err) {
  const d = err?.response?.data?.detail;
  if (!d) return err?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(", ");
  return JSON.stringify(d);
}
