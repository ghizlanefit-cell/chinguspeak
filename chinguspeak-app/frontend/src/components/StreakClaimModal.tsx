import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  visible: boolean;
  streakDays: number;
  reward: number;
  loading: boolean;
  onClaim: () => void;
  onClose: () => void;
};

export default function StreakClaimModal({ visible, streakDays, reward, loading, onClaim, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay} testID="streak-modal-overlay">
        <View style={styles.card} testID="streak-modal-card">
          <TouchableOpacity testID="streak-modal-close" style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color="#6B6585" />
          </TouchableOpacity>

          <Text style={styles.title}>Daily Streak Bonus 🔥</Text>
          <Text style={styles.sub} testID="streak-days-text">Current streak: {streakDays} day{streakDays === 1 ? "" : "s"}</Text>

          <LinearGradient colors={["#F59E0B", "#F97316"]} style={styles.rewardWrap}>
            <Text style={styles.rewardText} testID="streak-reward-text">Claim +{reward} credits</Text>
          </LinearGradient>

          <TouchableOpacity
            testID="streak-claim-button"
            style={[styles.claimBtn, loading && { opacity: 0.55 }]}
            onPress={onClaim}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.claimText}>Claim now</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20,16,32,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEE7FB",
  },
  closeBtn: {
    alignSelf: "flex-end",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F4FF",
  },
  title: { color: "#1F1A2E", fontSize: 20, fontWeight: "900", marginTop: 4 },
  sub: { color: "#6B6585", fontSize: 13, marginTop: 6 },
  rewardWrap: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  rewardText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  claimBtn: {
    marginTop: 14,
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  claimText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
