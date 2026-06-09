import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  credits: number;
  onPress?: () => void;
  testID?: string;
};

export default function CreditsPill({ credits, onPress, testID }: Props) {
  return (
    <TouchableOpacity
      testID={testID || "credits-pill"}
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.pill}
    >
      <View style={styles.dot} />
      <Ionicons name="flash" size={13} color="#A78BFA" />
      <Text style={styles.text}>{credits}</Text>
      <Text style={styles.sub}>credits</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F0EAFC",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  text: {
    color: "#1F1A2E",
    fontSize: 12,
    fontWeight: "800",
  },
  sub: {
    color: "#6B6585",
    fontSize: 10,
    fontWeight: "600",
  },
});
