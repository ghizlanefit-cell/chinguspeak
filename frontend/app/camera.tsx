import React from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";

import LanguageBar from "@/src/components/LanguageBar";
import { api } from "@/src/api/client";
import { bumpStreak, loadPrefs, swapLangs, usePrefs, setCredits } from "@/src/state/prefs";

export default function CameraTranslateScreen() {
  const router = useRouter();
  const prefs = usePrefs();

  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [detectedText, setDetectedText] = React.useState("");
  const [translatedText, setTranslatedText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadPrefs();
  }, []);

  const pickFromGallery = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission denied.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setImageUri(result.assets[0].uri);
    setDetectedText("");
    setTranslatedText("");
  };

  const takePhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission denied.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setImageUri(result.assets[0].uri);
    setDetectedText("");
    setTranslatedText("");
  };

  const runTranslation = async () => {
    if (!imageUri || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: "base64" as any,
      });
      const res = await api.translateImage({
        image_base64: imageBase64,
        target_lang: prefs.to,
        app_locale: prefs.appLang,
      });
      if (typeof (res as any).credits === "number") await setCredits((res as any).credits);
      setDetectedText((res.extracted_text || "").trim());
      setTranslatedText((res.translated_text || "").trim());
      if ((res.translated_text || "").trim()) {
        try {
          await api.saveHistory({
            kind: "image",
            source_text: (res.extracted_text || "").trim() || "[image text]",
            translated_text: (res.translated_text || "").trim(),
            source_lang: prefs.from,
            target_lang: prefs.to,
          });
          bumpStreak();
        } catch {
          // non-blocking
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to translate image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF", "#F5F1FF"]} style={StyleSheet.absoluteFill} />

      <SafeAreaView edges={["top"]} style={{ flex: 1, paddingHorizontal: 20 }}>
        <View style={styles.header}>
          <TouchableOpacity
            testID="camera-back-button"
            onPress={() => router.back()}
            style={styles.iconBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={22} color="#1F1A2E" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Camera Translate</Text>
            <Text style={styles.subtitle}>Take a photo or pick one, then translate text instantly.</Text>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <LanguageBar fromCode={prefs.from} toCode={prefs.to} onSwap={swapLangs} />
        </View>

        <View style={styles.previewCard}>
          {imageUri ? (
            <Image
              testID="camera-preview-image"
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.previewEmpty}>
              <Ionicons name="camera-outline" size={34} color="#9CA3AF" />
              <Text style={styles.emptyText}>No image selected yet</Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            testID="camera-take-photo-button"
            style={styles.actionBtn}
            onPress={takePhoto}
            activeOpacity={0.85}
          >
            <Ionicons name="camera" size={18} color="#1F1A2E" />
            <Text style={styles.actionText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="camera-pick-gallery-button"
            style={styles.actionBtn}
            onPress={pickFromGallery}
            activeOpacity={0.85}
          >
            <Ionicons name="images" size={18} color="#1F1A2E" />
            <Text style={styles.actionText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="camera-translate-button"
          onPress={runTranslation}
          disabled={!imageUri || loading}
          style={{ opacity: !imageUri || loading ? 0.55 : 1 }}
          activeOpacity={0.85}
        >
          <LinearGradient colors={["#EC4899", "#8B5CF6"]} style={styles.translateBtn}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.translateText}>Translate Image</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {!!error && (
          <Text testID="camera-error-text" style={styles.errorText}>
            {error}
          </Text>
        )}

        {!!detectedText && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>EXTRACTED TEXT</Text>
            <Text testID="camera-extracted-text" style={styles.resultText}>
              {detectedText}
            </Text>
          </View>
        )}

        {!!translatedText && (
          <View style={styles.resultCardHot}>
            <Text style={styles.resultLabelHot}>TRANSLATION</Text>
            <Text testID="camera-translated-text" style={styles.resultText}>
              {translatedText}
            </Text>
          </View>
        )}

        <View style={{ height: 110 }} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EAE2FA",
  },
  title: { color: "#1F1A2E", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  previewCard: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#F0EAFC",
    minHeight: 230,
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: 260, backgroundColor: "#FFFFFF" },
  previewEmpty: { minHeight: 230, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE2FA",
    borderRadius: 14,
    paddingVertical: 12,
  },
  actionText: { color: "#1F1A2E", fontSize: 13, fontWeight: "700" },
  translateBtn: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  translateText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  errorText: { color: "#EF4444", marginTop: 10, fontSize: 12, fontWeight: "600" },
  resultCard: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE2FA",
    borderRadius: 16,
    padding: 14,
  },
  resultCardHot: {
    marginTop: 10,
    backgroundColor: "rgba(255, 46, 147, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 46, 147, 0.22)",
    borderRadius: 16,
    padding: 14,
  },
  resultLabel: { color: "#6B6585", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  resultLabelHot: { color: "#EC4899", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  resultText: { color: "#1F1A2E", fontSize: 15, lineHeight: 22 },
});
