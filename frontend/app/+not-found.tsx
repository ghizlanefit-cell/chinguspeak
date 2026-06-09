import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { usePathname, useRouter } from "expo-router";

export default function NotFoundScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const [redirecting, setRedirecting] = React.useState(false);

  React.useEffect(() => {
    const rawPath = (typeof window !== "undefined" ? window.location.pathname : pathname) || "";
    if (!rawPath.startsWith("/mobile")) return;
    const stripped = (rawPath.replace(/^\/mobile/, "") || "/").replace(/\/$/, "") || "/";
    setRedirecting(true);
    const t = setTimeout(() => {
      router.replace(stripped as any);
    }, 0);
    return () => clearTimeout(t);
  }, [pathname, router]);

  if (redirecting) {
    return (
      <View style={styles.container}>
        <Text testID="not-found-redirecting-text" style={styles.title}>Redirecting…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.sub}>This route does not exist.</Text>
      <TouchableOpacity
        testID="not-found-home-button"
        onPress={() => router.replace("/")}
        style={styles.button}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Go home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F1FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: { color: "#1F1A2E", fontSize: 24, fontWeight: "800" },
  sub: { color: "#6B6585", fontSize: 14, marginTop: 8, textAlign: "center" },
  button: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
