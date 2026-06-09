import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/api/client";
import { usePrefs } from "@/src/state/prefs";
import { theme, chinguMascot } from "@/src/theme";

const MODES = [
  {
    key: "tutor",
    title: "Tutor Mode",
    blurb: "Guided, beginner-friendly dialogues to build your confidence.",
    bg: ["#EDE4FF", "#DDD0FF"] as const,
    route: "/learn",
  },
  {
    key: "roleplay",
    title: "Role-Play Mode",
    blurb: "Real-life simulations for natural, open-ended conversations.",
    bg: ["#FCE7F3", "#FBD0E8"] as const,
    route: "/scenarios",
  },
];

export default function ChooseMode() {
  const router = useRouter();
  const prefs = usePrefs();
  const [loading, setLoading] = React.useState(false);
  const [tutorialIntro, setTutorialIntro] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await api.moduleContent({
          module: "tutorial",
          app_locale: prefs.appLang,
          target_lang: prefs.to,
          topic: "daily conversation",
          level: String(prefs.level),
        });
        if (!mounted) return;
        setTutorialIntro(res.content?.intro || null);
      } catch {
        if (!mounted) return;
        setTutorialIntro(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [prefs.appLang, prefs.to, prefs.level]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F4EDFF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="modes-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Choose a Mode</Text>
            <Text style={styles.subtitle}>Pick the best way to practice today!</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.key}
              testID={`mode-card-${m.key}`}
              activeOpacity={0.9}
              onPress={() => router.push(m.route as any)}
              style={styles.modeCard}
            >
              <LinearGradient colors={m.bg} style={StyleSheet.absoluteFill} />
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={styles.modeTitleRow}>
                  <Ionicons name={m.key === "tutor" ? "school" : "chatbubble-ellipses"} size={18} color={theme.primaryDeep} />
                  <Text style={styles.modeTitle}>{m.title}</Text>
                </View>
                <Text style={styles.modeBlurb}>{m.blurb}</Text>
              </View>
              <View style={styles.modeRight}>
                <Image source={chinguMascot} style={styles.modeMascot} resizeMode="contain" />
                <View style={styles.modeArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.dynamicBox} testID="tutorial-module-preview">
            <View style={styles.dynamicHead}>
              <Ionicons name="sparkles" size={16} color="#8B5CF6" />
              <Text style={styles.dynamicTitle}>Tutorial preview · AI generated</Text>
            </View>
            {loading ? (
              <ActivityIndicator color="#8B5CF6" size="small" style={{ marginTop: 8 }} />
            ) : (
              <Text style={styles.dynamicText}>
                {tutorialIntro || "Tutorial content is preparing. Open Learn Mode to generate your first lesson."}
              </Text>
            )}
          </View>

          <TouchableOpacity testID="modes-help" style={styles.help}>
            <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
            <Text style={styles.helpText}>What's the difference?</Text>
          </TouchableOpacity>
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

  modeCard: { borderRadius: 24, overflow: "hidden", padding: 22, flexDirection: "row", alignItems: "center", marginBottom: 18, minHeight: 160, ...theme.shadow.md },
  modeTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  modeTitle: { color: theme.text, fontSize: 18, fontWeight: "900" },
  modeBlurb: { color: theme.textBody, fontSize: 13, lineHeight: 18 },
  modeRight: { width: 110, alignItems: "center", justifyContent: "flex-end" },
  modeMascot: { width: 100, height: 100 },
  modeArrow: { position: "absolute", bottom: -6, right: -2, width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center", ...theme.shadow.sm },

  help: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 },
  helpText: { color: theme.textMuted, fontSize: 12, fontWeight: "600" },
  dynamicBox: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9DDFC",
    backgroundColor: "#fff",
    padding: 14,
  },
  dynamicHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  dynamicTitle: { color: "#1F1A2E", fontSize: 12, fontWeight: "800" },
  dynamicText: { color: "#6B6585", fontSize: 12, lineHeight: 18, marginTop: 8 },
});
