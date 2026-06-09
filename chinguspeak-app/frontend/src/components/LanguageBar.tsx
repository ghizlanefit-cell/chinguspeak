import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getLanguage } from "@/src/constants/languages";

type Props = {
  fromCode: string;
  toCode: string;
  onSwap?: () => void;
  fromTestId?: string;
  toTestId?: string;
};

export default function LanguageBar({ fromCode, toCode, onSwap, fromTestId, toTestId }: Props) {
  const router = useRouter();
  const from = getLanguage(fromCode);
  const to = getLanguage(toCode);

  const open = (slot: "from" | "to") => {
    router.push({ pathname: "/language-picker", params: { slot } });
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        testID={fromTestId || "lang-from-selector"}
        style={styles.pill}
        onPress={() => open("from")}
        activeOpacity={0.85}
      >
        <Text style={styles.flag}>{from.flag}</Text>
        <Text style={styles.label} numberOfLines={1}>{from.name}</Text>
        <Ionicons name="chevron-down" size={14} color="#6B6585" />
      </TouchableOpacity>

      {onSwap ? (
        <TouchableOpacity testID="lang-swap-button" onPress={onSwap} style={styles.swap}>
          <LinearGradient colors={["#FF2E93", "#8B5CF6"]} style={styles.swapInner}>
            <Ionicons name="swap-horizontal" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={18} color="#9CA3AF" />
        </View>
      )}

      <TouchableOpacity
        testID={toTestId || "lang-to-selector"}
        style={styles.pill}
        onPress={() => open("to")}
        activeOpacity={0.85}
      >
        <Text style={styles.flag}>{to.flag}</Text>
        <Text style={styles.label} numberOfLines={1}>{to.name}</Text>
        <Ionicons name="chevron-down" size={14} color="#6B6585" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE5FD",
  },
  flag: { fontSize: 20 },
  label: { color: "#1F1A2E", fontSize: 13, fontWeight: "600", flex: 1 },
  swap: { width: 40, height: 40, borderRadius: 20, overflow: "hidden" },
  swapInner: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  arrow: { width: 32, alignItems: "center" },
});
