import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { setAdminToken, loadPrefs } from "@/src/state/prefs";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { loadPrefs(); }, []);

  const onLogin = async () => {
    setError(null); setLoading(true);
    try {
      const res = await api.adminLogin({ username, password });
      await setAdminToken(res.access_token);
      router.replace("/admin");
    } catch (e: any) {
      setError(e?.message?.includes("423") ? "Locked. Try again in 5 minutes." : "Invalid credentials");
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, padding: 20 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity testID="admin-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Access</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.card}>
          <View style={styles.lockIcon}><Ionicons name="lock-closed" size={26} color="#5B7CFA" /></View>
          <Text style={styles.cardTitle}>Hidden Admin Panel</Text>
          <Text style={styles.cardSub}>Authorized personnel only.</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput testID="admin-username" style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" placeholderTextColor="#5a5070" />

          <Text style={styles.label}>Password</Text>
          <TextInput testID="admin-password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="password" placeholderTextColor="#5a5070" />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity testID="admin-login-btn" onPress={onLogin} disabled={loading || !username || !password} activeOpacity={0.85} style={{ opacity: loading || !username || !password ? 0.5 : 1 }}>
            <LinearGradient colors={["#5B7CFA", "#8B5CF6"]} style={styles.cta}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Sign in</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  title: { color: "#1F1A2E", fontSize: 18, fontWeight: "700" },
  card: { marginTop: 32, padding: 24, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 22, borderWidth: 1, borderColor: "#F0EAFC" },
  lockIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(91,124,250,0.15)", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 12, borderWidth: 1, borderColor: "rgba(91,124,250,0.4)" },
  cardTitle: { color: "#1F1A2E", fontSize: 20, fontWeight: "800", textAlign: "center" },
  cardSub: { color: "#9CA3AF", fontSize: 13, textAlign: "center", marginTop: 4, marginBottom: 22 },
  label: { color: "#9CA3AF", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#1F1A2E", fontSize: 15 },
  error: { color: "#FCA5A5", marginTop: 12, textAlign: "center", fontSize: 13 },
  cta: { paddingVertical: 16, borderRadius: 999, alignItems: "center", marginTop: 20 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
