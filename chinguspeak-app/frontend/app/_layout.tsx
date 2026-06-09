import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { api } from "@/src/api/client";
import { loadPrefs, usePrefs, setCredits } from "@/src/state/prefs";
import { useMonetizationSync } from "@/src/hooks/use-monetization-sync";
import StreakClaimModal from "@/src/components/StreakClaimModal";

SplashScreen.preventAutoHideAsync();

// Keep-alive interval: 4 minutes. Combined with an external uptime monitor
// hitting /api/ping, this prevents Emergent / Render-style platforms from
// idling the backend container.
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const prefs = usePrefs();
  const [showStreak, setShowStreak] = useState(false);
  const [streakLoading, setStreakLoading] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [streakReward, setStreakReward] = useState(5);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  useEffect(() => {
    loadPrefs();
  }, []);

  useMonetizationSync(prefs.userToken);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!prefs.userToken) {
        setShowStreak(false);
        return;
      }
      try {
        const status = await api.streakStatus(prefs.userToken);
        if (!active) return;
        setStreakDays(status.streak_days || 0);
        setStreakReward(status.next_reward || 5);
        setShowStreak(!!status.can_claim_today);
      } catch {
        if (!active) return;
        setShowStreak(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [prefs.userToken]);

  const claimStreak = async () => {
    if (!prefs.userToken) return;
    try {
      setStreakLoading(true);
      const claim = await api.streakClaim(prefs.userToken);
      await setCredits(claim.credits || 0);
      setStreakDays(claim.streak_days || 0);
      setShowStreak(false);
    } catch {
      setShowStreak(false);
    } finally {
      setStreakLoading(false);
    }
  };

  // Background keep-alive while app is in foreground.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let mounted = true;

    const pingNow = () => {
      api.ping().catch(() => {
        /* silently ignore network errors */
      });
    };

    const startTimer = () => {
      if (timer) return;
      pingNow();
      timer = setInterval(pingNow, KEEPALIVE_INTERVAL_MS);
    };
    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    // Always start ticking
    startTimer();

    // Pause on background (mobile only — web has no AppState change)
    const handle = (state: AppStateStatus) => {
      if (!mounted) return;
      if (state === "active") startTimer();
      else stopTimer();
    };
    const sub = Platform.OS !== "web" ? AppState.addEventListener("change", handle) : null;

    return () => {
      mounted = false;
      stopTimer();
      sub?.remove?.();
    };
  }, []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F5F1FF" } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="camera" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="language-picker" options={{ presentation: "modal" }} />
            <Stack.Screen name="settings" />
            <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
            <Stack.Screen name="admin-login" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="auth" options={{ presentation: "modal" }} />
            <Stack.Screen name="translate-screen" />
            <Stack.Screen name="voice-screen" />
            <Stack.Screen name="saved-screen" />
            <Stack.Screen name="profile-screen" />
          </Stack>
          <StreakClaimModal
            visible={showStreak}
            streakDays={streakDays}
            reward={streakReward}
            loading={streakLoading}
            onClaim={claimStreak}
            onClose={() => setShowStreak(false)}
          />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
