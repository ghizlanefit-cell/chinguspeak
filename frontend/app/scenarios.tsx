import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/api/client";
import { usePrefs } from "@/src/state/prefs";
import { theme } from "@/src/theme";

const TABS = ["All", "Daily Life", "Travel", "Work", "School"] as const;

const SCENARIOS = [
  { key: "cafe",      title: "Order at a Cafe",   blurb: "Practice ordering food and drinks", icon: "cafe",         tag: "Daily Life", color: "#F472B6" },
  { key: "interview", title: "Job Interview",     blurb: "Practice answering interview questions", icon: "briefcase", tag: "Work",       color: "#A78BFA" },
  { key: "hotel",     title: "Book a Hotel",      blurb: "Make a reservation and check-in",   icon: "bed",          tag: "Travel",      color: "#60A5FA" },
  { key: "airport",   title: "At the Airport",    blurb: "Check-in, security, and more",      icon: "airplane",     tag: "Travel",      color: "#34D399" },
  { key: "doctor",    title: "Visit the Doctor",  blurb: "Describe symptoms and ask questions", icon: "medkit",     tag: "Daily Life", color: "#FB7185" },
  { key: "shopping",  title: "Shopping",          blurb: "Ask for sizes, prices, and discounts", icon: "bag",       tag: "Daily Life", color: "#FBBF24" },
  { key: "directions",title: "Asking Directions", blurb: "Find your way around a new city",   icon: "navigate",     tag: "Travel",      color: "#22D3EE" },
  { key: "classroom", title: "Classroom Talk",    blurb: "Ask the teacher, answer in class",  icon: "school",       tag: "School",      color: "#8B5CF6" },
] as const;

export default function ChooseScenario() {
  const router = useRouter();
  const prefs = usePrefs();
  const [tab, setTab] = React.useState<typeof TABS[number]>("All");
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [generatedIntro, setGeneratedIntro] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await api.moduleContent({
          module: "roleplay",
          app_locale: prefs.appLang,
          target_lang: prefs.to,
          topic: "travel and social situations",
          level: String(prefs.level),
        });
        if (!active) return;
        setGeneratedIntro(res.content?.intro || null);
      } catch {
        if (!active) return;
        setGeneratedIntro(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [prefs.appLang, prefs.to, prefs.level]);

  const filtered = SCENARIOS.filter(
    (s) =>
      (tab === "All" || s.tag === tab) &&
      (query.trim() === "" || s.title.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F4EDFF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="scenarios-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Choose a Scenario</Text>
            <Text style={styles.subtitle}>Practice real-life situations</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            testID="scenario-search"
            placeholder="Search scenarios…"
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t}
              testID={`scenario-tab-${t}`}
              onPress={() => setTab(t)}
              style={[styles.tabChip, tab === t && styles.tabChipActive]}
            >
              <Text style={[styles.tabChipText, tab === t && styles.tabChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
          <View style={styles.generatedBox} testID="roleplay-generated-preview">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="sparkles" size={14} color="#8B5CF6" />
              <Text style={styles.generatedTitle}>Role-Play booster · AI generated</Text>
            </View>
            {loading ? (
              <ActivityIndicator color="#8B5CF6" size="small" style={{ marginTop: 8 }} />
            ) : (
              <Text style={styles.generatedText}>{generatedIntro || "Generate your first role-play module from this screen."}</Text>
            )}
          </View>

          {filtered.map((s) => (
            <TouchableOpacity
              key={s.key}
              testID={`scenario-${s.key}`}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/chat", params: { mode: "roleplay", scenario: s.key, title: s.title } })}
            >
              <View style={[styles.iconCircle, { backgroundColor: s.color + "22" }]}>
                <Ionicons name={s.icon as any} size={22} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <Text style={styles.cardBlurb}>{s.blurb}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && (
            <Text style={styles.empty}>No scenarios match your search.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...theme.shadow.sm },
  title: { color: theme.text, fontSize: 17, fontWeight: "800", textAlign: "center", marginLeft: -38 },
  subtitle: { color: theme.textMuted, fontSize: 12, textAlign: "center", marginLeft: -38, marginTop: 2 },

  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 16, backgroundColor: "#fff", paddingHorizontal: 14, borderRadius: 18, ...theme.shadow.sm },
  searchInput: { flex: 1, color: theme.text, fontSize: 13, paddingVertical: 12 },

  tabsRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 14 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: theme.border, marginRight: 4 },
  tabChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  tabChipText: { color: theme.text, fontSize: 12, fontWeight: "700" },
  tabChipTextActive: { color: "#fff" },

  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#fff", borderRadius: 18, marginBottom: 10, ...theme.shadow.sm },
  iconCircle: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
  cardBlurb: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  empty: { color: theme.textMuted, textAlign: "center", marginTop: 30 },
  generatedBox: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E9DDFC",
    padding: 12,
    backgroundColor: "#fff",
  },
  generatedTitle: { color: "#1F1A2E", fontSize: 12, fontWeight: "800" },
  generatedText: { color: "#6B6585", fontSize: 12, marginTop: 7, lineHeight: 18 },
});
