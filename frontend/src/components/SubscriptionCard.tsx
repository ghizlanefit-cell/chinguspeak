import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  productId: string | null;
  loading: boolean;
  onSubscribe: () => void;
};

export default function SubscriptionCard({ productId, loading, onSubscribe }: Props) {
  return (
    <View style={styles.card} testID="subscription-card">
      <View style={styles.row}>
        <Ionicons name="diamond" size={18} color="#8B5CF6" />
        <Text style={styles.title}>Google Play Subscription</Text>
      </View>
      <Text style={styles.sub}>
        Unlock unlimited usage and skip credit deductions with Pro.
      </Text>
      <Text style={styles.meta} testID="subscription-product-id-text">
        Product: {productId || "Not configured yet"}
      </Text>

      <TouchableOpacity
        testID="subscription-start-button"
        disabled={loading || !productId}
        onPress={onSubscribe}
        activeOpacity={0.85}
        style={{ opacity: loading || !productId ? 0.55 : 1, marginTop: 12 }}
      >
        <LinearGradient colors={["#8B5CF6", "#EC4899"]} style={styles.cta}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="logo-google-playstore" size={15} color="#fff" />
              <Text style={styles.ctaText}>Continue with Google Play</Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#1F1A2E", fontSize: 14, fontWeight: "800" },
  sub: { color: "#6B6585", fontSize: 12, marginTop: 5 },
  meta: { color: "#9CA3AF", fontSize: 11, marginTop: 7 },
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
