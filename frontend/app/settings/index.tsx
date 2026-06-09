import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";

import { usePrefs, loadPrefs, setUser, setIsPro } from "@/src/state/prefs";
import { api } from "@/src/api/client";
import { getAppLang } from "@/src/constants/app-data";
import { chinguBotAvatar } from "@/src/theme";

export default function Settings() {
  const router = useRouter();
  const pathname = usePathname();
  const prefs = usePrefs();
  const [aboutTaps, setAboutTaps] = React.useState(0);
  React.useEffect(() => { loadPrefs(); }, []);

  const appLang = getAppLang(prefs.appLang);
  const signedIn = !!prefs.userToken;
  const accountSub = signedIn ? (prefs.userEmail || "Signed in") : "Guest account";
  const displayName = prefs.userName || (signedIn ? (prefs.userEmail?.split("@")[0] || "Chingu Learner") : "Chingu Learner");
  const scoped = React.useCallback((path: string) => {
    if (!pathname?.startsWith("/mobile")) return path;
    if (path.startsWith("/mobile")) return path;
    return `/mobile${path}`;
  }, [pathname]);

  const onAboutPress = () => {
    const n = aboutTaps + 1;
    setAboutTaps(n);
    if (n >= 7) {
      setAboutTaps(0);
      router.push(scoped(prefs.adminToken ? "/admin" : "/admin-login") as any);
    }
    setTimeout(() => setAboutTaps(0), 2000);
  };

  const onSignOut = () => {
    if (!signedIn) {
      router.push(scoped("/auth") as any);
      return;
    }
    Alert.alert(
      "Sign Out",
      "Sign out of your Chingu Speak account? Your local history stays on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await setUser(null, null, null);
          },
        },
      ],
    );
  };

  const onDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and removes your data from our servers. This action cannot be undone. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAccount(prefs.userToken);
            } catch {
              /* ignore network errors — still clear locally */
            }
            await setUser(null, null, null);
            await setIsPro(false);
            router.replace(scoped("/(tabs)") as any);
            setTimeout(() => {
              Alert.alert("Account Deleted", "Your account has been deleted. You can keep using Chingu Speak as a guest.");
            }, 300);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="settings-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#1F1A2E" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Account */}
          <TouchableOpacity testID="settings-account" style={styles.accountCard} activeOpacity={0.85} onPress={() => signedIn ? null : router.push(scoped("/auth") as any)}>
            <View style={styles.avatar}>
              <Image source={prefs.userAvatar ? { uri: prefs.userAvatar } : chinguBotAvatar} style={{ width: 48, height: 48, borderRadius: 24 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{displayName}</Text>
              <Text style={styles.accountSub}>{accountSub}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#6B6585" />
          </TouchableOpacity>

          {/* Upgrade */}
          <TouchableOpacity
            testID="settings-upgrade"
            activeOpacity={0.9}
            onPress={() => router.push(scoped("/paywall") as any)}
            style={styles.upgradeWrap}
          >
            <LinearGradient colors={["#5B7CFA", "#4F6CE8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upgrade}>
              <Text style={styles.upgradeText}>✨ Upgrade to Chingu Speak Pro ✨</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Core options */}
          <View style={styles.section}>
            <SettingRow icon="sliders" label="Preferences" onPress={() => router.push(scoped("/settings/preferences") as any)} testID="settings-preferences" />
            <SettingRow icon="bell" label="Notifications" onPress={() => router.push(scoped("/settings/notifications") as any)} testID="settings-notifications" />
            <SettingRow icon="globe" label="App Language" trailing={appLang.english} onPress={() => router.push(scoped("/settings/app-language") as any)} testID="settings-app-language" />
          </View>

          {/* Support */}
          <View style={styles.section}>
            <TouchableOpacity testID="settings-about" onPress={onAboutPress} style={styles.row} activeOpacity={0.7}>
              <View style={styles.iconWrap}><Feather name="info" size={18} color="#6B6585" /></View>
              <Text style={styles.rowLabel}>About</Text>
              <Feather name="chevron-right" size={18} color="#6B6585" />
            </TouchableOpacity>
            <SettingRow icon="heart" label="Love Chingu Speak? Rate Us ❤️" onPress={() => Linking.openURL("https://play.google.com/store").catch(() => {})} testID="settings-rate" />
            <SettingRow icon="help-circle" label="Help Center" onPress={() => Linking.openURL("https://support.chingu.example").catch(() => {})} testID="settings-help" />
            <SettingRow icon="mail" label="Contact Support" onPress={() => Linking.openURL("mailto:support@chingu.example").catch(() => {})} testID="settings-contact" />
          </View>

          {/* Sign out */}
          <View style={styles.section}>
            <SettingRow icon={signedIn ? "log-out" : "log-in"} label={signedIn ? "Sign Out" : "Sign In or Create Account"} onPress={onSignOut} testID="settings-signout" />
          </View>

          {/* Legal */}
          <View style={styles.legalRow}>
            <TouchableOpacity testID="settings-privacy" onPress={() => Linking.openURL("https://chingu.example/privacy").catch(() => {})}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity testID="settings-terms" onPress={() => Linking.openURL("https://chingu.example/terms").catch(() => {})}>
              <Text style={styles.legalLink}>Terms of Service</Text>
            </TouchableOpacity>
          </View>

          {/* Delete account */}
          <TouchableOpacity testID="settings-delete-account" style={styles.deleteRow} activeOpacity={0.7} onPress={onDeleteAccount}>
            <MaterialIcons name="delete-forever" size={20} color="#EF4444" />
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SettingRow({ icon, label, trailing, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.row} activeOpacity={0.7}>
      <View style={styles.iconWrap}><Feather name={icon} size={18} color="#6B6585" /></View>
      <Text style={styles.rowLabel}>{label}</Text>
      {trailing && <Text style={styles.rowTrailing}>{trailing}</Text>}
      <Feather name="chevron-right" size={18} color="#6B6585" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE2FA" },
  title: { color: "#1F1A2E", fontSize: 18, fontWeight: "700" },
  accountCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#F0EAFC", marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  accountName: { color: "#1F1A2E", fontSize: 15, fontWeight: "700" },
  accountSub: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  upgradeWrap: { marginBottom: 24 },
  upgrade: { paddingVertical: 18, borderRadius: 18, alignItems: "center", shadowColor: "#5B7CFA", shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
  upgradeText: { color: "#1F1A2E", fontWeight: "800", fontSize: 15 },
  section: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#F0EAFC", marginBottom: 16, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: "#F3EEF9" },
  iconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  rowLabel: { flex: 1, color: "#1F1A2E", fontSize: 14, fontWeight: "600" },
  rowTrailing: { color: "#9CA3AF", fontSize: 13 },
  legalRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginVertical: 16 },
  legalLink: { color: "#9CA3AF", fontSize: 12, textDecorationLine: "underline" },
  legalDot: { color: "#9CA3AF", fontSize: 12 },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, marginTop: 4 },
  deleteText: { color: "#EF4444", fontSize: 14, fontWeight: "700" },
});
