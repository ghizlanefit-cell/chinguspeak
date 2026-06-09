import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { api } from "@/src/api/client";
import { setUser } from "@/src/state/prefs";

export default function Auth() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false); const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null); setLoading(true);
    try {
      const res = mode === "login" ? await api.login({ email, password }) : await api.register({ email, password });
      await setUser(res.access_token, res.user.email, res.user.name || null, {
        credits: res.user.credits,
        isPro: !!res.user.is_pro,
      });
      router.replace("/(tabs)/profile");
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("409")) setError("Email already registered. Try login.");
      else if (msg.includes("401")) setError("Wrong email or password.");
      else if (msg.includes("400")) setError("Password must be at least 6 chars.");
      else setError("Something went wrong. Try again.");
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="auth-back" onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color="#1F1A2E" /></TouchableOpacity>
          <Text style={styles.title}>{mode === "login" ? "Sign In" : "Create Account"}</Text>
          <View style={{ width: 38 }} />
        </View>
        <KeyboardAwareScrollView bottomOffset={120} contentContainerStyle={{ padding: 20 }}>
          <View style={styles.tabs}>
            <TouchableOpacity testID="auth-tab-login" onPress={() => setMode("login")} style={[styles.tab, mode === "login" && styles.tabActive]}><Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>Login</Text></TouchableOpacity>
            <TouchableOpacity testID="auth-tab-register" onPress={() => setMode("register")} style={[styles.tab, mode === "register" && styles.tabActive]}><Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>Register</Text></TouchableOpacity>
          </View>

          <Text style={styles.label}>EMAIL</Text>
          <TextInput testID="auth-email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor="#5a5070" style={styles.input} />
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput testID="auth-password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" placeholderTextColor="#5a5070" style={styles.input} />
          {mode === "register" && (
            <>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput
                testID="auth-confirm-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Repeat your password"
                placeholderTextColor="#5a5070"
                style={styles.input}
              />
            </>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            testID="auth-submit"
            onPress={submit}
            disabled={loading || !email || !password || (mode === "register" && !confirmPassword)}
            activeOpacity={0.85}
            style={{ marginTop: 24, opacity: loading || !email || !password || (mode === "register" && !confirmPassword) ? 0.5 : 1 }}
          >
            <LinearGradient colors={["#EC4899", "#8B5CF6"]} style={styles.cta}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{mode === "login" ? "Sign In" : "Create Account"}</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity testID="auth-continue-guest" onPress={() => router.back()} style={styles.guest}>
            <Text style={styles.guestText}>Continue as Guest</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE2FA" },
  title: { color: "#1F1A2E", fontSize: 18, fontWeight: "700" },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 24, backgroundColor: "#FFFFFF", padding: 4, borderRadius: 999 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 999 },
  tabActive: { backgroundColor: "#EC4899" },
  tabText: { color: "#9CA3AF", fontWeight: "700" },
  tabTextActive: { color: "#1F1A2E" },
  label: { color: "#9CA3AF", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#1F1A2E", fontSize: 15 },
  error: { color: "#FCA5A5", marginTop: 14, textAlign: "center", fontSize: 13 },
  cta: { paddingVertical: 16, borderRadius: 999, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  guest: { alignItems: "center", marginTop: 18 },
  guestText: { color: "#9CA3AF", fontSize: 13 },
});
