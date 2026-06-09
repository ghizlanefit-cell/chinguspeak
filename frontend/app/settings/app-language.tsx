import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { usePrefs, loadPrefs, setAppLang } from "@/src/state/prefs";
import { APP_LANGUAGES } from "@/src/constants/app-data";

export default function AppLanguage() {
  const router = useRouter();
  const prefs = usePrefs();
  React.useEffect(() => { loadPrefs(); }, []);

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="applang-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#1F1A2E" />
          </TouchableOpacity>
          <Text style={styles.title}>App Language</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {APP_LANGUAGES.map((l) => {
            const active = prefs.appLang === l.code;
            return (
              <TouchableOpacity
                key={l.code}
                testID={`applang-${l.code}`}
                style={[styles.row, active && styles.rowActive]}
                activeOpacity={0.85}
                onPress={() => setAppLang(l.code)}
              >
                <View style={styles.flagCircle}>
                  <Text style={styles.flag}>{l.flag}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eng}>{l.english}</Text>
                  <Text style={styles.native}>{l.native}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color="#5B7CFA" />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  title: { color: "#1F1A2E", fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F0EAFC", marginBottom: 8 },
  rowActive: { borderColor: "#5B7CFA", backgroundColor: "rgba(91,124,250,0.08)" },
  flagCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", overflow: "hidden" },
  flag: { fontSize: 26 },
  eng: { color: "#1F1A2E", fontSize: 15, fontWeight: "700" },
  native: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
});
