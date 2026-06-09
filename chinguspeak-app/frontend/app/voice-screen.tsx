import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, AudioModule, RecordingPresets } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api/client";
import { usePrefs, swapLangs, loadPrefs, bumpStreak, setCredits } from "@/src/state/prefs";
import { chinguIdleMascot, chinguActiveMascot, heartIcon, theme } from "@/src/theme";

// Preview-only short-circuit: when running the Emergent web preview with
// EXPO_PUBLIC_MOCK_API=1, there is no real microphone device available, so we
// skip the expo-audio recorder calls and just drive the mocked pipeline with
// simulated timing. Native iOS/Android prod builds never hit this branch.
const MOCK_WEB = process.env.EXPO_PUBLIC_MOCK_API === "1" && Platform.OS === "web";

// Pingo-style waveform bars: each bar pulses on a different rhythm by
// interpolating the same 0→1 listeningPulse value through different curves,
// so the bars feel "alive" without needing 7 separate Animated.Value loops.
const WAVEFORM_BARS: { input: number[]; output: number[] }[] = [
  { input: [0, 0.25, 0.5, 0.75, 1],  output: [0.35, 1.0, 0.5, 0.85, 0.35] },
  { input: [0, 0.2,  0.45, 0.7, 1],  output: [0.65, 0.35, 1.0, 0.45, 0.65] },
  { input: [0, 0.15, 0.4,  0.65, 1], output: [0.45, 0.95, 0.4, 1.0, 0.45] },
  { input: [0, 0.3,  0.55, 0.8, 1],  output: [1.0,  0.45, 0.9, 0.4, 1.0] },
  { input: [0, 0.2,  0.5,  0.75, 1], output: [0.55, 0.85, 0.4, 0.95, 0.55] },
  { input: [0, 0.25, 0.55, 0.85, 1], output: [0.4,  1.0, 0.5, 0.7,  0.4] },
  { input: [0, 0.15, 0.45, 0.7, 1],  output: [0.7,  0.4, 0.95, 0.45, 0.7] },
];

// VAD silence threshold (dBFS) and required quiet window for auto-stop on native.
const SILENCE_DBFS = -45;
const SILENCE_HOLD_MS = 2500;
// On web preview there's no real recorder, so we simulate end-of-utterance
// after a short listening window instead.
const MOCK_LISTEN_MS = 1800;

