import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { api, HistoryItem } from "@/src/api/client";
import { setAdminToken, usePrefs, loadPrefs } from "@/src/state/prefs";

type Conv = { session_id: string; message_count: number; messages: any[]; practice_lang?: string; last_ts?: string };
type Build = { id: string; eas_build_id: string; eas_build_url: string; status: string; created_at: string; triggered_by: string; apk_url?: string };

export default function Admin() {
  const router = useRouter();
  const prefs = usePrefs();
  const [tab, setTab] = React.useState<"stats" | "conversations" | "translations" | "builds">("stats");
  const [stats, setStats] = React.useState<any>(null);
  const [convs, setConvs] = React.useState<Conv[]>([]);
  const [trans, setTrans] = React.useState<HistoryItem[]>([]);
  const [builds, setBuilds] = React.useState<Build[]>([]);
  const [buildLoading, setBuildLoading] = React.useState(false);
  const [buildError, setBuildError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => { loadPrefs(); }, []);

  const token = prefs.adminToken;

  const load = React.useCallback(async () => {
    if (!token) { router.replace("/admin-login"); return; }
    setLoading(true);
    try {
      const [s, c, t] = await Promise.all([
        api.adminStats(token),
        api.adminConversations(token),
        api.adminTranslations(token),
      ]);
      setStats(s); setConvs(c.items); setTrans(t.items);
    } catch (e: any) {
      if (String(e?.message).includes("401")) {
        await setAdminToken(null);
        router.replace("/admin-login");
      }
    } finally { setLoading(false); }
  }, [token, router]);

  React.useEffect(() => { load(); }, [load]);

  const logout = async () => { await setAdminToken(null); router.replace("/(tabs)"); };

  const onExport = (kind: "translations" | "conversations", fmt: "json" | "csv") => {
    if (!token) return;
    const url = `${api.adminExportUrl(token, kind, fmt)}`;
    // Open with token via header isn't possible from Linking; use a temporary fetch-blob via window in web,
    // for native we'll open the URL via fetch and append token query for simplicity (handled server-side via header preferred).
    // Simpler: fetch + open as data URL.
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.text())
      .then((txt) => {
        const dataUrl = `data:${fmt === "json" ? "application/json" : "text/csv"};charset=utf-8,${encodeURIComponent(txt)}`;
        Linking.openURL(dataUrl).catch(() => {});
      })
      .catch(() => {});
  };

  const onDeleteConv = async (sid: string) => {
    if (!token) return;
    try { await api.adminDeleteConversation(token, sid); setConvs((p) => p.filter((c) => c.session_id !== sid)); } catch {}
  };
  const onDeleteTrans = async (id: string) => {
    if (!token) return;
    try { await api.adminDeleteTranslation(token, id); setTrans((p) => p.filter((t) => t.id !== id)); } catch {}
  };

  const refreshBuilds = React.useCallback(async () => {
    if (!token) return;
    try {
      const r = await api.adminRecentBuilds(token);
      setBuilds(r.items);
    } catch (e: any) {
      setBuildError(String(e?.message || e));
    }
  }, [token]);

  React.useEffect(() => {
    if (tab === "builds") { refreshBuilds(); }
  }, [tab, refreshBuilds]);

  const onTriggerBuild = async () => {
    if (!token || buildLoading) return;
    setBuildLoading(true);
    setBuildError(null);
    try {
      const rec = await api.adminTriggerBuild(token);
      setBuilds((p) => [{ ...rec }, ...p]);
      Linking.openURL(rec.eas_build_url).catch(() => {});
    } catch (e: any) {
      setBuildError(String(e?.message || e));
    } finally {
      setBuildLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="admin-back" onPress={() => router.replace("/(tabs)")} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Panel</Text>
          <TouchableOpacity testID="admin-logout" onPress={logout} style={styles.iconBtn}>
            <Feather name="log-out" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabsRow}>
          {(["stats", "conversations", "translations", "builds"] as const).map((t) => (
            <TouchableOpacity key={t} testID={`admin-tab-${t}`} style={[styles.tabChip, tab === t && styles.tabChipActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabChipText, tab === t && styles.tabChipTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingBox}><ActivityIndicator color="#5B7CFA" size="large" /></View>
        ) : tab === "stats" ? (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: "rgba(91,124,250,0.12)", borderColor: "rgba(91,124,250,0.35)" }]}>
                <Ionicons name="chatbubbles" size={20} color="#5B7CFA" />
                <Text style={styles.statNum}>{stats?.conversations || 0}</Text>
                <Text style={styles.statLabel}>Conversations</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "rgba(255,143,163,0.12)", borderColor: "rgba(255,143,163,0.35)" }]}>
                <Ionicons name="text" size={20} color="#FF8FA3" />
                <Text style={styles.statNum}>{stats?.messages || 0}</Text>
                <Text style={styles.statLabel}>Messages</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "rgba(255,200,87,0.12)", borderColor: "rgba(255,200,87,0.35)" }]}>
                <Ionicons name="language" size={20} color="#FFC857" />
                <Text style={styles.statNum}>{stats?.translations || 0}</Text>
                <Text style={styles.statLabel}>Translations</Text>
              </View>
            </View>

            <Text style={styles.section}>Export Data</Text>
            <View style={styles.exportGrid}>
              <ExportBtn label="Conversations · JSON" onPress={() => onExport("conversations", "json")} testID="export-conv-json" />
              <ExportBtn label="Conversations · CSV" onPress={() => onExport("conversations", "csv")} testID="export-conv-csv" />
              <ExportBtn label="Translations · JSON" onPress={() => onExport("translations", "json")} testID="export-trans-json" />
              <ExportBtn label="Translations · CSV" onPress={() => onExport("translations", "csv")} testID="export-trans-csv" />
            </View>
          </ScrollView>
        ) : tab === "conversations" ? (
          <FlatList
            data={convs}
            keyExtractor={(c) => c.session_id}
            contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
            ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
            renderItem={({ item }) => {
              const isOpen = expanded === item.session_id;
              return (
                <View style={styles.itemCard}>
                  <TouchableOpacity onPress={() => setExpanded(isOpen ? null : item.session_id)} style={styles.itemHead} testID={`conv-${item.session_id}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>Session {item.session_id.slice(-10)}</Text>
                      <Text style={styles.itemSub}>{item.message_count} msgs · {item.practice_lang || "—"}</Text>
                    </View>
                    <TouchableOpacity testID={`del-conv-${item.session_id}`} onPress={() => onDeleteConv(item.session_id)} style={styles.delBtn}>
                      <Feather name="trash-2" size={14} color="#FCA5A5" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={styles.itemBody}>
                      {item.messages.map((m, i) => (
                        <View key={i} style={[styles.msg, m.role === "user" ? styles.msgUser : styles.msgBot]}>
                          <Text style={styles.msgRole}>{m.role.toUpperCase()}</Text>
                          <Text style={styles.msgText}>{m.content}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            }}
          />
        ) : tab === "translations" ? (
          <FlatList
            data={trans}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
            ListEmptyComponent={<Text style={styles.empty}>No translations yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.itemCard}>
                <View style={styles.itemHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemSub}>{item.source_lang} → {item.target_lang} · {item.kind}</Text>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.source_text}</Text>
                    <Text style={styles.itemSub} numberOfLines={2}>{item.translated_text}</Text>
                  </View>
                  <TouchableOpacity testID={`del-trans-${item.id}`} onPress={() => onDeleteTrans(item.id)} style={styles.delBtn}>
                    <Feather name="trash-2" size={14} color="#FCA5A5" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <View style={buildStyles.heroCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <View style={buildStyles.heroIcon}><Ionicons name="hammer" size={20} color="#A78BFA" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={buildStyles.heroTitle}>Build new Android APK</Text>
                  <Text style={buildStyles.heroSub}>Triggers a cloud build on Expo EAS (~10–14 min). Free tier: 15/month.</Text>
                </View>
              </View>
              <TouchableOpacity
                testID="admin-trigger-build"
                onPress={onTriggerBuild}
                disabled={buildLoading}
                style={[buildStyles.heroBtn, buildLoading && { opacity: 0.5 }]}
                activeOpacity={0.85}
              >
                {buildLoading ? (
                  <ActivityIndicator color="#F5F1FF" size="small" />
                ) : (
                  <Ionicons name="cloud-upload" size={16} color="#F5F1FF" />
                )}
                <Text style={buildStyles.heroBtnText}>{buildLoading ? "Triggering…" : "Trigger New APK Build"}</Text>
              </TouchableOpacity>
              {buildError && (
                <Text testID="admin-build-error" style={{ color: "#FCA5A5", fontSize: 11, marginTop: 10 }}>{buildError}</Text>
              )}
              <TouchableOpacity testID="admin-builds-refresh" onPress={refreshBuilds} style={{ marginTop: 12, alignSelf: "flex-start" }}>
                <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "600" }}>↻ Refresh status</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.section}>Recent builds</Text>
            {builds.length === 0 ? (
              <Text style={styles.empty}>No builds yet. Tap the button above to start one.</Text>
            ) : (
              builds.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  testID={`build-${b.eas_build_id}`}
                  style={styles.itemCard}
                  onPress={() => Linking.openURL(b.apk_url || b.eas_build_url).catch(() => {})}
                  activeOpacity={0.85}
                >
                  <View style={styles.itemHead}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        <View style={[buildStyles.statusDot, { backgroundColor: statusColor(b.status) }]} />
                        <Text style={styles.itemTitle}>{b.status}</Text>
                        {b.apk_url && (
                          <View style={buildStyles.readyChip}><Text style={buildStyles.readyChipText}>APK READY</Text></View>
                        )}
                      </View>
                      <Text style={styles.itemSub} numberOfLines={1}>{b.eas_build_id}</Text>
                      <Text style={styles.itemSub}>by {b.triggered_by} · {new Date(b.created_at).toLocaleString()}</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function ExportBtn({ label, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={exportStyles.btn} activeOpacity={0.8}>
      <Feather name="download" size={16} color="#5B7CFA" />
      <Text style={exportStyles.text}>{label}</Text>
    </TouchableOpacity>
  );
}
const exportStyles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "rgba(91,124,250,0.08)", borderWidth: 1, borderColor: "rgba(91,124,250,0.25)", borderRadius: 14, width: "48%" },
  text: { color: "#1F1A2E", fontSize: 12, fontWeight: "600", flex: 1 },
});

function statusColor(s: string) {
  switch (s) {
    case "FINISHED": return "#34D399";
    case "ERRORED":
    case "CANCELED": return "#FCA5A5";
    case "IN_PROGRESS": return "#FBBF24";
    default: return "#9CA3AF";
  }
}

const buildStyles = StyleSheet.create({
  heroCard: { backgroundColor: "rgba(167,139,250,0.08)", borderWidth: 1, borderColor: "rgba(167,139,250,0.3)", borderRadius: 20, padding: 18, marginBottom: 22 },
  heroIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(167,139,250,0.18)" },
  heroTitle: { color: "#1F1A2E", fontSize: 15, fontWeight: "800" },
  heroSub: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  heroBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#A78BFA", borderRadius: 14, paddingVertical: 13, marginTop: 6 },
  heroBtnText: { color: "#F5F1FF", fontSize: 14, fontWeight: "800" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  readyChip: { backgroundColor: "rgba(52,211,153,0.18)", borderWidth: 1, borderColor: "rgba(52,211,153,0.4)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 4 },
  readyChipText: { color: "#34D399", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  title: { color: "#1F1A2E", fontSize: 18, fontWeight: "700" },
  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginVertical: 12 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  tabChipActive: { backgroundColor: "#5B7CFA", borderColor: "#5B7CFA" },
  tabChipText: { color: "#9CA3AF", fontSize: 12, fontWeight: "600" },
  tabChipTextActive: { color: "#1F1A2E" },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: { flex: 1, padding: 16, borderRadius: 18, borderWidth: 1, gap: 6 },
  statNum: { color: "#1F1A2E", fontSize: 26, fontWeight: "900" },
  statLabel: { color: "#9CA3AF", fontSize: 11, fontWeight: "600" },
  section: { color: "#1F1A2E", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  exportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  itemCard: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", borderRadius: 16, marginBottom: 10, overflow: "hidden" },
  itemHead: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  itemTitle: { color: "#1F1A2E", fontSize: 13, fontWeight: "700", marginTop: 2 },
  itemSub: { color: "#9CA3AF", fontSize: 11 },
  delBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239,68,68,0.15)" },
  itemBody: { padding: 14, paddingTop: 0, gap: 8 },
  msg: { padding: 10, borderRadius: 12, borderWidth: 1 },
  msgUser: { backgroundColor: "rgba(91,124,250,0.08)", borderColor: "rgba(91,124,250,0.2)" },
  msgBot: { backgroundColor: "rgba(255,143,163,0.06)", borderColor: "rgba(255,143,163,0.2)" },
  msgRole: { color: "#9CA3AF", fontSize: 9, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  msgText: { color: "#1F1A2E", fontSize: 13, lineHeight: 18 },
  empty: { color: "#9CA3AF", textAlign: "center", marginTop: 60 },
});
