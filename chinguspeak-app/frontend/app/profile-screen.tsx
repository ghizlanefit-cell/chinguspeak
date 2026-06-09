import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import LanguageBar from "@/src/components/LanguageBar";
import { usePrefs, swapLangs, loadPrefs, setUser, setUserAvatar } from "@/src/state/prefs";
import { getLanguage } from "@/src/constants/languages";
import { chinguBotAvatar } from "@/src/theme";
import CreditsPill from "@/src/components/CreditsPill";

export default function ProfileScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const prefs = usePrefs();
  const [aboutTaps, setAboutTaps] = React.useState(0);
  React.useEffect(() => { loadPrefs(); }, []);
  const from = getLanguage(prefs.from); const to = getLanguage(prefs.to);
  const onAbout = () => {
    const n = aboutTaps + 1; setAboutTaps(n);
    if (n >= 7) { setAboutTaps(0); router.push(prefs.adminToken ? "/admin" : "/admin-login"); return; }
    setTimeout(() => setAboutTaps(0), 2000);
  };
  const signedIn = !!prefs.userToken;
  const displayName = prefs.userName || (signedIn ? prefs.userEmail : "Chingu Guest");
  const scoped = React.useCallback((path: string) => {
    if (!pathname?.startsWith("/mobile")) return path;
    if (path.startsWith("/mobile")) return path;
    return `/mobile${path}`;
  }, [pathname]);

  const pickAvatar = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await setUserAvatar(result.assets[0].uri);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Profile</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <CreditsPill credits={prefs.credits} testID="profile-credits-pill" onPress={() => router.push(scoped("/paywall") as any)} />
            <TouchableOpacity testID="settings-button" onPress={() => router.push(scoped("/settings") as any)} style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={20} color="#1F1A2E" />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <LinearGradient colors={["#EC4899", "#8B5CF6"]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
            <TouchableOpacity testID="profile-avatar-picker" onPress={pickAvatar} activeOpacity={0.85}>
              <Image source={prefs.userAvatar ? { uri: prefs.userAvatar } : chinguBotAvatar} style={styles.heroAvatar} />
              <View style={styles.editBadge}><Feather name="edit-2" size={12} color="#1F1A2E" /></View>
            </TouchableOpacity>
            <Text style={styles.heroName}>{displayName}</Text>
            <Text style={styles.heroSub}>{prefs.isPro ? "✨ Pro · Talking to the world" : "Talking to the world ✨"}</Text>
            <View style={styles.statRow}>
              <View style={styles.statBox}><Text style={styles.statNum}>{from.flag}</Text><Text style={styles.statLabel}>FROM</Text></View>
              <View style={styles.statBox}><Text style={styles.statNum}>{to.flag}</Text><Text style={styles.statLabel}>TO</Text></View>
              <View style={styles.statBox}><Text testID="profile-credits-text" style={styles.statNum}>{prefs.credits}</Text><Text style={styles.statLabel}>CREDITS</Text></View>
            </View>
          </View>

          {/* Auth block */}
          {signedIn ? (
            <TouchableOpacity testID="profile-signout" onPress={() => setUser(null, null, null)} style={styles.authCard}>
              <Feather name="log-out" size={18} color="#F472B6" />
              <Text style={styles.authText}>Sign Out</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity testID="profile-signin" onPress={() => router.push(scoped("/auth") as any)} style={styles.authCard}>
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={styles.authText}>Sign In or Create Account</Text>
              <Feather name="chevron-right" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          {/* Upgrade */}
          <TouchableOpacity testID="profile-upgrade" onPress={() => router.push(scoped("/paywall") as any)} style={styles.upgradeWrap} activeOpacity={0.9}>
            <LinearGradient colors={prefs.isPro ? ["#10B981", "#34D399"] : ["#EC4899", "#8B5CF6"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.upgrade}>
              <Text style={styles.upgradeText}>{prefs.isPro ? "👑 You're a Pro Member" : "✨ Upgrade to Chingu Speak Pro ✨"}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.section}>Default Languages</Text>
          <View style={styles.card}><LanguageBar fromCode={prefs.from} toCode={prefs.to} onSwap={swapLangs} /></View>

          <Text style={styles.section}>Quick Links</Text>
          <View style={styles.linkCard}>
            {[
              { icon: "chatbubbles" as const, label: "Chat with Chingu", route: "/chat", color: "#EC4899" },
              { icon: "camera" as const, label: "Scan & Translate", route: "/camera", color: "#8B5CF6" },
              { icon: "bookmark" as const, label: "Saved Translations", route: "/(tabs)/saved", color: "#3B82F6" },
              { icon: "options" as const, label: "Preferences", route: "/settings/preferences", color: "#10B981" },
              { icon: "trophy" as const, label: "Your Level", route: "/settings/level", color: "#FFC857" },
              { icon: "globe" as const, label: "App Language", route: "/settings/app-language", color: "#FF8FA3" },
              { icon: "notifications" as const, label: "Notifications", route: "/settings/notifications", color: "#5B7CFA" },
            ].map((row, i) => (
              <TouchableOpacity key={row.label} testID={`profile-link-${row.icon}`} onPress={() => router.push(scoped(row.route) as any)} style={[styles.linkRow, i > 0 && styles.linkBorder]} activeOpacity={0.7}>
                <View style={[styles.linkIcon, { backgroundColor: row.color + "22", borderColor: row.color + "55" }]}>
                  <Ionicons name={row.icon} size={18} color={row.color} />
                </View>
                <Text style={styles.linkText}>{row.label}</Text>
                <Feather name="chevron-right" size={18} color="#6B6585" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity testID="profile-about" onPress={onAbout} style={styles.aboutLine}>
            <Text style={styles.aboutText}>About · v1.0</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE2FA" },
  title: { color: "#1F1A2E", fontSize: 26, fontWeight: "800" },
  heroCard: { borderRadius: 24, padding: 22, overflow: "hidden", alignItems: "center", marginBottom: 24 },
  heroAvatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: "rgba(255,255,255,0.5)" },
  editBadge: { position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EAE2FA" },
  heroName: { color: "#1F1A2E", fontSize: 20, fontWeight: "800", marginTop: 12 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4 },
  statRow: { flexDirection: "row", justifyContent: "space-around", width: "100%", marginTop: 20 },
  statBox: { alignItems: "center", flex: 1 },
  statNum: { color: "#1F1A2E", fontSize: 24, fontWeight: "800" },
  statLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "700", marginTop: 4, letterSpacing: 1 },
  authCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, marginBottom: 16, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  authText: { color: "#1F1A2E", fontSize: 15, fontWeight: "700", flex: 1 },
  upgradeWrap: { marginBottom: 24 },
  upgrade: { paddingVertical: 16, borderRadius: 18, alignItems: "center" },
  upgradeText: { color: "#1F1A2E", fontWeight: "800", fontSize: 14 },
  section: { color: "#1F1A2E", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#F0EAFC", marginBottom: 24 },
  linkCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#F0EAFC", marginBottom: 24, overflow: "hidden" },
  linkRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 14 },
  linkBorder: { borderTopWidth: 1, borderTopColor: "#FFFFFF" },
  linkIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  linkText: { color: "#1F1A2E", fontSize: 15, fontWeight: "600", flex: 1 },
  aboutLine: { alignItems: "center", padding: 12 },
  aboutText: { color: "#6B6585", fontSize: 12 },
});
