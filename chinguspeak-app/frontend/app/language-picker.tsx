import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { LANGUAGES, TRANSLATABLE_LANGUAGES } from "@/src/constants/languages";
import { setFrom, setTo, usePrefs } from "@/src/state/prefs";

export default function LanguagePicker() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slot?: string }>();
  const prefs = usePrefs();
  const slot = (params.slot as "from" | "to") || "to";
  const [q, setQ] = React.useState("");

  const list = slot === "from" ? LANGUAGES : TRANSLATABLE_LANGUAGES;
  const filtered = q.trim()
    ? list.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()) || l.code.includes(q.toLowerCase()))
    : list;
  const selected = slot === "from" ? prefs.from : prefs.to;

  const choose = async (code: string) => {
    if (slot === "from") await setFrom(code);
    else await setTo(code);
    router.back();
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="picker-close" onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#1F1A2E" />
          </TouchableOpacity>
          <Text style={styles.title}>{slot === "from" ? "Translate From" : "Translate To"}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#6B6585" />
          <TextInput
            testID="picker-search"
            placeholder="Search languages…"
            placeholderTextColor="#6B6585"
            value={q}
            onChangeText={setQ}
            style={styles.search}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(l) => l.code}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const active = item.code === selected;
            return (
              <TouchableOpacity
                testID={`picker-item-${item.code}`}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => choose(item.code)}
                activeOpacity={0.85}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={styles.name}>{item.name}</Text>
                {active && <Ionicons name="checkmark-circle" size={20} color="#EC4899" />}
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  title: { color: "#1F1A2E", fontSize: 18, fontWeight: "700" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#F0EAFC" },
  search: { flex: 1, color: "#1F1A2E", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, marginTop: 6, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F0EAFC" },
  rowActive: { borderColor: "#EC4899", backgroundColor: "rgba(255,46,147,0.1)" },
  flag: { fontSize: 26 },
  name: { color: "#1F1A2E", fontSize: 15, fontWeight: "600", flex: 1 },
});
