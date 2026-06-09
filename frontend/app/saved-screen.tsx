import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api, HistoryItem } from "@/src/api/client";
import { getLanguage } from "@/src/constants/languages";

export default function SavedScreen() {
  const [items, setItems] = React.useState<HistoryItem[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "favorites">("all");
  const load = React.useCallback(async () => { try { const r = await api.listHistory(); setItems(r.items); } catch {} }, []);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const onFav = async (id: string) => { try { const r = await api.toggleFavorite(id); setItems((p) => p.map((i) => i.id === id ? { ...i, favorite: r.favorite } : i)); } catch {} };
  const onDel = async (id: string) => { try { await api.deleteHistory(id); setItems((p) => p.filter((i) => i.id !== id)); } catch {} };
  const shown = filter === "favorites" ? items.filter((i) => i.favorite) : items;
  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}><Text style={styles.title}>Saved</Text><Text style={styles.subtitle}>Your translation history</Text></View>
        <View style={styles.filterRow}>
          <TouchableOpacity testID="filter-all" style={[styles.chip, filter === "all" && styles.chipActive]} onPress={() => setFilter("all")}><Text style={[styles.chipText, filter === "all" && styles.chipTextActive]}>All</Text></TouchableOpacity>
          <TouchableOpacity testID="filter-favorites" style={[styles.chip, filter === "favorites" && styles.chipActive]} onPress={() => setFilter("favorites")}><Text style={[styles.chipText, filter === "favorites" && styles.chipTextActive]}>Favorites</Text></TouchableOpacity>
        </View>
        <FlatList data={shown} keyExtractor={(i) => i.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
          refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<View style={styles.empty}><Feather name="archive" size={32} color="#9CA3AF" /><Text style={styles.emptyText}>{filter === "favorites" ? "No favorites yet." : "No history yet."}</Text></View>}
          renderItem={({ item }) => {
            const from = getLanguage(item.source_lang); const to = getLanguage(item.target_lang);
            return (
              <View style={styles.card} testID={`saved-card-${item.id}`}>
                <View style={styles.cardHead}>
                  <View style={styles.langTag}><Text style={styles.flag}>{from.flag}</Text><Ionicons name="arrow-forward" size={12} color="#9CA3AF" /><Text style={styles.flag}>{to.flag}</Text></View>
                  <View style={styles.kind}><Ionicons name={item.kind === "voice" ? "mic" : item.kind === "image" ? "camera" : "text"} size={12} color="#6B6585" /><Text style={styles.kindText}>{item.kind.toUpperCase()}</Text></View>
                </View>
                <Text style={styles.src} numberOfLines={3}>{item.source_text}</Text>
                <View style={styles.divider} />
                <Text style={styles.trans} numberOfLines={4}>{item.translated_text}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity testID={`fav-${item.id}`} onPress={() => onFav(item.id)} style={styles.actBtn}><Ionicons name={item.favorite ? "star" : "star-outline"} size={18} color={item.favorite ? "#FFD43B" : "#6B6585"} /></TouchableOpacity>
                  <TouchableOpacity testID={`del-${item.id}`} onPress={() => onDel(item.id)} style={styles.actBtn}><Feather name="trash-2" size={16} color="#6B6585" /></TouchableOpacity>
                </View>
              </View>
            );
          }} />
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: { color: "#1F1A2E", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#9CA3AF", fontSize: 13, marginTop: 4 },
  filterRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  chipActive: { backgroundColor: "#EC4899", borderColor: "#EC4899" },
  chipText: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#1F1A2E" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#F0EAFC", marginBottom: 12 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  langTag: { flexDirection: "row", alignItems: "center", gap: 6 },
  flag: { fontSize: 18 },
  kind: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "rgba(139,92,246,0.2)", borderRadius: 999 },
  kindText: { color: "#6B6585", fontSize: 9, fontWeight: "700" },
  src: { color: "#6B6585", fontSize: 14, lineHeight: 20 },
  divider: { height: 1, backgroundColor: "#F0EAFC", marginVertical: 10 },
  trans: { color: "#1F1A2E", fontSize: 15, lineHeight: 22, fontWeight: "500" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "flex-end" },
  actBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  empty: { paddingTop: 80, alignItems: "center", gap: 12 },
  emptyText: { color: "#9CA3AF", textAlign: "center" },
});
