import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  loading: boolean;
  onReward: () => void;
  testIDPrefix?: string;
};

export default function RewardedCreditsCard({ loading, onReward, testIDPrefix = "rewarded" }: Props) {
  return (
    <View style={styles.card} testID={`${testIDPrefix}-card`}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="play-circle" size={20} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Rewarded Video</Text>
          <Text style={styles.sub}>Watch one ad and earn +5 credits instantly.</Text>
        </View>
      </View>

      <TouchableOpacity
        testID={`${testIDPrefix}-watch-button`}
        onPress={onReward}
        disabled={loading}
        activeOpacity={0.85}
        style={{ opacity: loading ? 0.55 : 1, marginTop: 12 }}
      >
        <LinearGradient colors={["#F59E0B", "#F97316"]} style={styles.cta}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="gift" size={16} color="#fff" />
              <Text style={styles.ctaText}>Watch & Earn +5</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0EAFC",
    borderRadius: 18,
    padding: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.13)",
  },
  title: { color: "#1F1A2E", fontSize: 14, fontWeight: "800" },
  sub: { color: "#6B6585", fontSize: 12, marginTop: 2 },
  cta: {
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
  },
  ctaText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
