import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { usePrefs, loadPrefs, setLevel } from "@/src/state/prefs";
import { LEVELS } from "@/src/constants/app-data";

function DotsIcon({ count, active }: { count: number; active: boolean }) {
  const color = active ? "#fff" : "#5B7CFA";
  const arrangements: Record<number, { x: number; y: number }[]> = {
    1: [{ x: 0, y: 0 }],
    2: [{ x: -8, y: 0 }, { x: 8, y: 0 }],
    3: [{ x: -8, y: 6 }, { x: 8, y: 6 }, { x: 0, y: -6 }],
    4: [{ x: -7, y: -7 }, { x: 7, y: -7 }, { x: -7, y: 7 }, { x: 7, y: 7 }],
    5: [{ x: -8, y: 6 }, { x: 0, y: 6 }, { x: 8, y: 6 }, { x: -4, y: -4 }, { x: 4, y: -4 }],
  };
  const dots = arrangements[count] || [];
  return (
    <View style={dotsStyles.wrap}>
      {dots.map((d, i) => (
        <View key={i} style={[dotsStyles.dot, { backgroundColor: color, transform: [{ translateX: d.x }, { translateY: d.y }] }]} />
      ))}
    </View>
  );
}
const dotsStyles = StyleSheet.create({
  wrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", width: 6, height: 6, borderRadius: 3 },
});

export default function LevelSelector() {
  const router = useRouter();
  const prefs = usePrefs();
  React.useEffect(() => { loadPrefs(); }, []);

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="level-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Your Level</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.helper}>Choose your current proficiency.</Text>
          {LEVELS.map((lvl) => {
            const active = prefs.level === lvl.id;
            return (
              <TouchableOpacity
                key={lvl.id}
                testID={`level-${lvl.id}`}
                style={[styles.card, active && styles.cardActive]}
                activeOpacity={0.85}
                onPress={() => { setLevel(lvl.id); }}
              >
                <View style={[styles.iconBox, active && styles.iconBoxActive]}>
                  <DotsIcon count={lvl.dots} active={active} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.lvlNum, active && { color: "#1F1A2E" }]}>Level {lvl.id}</Text>
                    <Text style={[styles.lvlName, active && { color: "#1F1A2E" }]}>{lvl.name}</Text>
                  </View>
                  <Text style={[styles.lvlDesc, active && { color: "rgba(255,255,255,0.85)" }]}>{lvl.description}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
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
  helper: { color: "#9CA3AF", fontSize: 13, marginBottom: 16 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 10 },
  cardActive: { backgroundColor: "#000", borderColor: "#000" },
  iconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: "rgba(91,124,250,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(91,124,250,0.25)" },
  iconBoxActive: { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" },
  titleRow: { flexDirection: "row", gap: 8, alignItems: "baseline" },
  lvlNum: { color: "#6B6585", fontSize: 12, fontWeight: "700" },
  lvlName: { color: "#1F1A2E", fontSize: 16, fontWeight: "800" },
  lvlDesc: { color: "#9CA3AF", fontSize: 12, lineHeight: 17, marginTop: 4 },
});
