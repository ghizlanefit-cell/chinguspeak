import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, AudioModule, RecordingPresets } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api/client";
import { usePrefs, swapLangs, loadPrefs, bumpStreak, setCredits } from "@/src/state/prefs";
import { chinguIdleMascot, chinguActiveMascot, heartIcon } from "@/src/theme";

// Preview-only short-circuit: when running the Emergent web preview with
// EXPO_PUBLIC_MOCK_API=1, there is no real microphone device available, so we
// skip the expo-audio recorder calls and just drive the mocked pipeline with
// simulated timing. Native iOS/Android prod builds never hit this branch.
const MOCK_WEB = process.env.EXPO_PUBLIC_MOCK_API === "1" && Platform.OS === "web";

export default function VoiceScreen() {
  const prefs = usePrefs();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 200);
  const [stage, setStage] = React.useState<"idle" | "recording" | "processing" | "done">("idle");
  const [transcript, setTranscript] = React.useState("");
  const [translated, setTranslated] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [audioUri, setAudioUri] = React.useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [showResultSheet, setShowResultSheet] = React.useState(false);
  const silenceSinceRef = React.useRef<number | null>(null);
  const autoStoppedRef = React.useRef(false);
  const pulseScale = React.useRef(new Animated.Value(1)).current;
  const pulseY = React.useRef(new Animated.Value(0)).current;
  const listeningPulse = React.useRef(new Animated.Value(0)).current;
  const sheetY = React.useRef(new Animated.Value(280)).current;
  const pulseLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const listeningLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

  React.useEffect(() => {
    loadPrefs();
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => {
      const playing = Boolean((player as any)?.playing);
      setIsSpeaking(playing);
    }, 200);
    return () => clearInterval(id);
  }, [player]);

  React.useEffect(() => {
    if (isSpeaking) {
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseScale, { toValue: 1.05, duration: 550, useNativeDriver: true }),
            Animated.timing(pulseScale, { toValue: 1, duration: 550, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(pulseY, { toValue: -6, duration: 550, useNativeDriver: true }),
            Animated.timing(pulseY, { toValue: 0, duration: 550, useNativeDriver: true }),
          ]),
        ]),
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      Animated.parallel([
        Animated.timing(pulseScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(pulseY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [isSpeaking, pulseScale, pulseY]);

  React.useEffect(() => {
    if (audioUri && player) {
      player.seekTo(0);
      player.play();
      setIsSpeaking(true);
    }
  }, [audioUri, player]);

  React.useEffect(() => {
    const isListening = stage === "recording";
    if (isListening) {
      listeningLoopRef.current?.stop();
      listeningPulse.setValue(0);
      listeningLoopRef.current = Animated.loop(
        Animated.timing(listeningPulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      );
      listeningLoopRef.current.start();
    } else {
      listeningLoopRef.current?.stop();
      listeningPulse.setValue(0);
    }
  }, [stage, listeningPulse]);

  React.useEffect(() => {
    if (translated.trim()) {
      setShowResultSheet(true);
      Animated.timing(sheetY, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    } else {
      setShowResultSheet(false);
      Animated.timing(sheetY, { toValue: 280, duration: 220, useNativeDriver: true }).start();
    }
  }, [translated, sheetY]);

  const start = async () => {
    try {
      setError(null);
      if (!MOCK_WEB) {
        const s = await AudioModule.requestRecordingPermissionsAsync();
        if (!s.granted) {
          setError("Microphone permission denied.");
          return;
        }
        await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      setStage("recording");
      setTranscript("");
      setTranslated("");
      setShowResultSheet(false);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      setError(e?.message || "Failed to start voice input.");
    }
  };

  const stop = React.useCallback(async () => {
    try {
      setStage("processing");
      let b64 = "";
      let mime = "audio/mp4";
      if (!MOCK_WEB) {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) {
          setError("No recording captured.");
          setStage("idle");
          return;
        }
        try {
          b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" as any });
        } catch (e) {
          if (process.env.EXPO_PUBLIC_MOCK_API !== "1") throw e;
        }
        mime = uri.toLowerCase().endsWith(".m4a") ? "audio/m4a" : "audio/mp4";
      }
      const stt = await api.transcribe({
        audio_base64: b64,
        mime_type: mime,
        language: prefs.from !== "auto" ? prefs.from : undefined,
        app_locale: prefs.appLang,
      });
      if (typeof (stt as any).credits === "number") await setCredits((stt as any).credits);
      setTranscript(stt.text || "");
      if (!stt.text?.trim()) {
        setStage("done");
        return;
      }

      const tr = await api.translate({
        text: stt.text,
        source_lang: prefs.from,
        target_lang: prefs.to,
        app_locale: prefs.appLang,
      });
      if (typeof (tr as any).credits === "number") await setCredits((tr as any).credits);
      setTranslated(tr.translated_text);
      try {
        await api.saveHistory({
          kind: "voice",
          source_text: stt.text,
          translated_text: tr.translated_text,
          source_lang: prefs.from,
          target_lang: prefs.to,
        });
        bumpStreak();
      } catch {
        // non-blocking
      }
      if (prefs.autoVoiceReply && tr.translated_text?.trim()) {
        try {
          const t = await api.tts({ text: tr.translated_text, target_lang: prefs.to, app_locale: prefs.appLang });
          if (typeof (t as any).credits === "number") await setCredits((t as any).credits);
          setAudioUri(`data:${t.mime};base64,${t.audio_base64}`);
        } catch {
          setError("Could not play audio reply.");
        }
      }
      setStage("done");
    } catch (e: any) {
      setError(e?.message || "Voice processing failed.");
      setStage("idle");
    }
  }, [recorder, prefs.from, prefs.to, prefs.autoVoiceReply, prefs.appLang]);

  React.useEffect(() => {
    if (!prefs.handsFree || stage !== "recording") {
      silenceSinceRef.current = null;
      autoStoppedRef.current = false;
      return;
    }
    const metering = recorderState?.metering;
    if (typeof metering !== "number") return;
    const isSilent = metering < -45;
    if (!isSilent) {
      silenceSinceRef.current = null;
      autoStoppedRef.current = false;
      return;
    }
    if (silenceSinceRef.current === null) {
      silenceSinceRef.current = Date.now();
      return;
    }
    const silentMs = Date.now() - silenceSinceRef.current;
    if (silentMs >= 3000 && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      stop();
    }
  }, [prefs.handsFree, stage, recorderState?.metering, stop]);

  const replay = async () => {
    if (audioUri && player) {
      player.seekTo(0);
      player.play();
      return;
    }
    if (!translated.trim()) return;
    try {
      const t = await api.tts({ text: translated, target_lang: prefs.to, app_locale: prefs.appLang });
      if (typeof (t as any).credits === "number") await setCredits((t as any).credits);
      setAudioUri(`data:${t.mime};base64,${t.audio_base64}`);
    } catch {
      setError("Unable to replay audio.");
    }
  };

  const reset = () => {
    setStage("idle");
    setTranscript("");
    setTranslated("");
    setAudioUri(null);
    setError(null);
    setShowResultSheet(false);
    setIsSpeaking(false);
  };

  const recording = stage === "recording";
  const processing = stage === "processing";
  const done = stage === "done";
  const ringScaleA = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringScaleB = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] });
  const ringOpacityA = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const ringOpacityB = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] });

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#090712", "#131020", "#201537"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="voice-back-button" style={styles.topIcon} onPress={() => reset()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Live Voice Chat</Text>
          <TouchableOpacity testID="voice-swap-langs" style={styles.topIcon} onPress={swapLangs}>
            <Ionicons name="swap-horizontal" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.centerArea}>
          {recording && (
            <>
              <Animated.View style={[styles.waveRing, { transform: [{ scale: ringScaleA }], opacity: ringOpacityA }]} />
              <Animated.View style={[styles.waveRingSoft, { transform: [{ scale: ringScaleB }], opacity: ringOpacityB }]} />
            </>
          )}

          <Animated.View
            style={{ transform: [{ scale: pulseScale }, { translateY: pulseY }] }}
            testID="voice-main-mascot"
          >
            <Image source={isSpeaking ? chinguActiveMascot : chinguIdleMascot} style={styles.mainMascot} />
          </Animated.View>

          <Text style={styles.statusText} testID="voice-status-text">
            {recording
              ? "Listening with Deepgram Nova-2..."
              : processing
                ? "Processing speech..."
                : isSpeaking
                  ? "Chingu is speaking..."
                  : done
                    ? "Voice cycle complete"
                    : "Tap mic to start immersive voice mode"}
          </Text>
        </View>

        <View style={styles.controls}>
          {done ? (
            <>
              <TouchableOpacity testID="voice-replay-button" style={styles.actionBtn} onPress={replay}>
                <Ionicons name="play" size={18} color="#D7CCFF" />
                <Text style={styles.actionText}>Replay</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="voice-new-button" style={styles.actionBtn} onPress={reset}>
                <Ionicons name="refresh" size={18} color="#D7CCFF" />
                <Text style={styles.actionText}>New</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              testID={recording ? "voice-stop-button" : "voice-start-button"}
              activeOpacity={0.9}
              onPress={recording ? stop : start}
              disabled={processing}
            >
              <LinearGradient colors={recording ? ["#EF4444", "#F97316"] : ["#8B5CF6", "#EC4899"]} style={styles.mainMic}>
                {processing ? <ActivityIndicator color="#fff" size="large" /> : <Ionicons name={recording ? "stop" : "mic"} size={42} color="#fff" />}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <Animated.View style={[styles.resultSheet, { transform: [{ translateY: sheetY }] }]} testID="voice-result-sheet">
          <View style={styles.resultHandle} />
          <View style={styles.resultHeader}>
            <Image source={heartIcon} style={styles.heartIcon} />
            <Text style={styles.resultTitle}>CHINGU TRANSLATION RESULT</Text>
          </View>
          <Text style={styles.resultBody} testID="voice-result-text">{translated || transcript || "Your translated result appears here."}</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#090712" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "900" },
  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  waveRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "rgba(236,72,153,0.65)",
  },
  waveRingSoft: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.45)",
  },
  mainMascot: { width: 210, height: 210, resizeMode: "contain" },
  statusText: {
    color: "#E8DEFF",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
    fontWeight: "700",
  },
  controls: {
    paddingBottom: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  mainMic: {
    width: 98,
    height: 98,
    borderRadius: 49,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EC4899",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  actionBtn: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionText: { color: "#EADFFF", fontSize: 13, fontWeight: "800" },
  resultSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: "#EFE8FC",
  },
  resultHandle: {
    alignSelf: "center",
    width: 64,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E6DFFC",
    marginBottom: 10,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  heartIcon: { width: 24, height: 24, resizeMode: "contain" },
  resultTitle: { color: "#8B5CF6", fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  resultBody: { color: "#1F1A2E", fontSize: 16, lineHeight: 24, marginTop: 10, fontWeight: "600" },
  error: { color: "#EF4444", marginTop: 10, fontSize: 12, fontWeight: "700" },
});
