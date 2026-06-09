const RAW_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const WEB_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";
const BASE_URL = (WEB_ORIGIN || RAW_URL).replace(/\/$/, "");
export const API_BASE = `${BASE_URL}/api`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export type TranslateResult = {
  id: string;
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  detected_source?: string;
  credits?: number | null;
};

export type ImageTranslateResult = {
  id: string;
  extracted_text: string;
  translated_text: string;
  target_lang: string;
  credits?: number | null;
};

export type TranscribeResult = { text: string; language?: string; credits?: number | null };

export type TTSResult = { audio_base64: string; mime: string; credits?: number | null };

export type ChatResult = { session_id: string; reply: string; credits?: number };

export type CreditState = {
  user_id: string;
  credits: number;
  is_pro: boolean;
  has_active_subscription: boolean;
};

export type CreditEvent = {
  id: string;
  action_type: string;
  amount: number;
  balance_after: number;
  meta: Record<string, any>;
  created_at: string;
};

export type ModuleContentResponse = {
  module: "tutorial" | "learn" | "roleplay";
  locale: string;
  cached: boolean;
  content: {
    title?: string;
    intro?: string;
    steps?: { heading?: string; body?: string }[];
    practice_prompts?: string[];
    quick_quiz?: { question?: string; answer?: string }[];
  };
};

export type StreakStatus = {
  streak_days: number;
  last_claim_date: string | null;
  can_claim_today: boolean;
  next_reward: number;
  credits: number;
};

export type HistoryItem = {
  id: string;
  kind: string;
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
  favorite: boolean;
};

export const api = {
  translate: (body: { text: string; source_lang: string; target_lang: string; app_locale?: string }) =>
    request<TranslateResult>("/translate", { method: "POST", body: JSON.stringify(body) }),

  translateImage: (body: { image_base64: string; target_lang: string; app_locale?: string }) =>
    request<ImageTranslateResult>("/translate-image", { method: "POST", body: JSON.stringify(body) }),

  transcribe: (body: { audio_base64: string; mime_type: string; language?: string; app_locale?: string }) =>
    request<TranscribeResult>("/transcribe", { method: "POST", body: JSON.stringify(body) }),

  tts: (body: { text: string; target_lang?: string; voice?: string; speed?: number; app_locale?: string }) =>
    request<TTSResult>("/tts", { method: "POST", body: JSON.stringify(body) }),

  chat: (body: {
    session_id: string;
    message: string;
    practice_lang?: string;
    teach_style?: string;
    app_locale?: string;
  }) =>
    request<ChatResult>("/chat", { method: "POST", body: JSON.stringify(body) }),

  creditsMe: (token: string) =>
    request<CreditState>("/credits/me", { headers: { Authorization: `Bearer ${token}` } }),

  rewardCredits: (token: string, body: { source?: string; ad_unit_id?: string; reward_amount?: number }) =>
    request<{ ok: boolean; credits: number; awarded: number }>("/credits/reward", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),

  creditEvents: (token: string) =>
    request<{ items: CreditEvent[] }>("/credits/events", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  verifySubscription: (
    token: string,
    body: { product_id: string; purchase_token: string; package_name?: string },
  ) =>
    request<{ ok: boolean; status: string; verification: string }>("/subscriptions/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),

  streakStatus: (token: string) =>
    request<StreakStatus>("/streak/status", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  streakClaim: (token: string) =>
    request<{ ok: boolean; streak_days: number; reward: number; credits: number; claimed_on: string }>("/streak/claim", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    }),

  moduleContent: (body: {
    module: "tutorial" | "learn" | "roleplay";
    topic?: string;
    level?: string | number;
    app_locale?: string;
    target_lang?: string;
  }) => request<ModuleContentResponse>("/modules/content", { method: "POST", body: JSON.stringify(body) }),

  publicSettings: () => request<{ items: { key: string; value: any; category: string }[] }>("/public/settings"),

  chatHistory: (session_id: string) =>
    request<{ session_id: string; messages: { role: string; content: string; ts: string }[] }>(
      `/chat/${session_id}/history`,
    ),

  clearChat: (session_id: string) =>
    request<{ ok: boolean }>(`/chat/${session_id}`, { method: "DELETE" }),

  saveHistory: (body: {
    kind: string;
    source_text: string;
    translated_text: string;
    source_lang: string;
    target_lang: string;
  }) => request<HistoryItem>("/history", { method: "POST", body: JSON.stringify(body) }),

  listHistory: () => request<{ items: HistoryItem[] }>("/history"),

  deleteHistory: (id: string) =>
    request<{ ok: boolean }>(`/history/${id}`, { method: "DELETE" }),

  toggleFavorite: (id: string) =>
    request<{ id: string; favorite: boolean }>(`/history/${id}/favorite`, { method: "POST" }),

  // Admin
  adminLogin: (body: { username: string; password: string }) =>
    request<{ access_token: string; token_type: string }>("/admin/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  adminStats: (token: string) =>
    request<{ conversations: number; messages: number; translations: number }>(
      "/admin/stats",
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  adminConversations: (token: string) =>
    request<{ items: any[] }>("/admin/conversations", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  adminTranslations: (token: string) =>
    request<{ items: HistoryItem[] }>("/admin/translations", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  adminDeleteConversation: (token: string, session_id: string) =>
    request<{ deleted: number }>(`/admin/conversations/${session_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  adminDeleteTranslation: (token: string, id: string) =>
    request<{ deleted: number }>(`/admin/translations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  adminExportUrl: (token: string, kind: "translations" | "conversations", fmt: "json" | "csv") =>
    `${API_BASE}/admin/export?kind=${kind}&fmt=${fmt}`,

  adminTriggerBuild: (token: string) =>
    request<{
      id: string;
      eas_build_id: string;
      eas_build_url: string;
      profile: string;
      platform: string;
      status: string;
      triggered_by: string;
      created_at: string;
    }>("/admin/builds/android", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  adminRecentBuilds: (token: string) =>
    request<{ items: {
      id: string; eas_build_id: string; eas_build_url: string;
      profile: string; platform: string; status: string;
      triggered_by: string; created_at: string; apk_url?: string;
    }[] }>("/admin/builds/recent", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  // User auth
  ping: () => request<{ status: string; service?: string; ts?: string }>("/ping"),

  deleteAccount: (token: string | null) =>
    request<{ deleted: boolean; guest: boolean; user_id?: string }>("/auth/delete-account", {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  register: (body: { email: string; password: string; name?: string }) =>
    request<{ access_token: string; user: { id: string; email: string; name?: string; credits?: number; is_pro?: boolean } }>(
      "/auth/register", { method: "POST", body: JSON.stringify(body) },
    ),
  login: (body: { email: string; password: string }) =>
    request<{ access_token: string; user: { id: string; email: string; name?: string; credits?: number; is_pro?: boolean } }>(
      "/auth/login", { method: "POST", body: JSON.stringify(body) },
    ),
};