export default function VoiceScreen() {
  const prefs = usePrefs();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 200);

  const [sessionActive, setSessionActive] = React.useState(false);
  const [stage, setStage] = React.useState<"idle" | "recording" | "processing" | "done">("idle");
  const [transcript, setTranscript] = React.useState("");
  const [translated, setTranslated] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [audioUri, setAudioUri] = React.useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [showResultSheet, setShowResultSheet] = React.useState(false);

  const sessionActiveRef = React.useRef(false);
  const stageRef = React.useRef<typeof stage>("idle");
  const silenceSinceRef = React.useRef<number | null>(null);
  const autoStoppedRef = React.useRef(false);
  const mockListenTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasSpeakingRef = React.useRef(false);

  const pulseScale = React.useRef(new Animated.Value(1)).current;
  const pulseY = React.useRef(new Animated.Value(0)).current;
  const listeningPulse = React.useRef(new Animated.Value(0)).current;
  const sheetY = React.useRef(new Animated.Value(280)).current;
  const sessionGlow = React.useRef(new Animated.Value(0)).current;
  const pulseLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const listeningLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

  // Keep refs in sync with state — used by async callbacks (auto-restart, VAD).
  React.useEffect(() => { sessionActiveRef.current = sessionActive; }, [sessionActive]);
  React.useEffect(() => { stageRef.current = stage; }, [stage]);

  React.useEffect(() => { loadPrefs(); }, []);

  // Poll the audio player so we can pivot mascot state on TTS playback.
  React.useEffect(() => {
    const id = setInterval(() => {
      const playing = Boolean((player as any)?.playing);
      setIsSpeaking(playing);
    }, 200);
    return () => clearInterval(id);
  }, [player]);

  // Mascot pulse loop only while Chingu is actively speaking.
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

  // Auto-restart listening when Chingu finishes speaking (the heart of the
  // continuous ChatGPT-style loop). Triggers only when the session is still
  // active and we just transitioned from playing → not-playing.
  React.useEffect(() => {
    const wasSpeaking = wasSpeakingRef.current;
    wasSpeakingRef.current = isSpeaking;
    if (wasSpeaking && !isSpeaking && sessionActiveRef.current) {
      // Tiny gap so the player teardown completes before we open the mic again.
      setTimeout(() => {
        if (sessionActiveRef.current && stageRef.current !== "recording") start();
      }, 250);
    }
  }, [isSpeaking]);

  // Start audio playback once the TTS URI is set.
  React.useEffect(() => {
    if (audioUri && player) {
      player.seekTo(0);
      player.play();
      setIsSpeaking(true);
    }
  }, [audioUri, player]);

  // Animated listening rings + waveform driver.
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

  // Soft session-active glow behind the mascot.
  React.useEffect(() => {
    Animated.timing(sessionGlow, {
      toValue: sessionActive ? 1 : 0,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [sessionActive, sessionGlow]);

  // Slide the result sheet on translation update.
  React.useEffect(() => {
    if (translated.trim()) {
      setShowResultSheet(true);
      Animated.timing(sheetY, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    } else if (!sessionActive && !transcript.trim()) {
      setShowResultSheet(false);
      Animated.timing(sheetY, { toValue: 280, duration: 220, useNativeDriver: true }).start();
    }
  }, [translated, sessionActive, transcript, sheetY]);

  // ─────────── Lifecycle helpers ───────────
  const clearMockListenTimer = () => {
    if (mockListenTimerRef.current) {
      clearTimeout(mockListenTimerRef.current);
      mockListenTimerRef.current = null;
    }
  };

  const start = React.useCallback(async () => {
    try {
      setError(null);
      if (!MOCK_WEB) {
        const s = await AudioModule.requestRecordingPermissionsAsync();
        if (!s.granted) {
          setError("Microphone permission denied.");
          setSessionActive(false);
          return;
        }
        await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      setStage("recording");
      silenceSinceRef.current = null;
      autoStoppedRef.current = false;
      // Reset per-turn fields but keep the previous translation visible in the
      // sheet so the user can still read it while the next turn is captured.
      setTranscript("");
      setTranslated("");
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Web mock: simulate VAD by auto-stopping after a short listening window.
      if (MOCK_WEB) {
        clearMockListenTimer();
        mockListenTimerRef.current = setTimeout(() => {
          if (sessionActiveRef.current && stageRef.current === "recording") stop();
        }, MOCK_LISTEN_MS);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to start voice input.");
      setSessionActive(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder]);

  const stop = React.useCallback(async () => {
    clearMockListenTimer();
    try {
      setStage("processing");
      let b64 = "";
      let mime = "audio/mp4";
      if (!MOCK_WEB) {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) {
          // Lost the recording → reset back into listening if the session is alive.
          if (sessionActiveRef.current) start();
          else setStage("idle");
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
        // Silent / empty turn → if session is still active, listen again.
        if (sessionActiveRef.current) start();
        else setStage("idle");
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
      // Continuous loop ALWAYS plays the spoken reply, regardless of the
      // autoVoiceReply preference, because the loop closes on audio-end.
      try {
        const t = await api.tts({ text: tr.translated_text, target_lang: prefs.to, app_locale: prefs.appLang });
        if (typeof (t as any).credits === "number") await setCredits((t as any).credits);
        setAudioUri(`data:${t.mime};base64,${t.audio_base64}`);
      } catch {
        setError("Could not play audio reply.");
        // Audio failed — still try to keep the session alive.
        if (sessionActiveRef.current) setTimeout(() => { if (sessionActiveRef.current) start(); }, 600);
      }
      setStage("done");
    } catch (e: any) {
      setError(e?.message || "Voice processing failed.");
      setStage("idle");
      setSessionActive(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder, prefs.from, prefs.to, prefs.appLang]);

  // Native VAD: while listening with an active session, watch the meter and
  // auto-stop after SILENCE_HOLD_MS of sustained quiet.
  React.useEffect(() => {
    if (MOCK_WEB) return;
    if (!sessionActive || stage !== "recording") {
      silenceSinceRef.current = null;
      autoStoppedRef.current = false;
      return;
    }
    const metering = recorderState?.metering;
    if (typeof metering !== "number") return;
    const isSilent = metering < SILENCE_DBFS;
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
    if (silentMs >= SILENCE_HOLD_MS && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      stop();
    }
  }, [sessionActive, stage, recorderState?.metering, stop]);

  const endSession = React.useCallback(async () => {
    setSessionActive(false);
    clearMockListenTimer();
    try {
      if (!MOCK_WEB && stageRef.current === "recording") await recorder.stop();
    } catch {
      // ignore
    }
    try { player?.pause?.(); } catch { /* noop */ }
    setStage("idle");
    setIsSpeaking(false);
  }, [recorder, player]);

  const onMascotTap = React.useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (sessionActiveRef.current) {
      endSession();
    } else {
      setSessionActive(true);
      // Kick off the first listening turn.
      start();
    }
  }, [endSession, start]);

  React.useEffect(() => {
    return () => {
      clearMockListenTimer();
      try { recorder.stop(); } catch { /* noop */ }
      try { player?.pause?.(); } catch { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recording = stage === "recording";
  const processing = stage === "processing";
  const ringScaleA = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringScaleB = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] });
  const ringOpacityA = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const ringOpacityB = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] });
  const glowOpacity = sessionGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
  const glowScale = sessionGlow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.1] });

  const statusText = !sessionActive
    ? "Tap Chingu to start the live chat"
    : recording
      ? "Listening... talk to me 👂"
      : processing
        ? "Cooking up a reply..."
        : isSpeaking
          ? "Chingu is roasting you..."
          : "Your turn — go on";

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="voice-back-button" style={styles.topIcon} onPress={endSession}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Live Voice Chat</Text>
          <TouchableOpacity testID="voice-swap-langs" style={styles.topIcon} onPress={swapLangs}>
            <Ionicons name="swap-horizontal" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.centerArea}>
          {/* Soft halo that breathes only while the session is active */}
          <Animated.View
            pointerEvents="none"
            style={[styles.sessionGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
          />

          {recording && (
            <>
              <Animated.View style={[styles.waveRing, { transform: [{ scale: ringScaleA }], opacity: ringOpacityA }]} />
              <Animated.View style={[styles.waveRingSoft, { transform: [{ scale: ringScaleB }], opacity: ringOpacityB }]} />
            </>
          )}

          <TouchableOpacity
            testID={sessionActive ? "voice-mascot-stop" : "voice-mascot-start"}
            activeOpacity={0.85}
            onPress={onMascotTap}
            accessibilityRole="button"
            accessibilityLabel={sessionActive ? "End live voice chat" : "Start live voice chat"}
          >
            <Animated.View
              style={{ transform: [{ scale: pulseScale }, { translateY: pulseY }] }}
              testID="voice-main-mascot"
            >
              <Image source={isSpeaking ? chinguActiveMascot : chinguIdleMascot} style={styles.mainMascot} />
            </Animated.View>
          </TouchableOpacity>

          {recording && (
            <View style={styles.waveformRow} testID="voice-waveform">
              {WAVEFORM_BARS.map((bar, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      transform: [
                        {
                          scaleY: listeningPulse.interpolate({
                            inputRange: bar.input,
                            outputRange: bar.output,
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          )}

          <Text style={styles.statusText} testID="voice-status-text">{statusText}</Text>
          {sessionActive ? (
            <Text style={styles.hintText} testID="voice-hint-text">Tap Chingu again to end</Text>
          ) : null}
        </View>

        {(showResultSheet || transcript.trim() || translated.trim()) ? (
          <Animated.View style={[styles.resultSheet, { transform: [{ translateY: sheetY }] }]} testID="voice-result-sheet">
            <View style={styles.resultHandle} />
            <View style={styles.resultHeader}>
              <Image source={heartIcon} style={styles.heartIcon} />
              <Text style={styles.resultTitle}>CHINGU TRANSLATION RESULT</Text>
            </View>
            {transcript.trim() ? (
              <View style={styles.transcriptBlock} testID="voice-transcript-block">
                <Text style={styles.transcriptLabel}>YOU SAID</Text>
                <Text style={styles.transcriptText} testID="voice-transcript-text">{transcript}</Text>
              </View>
            ) : null}
            <Text style={styles.resultBody} testID="voice-result-text">
              {translated || transcript || "Your translated result will appear here."}
            </Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F1FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EFE8FC",
  },
  title: { color: "#1F1A2E", fontSize: 22, fontWeight: "900" },
  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sessionGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#F3EBFF",
  },
  waveRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: "rgba(236,72,153,0.45)",
  },
  waveRingSoft: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.35)",
  },
  mainMascot: { width: 220, height: 220, resizeMode: "contain" },
  statusText: {
    color: "#1F1A2E",
    fontSize: 15,
    marginTop: 14,
    textAlign: "center",
    fontWeight: "800",
  },
  hintText: {
    color: "#8B7AA6",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "600",
  },
  resultSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FAF6FF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: "#EFE8FC",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
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
  resultBody: { color: "#1F1A2E", fontSize: 18, lineHeight: 26, marginTop: 6, fontWeight: "700" },
  transcriptBlock: {
    marginTop: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EFE8FC",
  },
  transcriptLabel: {
    color: "#A78BFA",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  transcriptText: {
    color: "#6B6585",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    fontWeight: "500",
  },
  waveformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
    height: 44,
  },
  waveBar: {
    width: 5,
    height: 40,
    borderRadius: 3,
    backgroundColor: "#EC4899",
  },
  error: { color: "#EF4444", marginTop: 10, fontSize: 12, fontWeight: "700" },
});
