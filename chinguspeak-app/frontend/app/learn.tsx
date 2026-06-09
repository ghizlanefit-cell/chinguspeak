import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { usePrefs } from "@/src/state/prefs";

export default function LearnScreen() {
  const router = useRouter();
  const prefs = usePrefs();
  const [loading, setLoading] = React.useState(true);
  const [content, setContent] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.moduleContent({
        module: "learn",
        app_locale: prefs.appLang,
        target_lang: prefs.to,
        topic: "everyday communication",
        level: String(prefs.level),
      });
      setContent(res.content || null);
    } catch (e: any) {
      setError(e?.message || "Failed to load learning module.");
    } finally {
      setLoading(false);
    }
  }, [prefs.appLang, prefs.to, prefs.level]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="learn-back-button" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={21} color="#1F1A2E" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Learn Module</Text>
            <Text style={styles.sub}>AI-generated lessons cached for fast loading.</Text>
          </View>
          <TouchableOpacity testID="learn-refresh-button" onPress={load} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color="#8B5CF6" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {loading ? <ActivityIndicator testID="learn-loading" color="#8B5CF6" size="large" /> : null}
          {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !error && content ? (
            <>
              <Text style={styles.cardTitle} testID="learn-title-text">{content.title || "Learn"}</Text>
              <Text style={styles.intro}>{content.intro || "Generated content available."}</Text>

              {(content.steps || []).map((step: any, idx: number) => (
                <View key={`${step?.heading || "step"}-${idx}`} style={styles.stepCard} testID={`learn-step-${idx}`}>
                  <Text style={styles.stepHead}>{step?.heading || `Step ${idx + 1}`}</Text>
                  <Text style={styles.stepBody}>{step?.body || ""}</Text>
                </View>
              ))}

              {!!content.practice_prompts?.length && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Practice Prompts</Text>
                  {content.practice_prompts.map((prompt: string, idx: number) => (
                    <Text key={`${prompt}-${idx}`} style={styles.promptItem}>{`• ${prompt}`}</Text>
                  ))}
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F4FF" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ECE4FD",
  },
  title: { color: "#1F1A2E", fontSize: 18, fontWeight: "800" },
  sub: { color: "#6B6585", fontSize: 12, marginTop: 2 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 100, gap: 10 },
  error: { color: "#EF4444", textAlign: "center" },
  cardTitle: { color: "#1F1A2E", fontSize: 22, fontWeight: "900" },
  intro: { color: "#6B6585", fontSize: 13, lineHeight: 20 },
  stepCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EDE5FD",
    borderRadius: 14,
    padding: 12,
  },
  stepHead: { color: "#1F1A2E", fontSize: 14, fontWeight: "800" },
  stepBody: { color: "#6B6585", fontSize: 12, lineHeight: 18, marginTop: 4 },
  section: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EDE5FD",
    borderRadius: 14,
    padding: 12,
  },
  sectionTitle: { color: "#1F1A2E", fontSize: 13, fontWeight: "800", marginBottom: 6 },
  promptItem: { color: "#6B6585", fontSize: 12, lineHeight: 18 },
});
