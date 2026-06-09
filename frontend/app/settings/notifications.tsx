import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

import { usePrefs, loadPrefs, setRemindDaily, setRemindSmart, setRemindTime } from "@/src/state/prefs";

export default function Notifications() {
  const router = useRouter();
  const prefs = usePrefs();
  const [showPicker, setShowPicker] = React.useState(false);
  React.useEffect(() => { loadPrefs(); }, []);

  const [h, m] = prefs.remindTime.split(":").map((x) => parseInt(x, 10));
  const formatted = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;

  const onTimeChange = (_: any, selected?: Date) => {
    if (Platform.OS !== "ios") setShowPicker(false);
    if (selected) {
      const hh = String(selected.getHours()).padStart(2, "0");
      const mm = String(selected.getMinutes()).padStart(2, "0");
      setRemindTime(`${hh}:${mm}`);
    }
  };

  const now = new Date(); now.setHours(h || 17); now.setMinutes(m || 0);

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="notif-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Daily practice reminders</Text>
                <Text style={styles.rowSub}>One nudge a day to keep the streak</Text>
              </View>
              <Switch testID="toggle-daily" value={prefs.remindDaily} onValueChange={setRemindDaily} trackColor={{ true: "#5B7CFA", false: "#3a3454" }} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Smart scheduling</Text>
                <Text style={styles.rowSub}>Pick the best moment for you</Text>
              </View>
              <Switch testID="toggle-smart" value={prefs.remindSmart} onValueChange={setRemindSmart} trackColor={{ true: "#5B7CFA", false: "#3a3454" }} />
            </View>
            <View style={styles.divider} />
            <TouchableOpacity testID="reminder-time" style={styles.row} onPress={() => setShowPicker(true)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Reminder time</Text>
              </View>
              <View style={styles.timeChip}>
                <Text style={styles.timeText}>{formatted}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePicker value={now} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={onTimeChange} />
          )}
          {Platform.OS === "ios" && showPicker && (
            <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.doneBtn}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          )}
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
  card: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  rowTitle: { color: "#1F1A2E", fontSize: 14, fontWeight: "600" },
  rowSub: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  divider: { height: 1, backgroundColor: "#FFFFFF" },
  timeChip: { backgroundColor: "rgba(91,124,250,0.18)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  timeText: { color: "#B5C5FF", fontWeight: "700", fontSize: 13 },
  doneBtn: { alignSelf: "flex-end", marginTop: 8, padding: 12 },
  doneText: { color: "#5B7CFA", fontWeight: "700" },
});
