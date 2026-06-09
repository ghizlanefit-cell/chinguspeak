import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";

function FloatingMic() {
  const router = useRouter();
  return (
    <TouchableOpacity
      testID="floating-mic-button"
      activeOpacity={0.85}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push("/(tabs)/voice");
      }}
      style={styles.micWrap}
    >
      <LinearGradient colors={theme.gradient.primaryHot as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mic}>
        <Ionicons name="mic" size={28} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: "#A39AB8",
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 12),
          height: 68,
          paddingBottom: 8,
          paddingTop: 10,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: theme.primary,
          shadowOpacity: 0.18,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 14,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index"     options={{ title: "Home",      tabBarIcon: ({ color }) => <Ionicons name="home"   size={22} color={color} /> }} />
      <Tabs.Screen name="translate" options={{ title: "Translate", tabBarIcon: ({ color }) => <Feather  name="globe"  size={22} color={color} /> }} />
      <Tabs.Screen name="voice"     options={{ title: "", tabBarIcon: () => <View style={{ width: 1, height: 1 }} />, tabBarButton: () => <FloatingMic />, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="saved"     options={{ title: "Saved",     tabBarIcon: ({ color }) => <Ionicons name="bookmark" size={22} color={color} /> }} />
      <Tabs.Screen name="profile"   options={{ title: "Profile",   tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={24} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  micWrap: { top: -26, alignItems: "center", justifyContent: "center", flex: 1 },
  mic: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: theme.accent,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
});
