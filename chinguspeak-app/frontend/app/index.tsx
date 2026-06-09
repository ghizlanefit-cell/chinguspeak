import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { theme, chinguMascot } from "@/src/theme";

const { width } = Dimensions.get("window");

const ORBITING_FLAGS = ["🇰🇷", "🇲🇦", "🇺🇸", "🇫🇷", "🇨🇳", "🇪🇸", "🇯🇵", "🇮🇳"];

function OrbitingFlag({ index, total }: { index: number; total: number }) {
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 22000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress]);

  const radius = width * 0.34;
  const baseAngle = (index / total) * Math.PI * 2;

  const style = useAnimatedStyle(() => {
    const angle = baseAngle + progress.value * Math.PI * 2;
    return {
      transform: [
        { translateX: Math.cos(angle) * radius },
        { translateY: Math.sin(angle) * radius },
      ],
    };
  });

  return (
    <Animated.View style={[styles.flagBubble, style]}>
      <Text style={styles.flagText}>{ORBITING_FLAGS[index]}</Text>
    </Animated.View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const nextRoot = pathname?.startsWith("/mobile") ? "/mobile/(tabs)" : "/(tabs)";

  return (
    <View style={styles.root}>
      {/* Soft lavender wash — same as home for continuity */}
      <LinearGradient
        colors={["#EDE4FF", "#F5F1FF", "#FFFFFF"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* gentle purple glow behind mascot */}
      <View style={styles.glow} pointerEvents="none">
        <LinearGradient
          colors={["rgba(167,139,250,0.45)", "rgba(236,72,153,0.20)", "transparent"]}
          style={styles.glowInner}
        />
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.heroWrap}>
          <View style={styles.orbContainer}>
            <Image source={chinguMascot} style={styles.orbImage} resizeMode="contain" />
            {ORBITING_FLAGS.map((_, i) => (
              <OrbitingFlag key={i} index={i} total={ORBITING_FLAGS.length} />
            ))}
          </View>
        </View>

        <View style={styles.bottomContent}>
          <Text style={styles.brandWord}>
            <Text style={styles.brandChingu}>chingu </Text>
            <Text style={styles.brandSpeak}>speak</Text>
          </Text>
          <Text style={styles.title}>
            Talk to the world,{"\n"}
            <Text style={styles.titleAccent}>your way.</Text>
          </Text>
          <Text style={styles.subtitle}>
            Chat, translate, speak & learn — your AI friend Chingu makes any language feel like home.
          </Text>

          <TouchableOpacity
            testID="get-started-button"
            activeOpacity={0.85}
            onPress={() => router.replace(nextRoot as any)}
          >
            <LinearGradient
              colors={theme.gradient.primaryHot as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            testID="skip-onboarding-button"
            onPress={() => router.replace(nextRoot as any)}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Explore the app</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  glow: { position: "absolute", top: -60, left: -80, right: -80, height: 520 },
  glowInner: { flex: 1, borderRadius: 999 },
  safe: { flex: 1, paddingHorizontal: 24 },
  heroWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  orbContainer: {
    width: width * 0.7,
    height: width * 0.7,
    alignItems: "center",
    justifyContent: "center",
  },
  orbImage: {
    width: width * 0.6,
    height: width * 0.6,
  },
  flagBubble: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.primary,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  flagText: { fontSize: 26 },
  bottomContent: { paddingBottom: 8 },
  brandWord: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 4 },
  brandChingu: { color: theme.text },
  brandSpeak: { color: theme.accent },
  title: { color: theme.text, fontSize: 36, fontWeight: "900", lineHeight: 40, letterSpacing: -0.8, marginTop: 6 },
  titleAccent: { color: theme.primary },
  subtitle: {
    color: theme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 24,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 999,
    gap: 10,
    shadowColor: theme.primary,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },
  secondary: { alignItems: "center", marginTop: 16 },
  secondaryText: { color: theme.textMuted, fontSize: 14, fontWeight: "600" },
});
