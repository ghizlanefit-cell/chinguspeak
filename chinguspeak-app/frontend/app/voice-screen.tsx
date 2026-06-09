import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  Animated,
  ScrollView,
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
// interpolating the same 0→1 listeningPulse value through different curves.
const WAVEFORM_BARS: { input: number[]; output: number[] }[] = [
  { input: [0, 0.25, 0.5, 0.75, 1],  output: [0.35, 1.0, 0.5, 0.85, 0.35] },
  { input: [0, 0.2,  0.45, 0.7, 1],  output: [0.65, 0.35, 1.0, 0.45, 0.65] },
  { input: [0, 0.15, 0.4,  0.65, 1], output: [0.45, 0.95, 0.4, 1.0, 0.45] },
  { input: [0, 0.3,  0.55, 0.8, 1],  output: [1.0,  0.45, 0.9, 0.4, 1.0] },
  { input: [0, 0.2,  0.5,  0.75, 1], output: [0.55, 0.85, 0.4, 0.95, 0.55] },
  { input: [0, 0.25, 0.55, 0.85, 1], output: [0.4,  1.0, 0.5, 0.7,  0.4] },
  { input: [0, 0.15, 0.45, 0.7, 1],  output: [0.7,  0.4, 0.95, 0.45, 0.7] },
];

// Three thinking dots — each bouncing on a different phase of the same loop.
const THINKING_DOTS: { input: number[]; output: number[] }[] = [
  { input: [0, 0.25, 0.5, 0.75, 1], output: [0, -10, 0, -4, 0] },
  { input: [0, 0.25, 0.5, 0.75, 1], output: [0, -4, -10, 0, 0] },
  { input: [0, 0.25, 0.5, 0.75, 1], output: [0, 0, -4, -10, 0] },
];

const SILENCE_DBFS = -45;
const SILENCE_HOLD_MS = 2500;
const MOCK_LISTEN_MS = 1800;
const MAX_LOG_TURNS = 8;
const VISIBLE_LOG_TURNS = 3;

type Turn = { id: string; user: string; chingu: string; ts: number };

export default function VoiceScreen() {
  const prefs = usePrefs();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 200);

  const [sessionActive, setSessionActive] = React.useState(false);
  const [stage, setStage] = React.useState<"idle" | "recording" | "processing" | "done">("idle");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [audioUri, setAudioUri] = React.useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const sessionIdRef = React.useRef<string>("");
  const sessionActiveRef = React.useRef(false);
  const stageRef = React.useRef<typeof stage>("idle");
  const silenceSinceRef = React.useRef<number | null>(null);
  const autoStoppedRef = React.useRef(false);
  const mockListenTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasSpeakingRef = React.useRef(false);
  const logScrollRef = React.useRef<ScrollView | null>(null);

  const pulseScale = React.useRef(new Animated.Value(1)).current;
  const pulseY = React.useRef(new Animated.Value(0)).current;
  const listeningPulse = React.useRef(new Animated.Value(0)).current;
  const thinkingPulse = React.useRef(new Animated.Value(0)).current;
  const sessionGlow = React.useRef(new Animated.Value(0)).current;
  const pulseLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const listeningLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const thinkingLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

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

  // Auto-restart listening when Chingu finishes speaking (continuous loop).
  React.useEffect(() => {
    const wasSpeaking = wasSpeakingRef.current;
    wasSpeakingRef.current = isSpeaking;
    if (wasSpeaking && !isSpeaking && sessionActiveRef.current) {
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

  // Listening rings + waveform driver.
  React.useEffect(() => {
    if (stage === "recording") {
      listeningLoopRef.current?.stop();
      listeningPulse.setValue(0);
      listeningLoopRef.current = Animated.loop(
        Animated.timing(listeningPulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      );
      listeningLoopRef.current.start();
    } else {
      listeningLoopRef.current?.stop();
      listeningPulse.setValue(0);
    }
  }, [stage, listeningPulse]);

  // Thinking-dots loop runs only during the processing stage.
  React.useEffect(() => {
    if (stage === "processing") {
      thinkingLoopRef.current?.stop();
      thinkingPulse.setValue(0);
      thinkingLoopRef.current = Animated.loop(
        Animated.timing(thinkingPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      );
      thinkingLoopRef.current.start();
    } else {
      thinkingLoopRef.current?.stop();
      thinkingPulse.setValue(0);
    }
  }, [stage, thinkingPulse]);

  // Soft session-active glow behind the mascot.
  React.useEffect(() => {
    Animated.timing(sessionGlow, {
      toValue: sessionActive ? 1 : 0,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [sessionActive, sessionGlow]);

  // Auto-scroll the chat log to the bottom whenever a new turn lands.
  React.useEffect(() => {
    if (turns.length > 0) {
      // Defer to next frame so the new row is laid out before we scroll.
      setTimeout(() => logScrollRef.current?.scrollToEnd?.({ animated: true }), 50);
    }
  }, [turns.length]);

  // ────────────────── Lifecycle helpers ──────────────────
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
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      const userText = (stt.text || "").trim();
      if (!userText) {
        if (sessionActiveRef.current) start();
        else setStage("idle");
        return;
      }

      // Conversational turn — Chingu replies in the practice language with the
      // chaotic Pingo persona (configured in src/api/mocks.ts + php-backend).
      const chat = await api.chat({
        session_id: sessionIdRef.current,
        message: userText,
        practice_lang: prefs.to,
        teach_style: "roast",
        app_locale: prefs.appLang,
      });
      if (typeof (chat as any).credits === "number") await setCredits((chat as any).credits);
      const chinguText = (chat.reply || "").trim();

      // Record turn into the rolling log (capped at MAX_LOG_TURNS).
      setTurns(prev => {
        const next = [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, user: userText, chingu: chinguText, ts: Date.now() }];
        return next.length > MAX_LOG_TURNS ? next.slice(next.length - MAX_LOG_TURNS) : next;
      });

      try {
        await api.saveHistory({
          kind: "voice",
          source_text: userText,
          translated_text: chinguText,
          source_lang: prefs.from,
          target_lang: prefs.to,
        });
        bumpStreak();
      } catch {
        // non-blocking
      }

      try {
        const t = await api.tts({ text: chinguText, target_lang: prefs.to, app_locale: prefs.appLang });
        if (typeof (t as any).credits === "number") await setCredits((t as any).credits);
        setAudioUri(`data:${t.mime};base64,${t.audio_base64}`);
      } catch {
        setError("Could not play audio reply.");
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

  // Native VAD: while listening with an active session, watch the meter.
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
    } catch { /* ignore */ }
    try { player?.pause?.(); } catch { /* noop */ }
    setStage("idle");
    setIsSpeaking(false);
  }, [recorder, player]);

  const onMascotTap = React.useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (sessionActiveRef.current) {
      endSession();
    } else {
      sessionIdRef.current = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setSessionActive(true);
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
        ? "Chingu is thinking..."
        : isSpeaking
          ? "Chingu is roasting you..."
          : "Your turn — go on!";

  const showSheet = sessionActive || turns.length > 0;

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

          {/* Listening waveform — shown only while the mic is hot */}
          {recording && (
            <View style={styles.waveformRow} testID="voice-waveform">
              {WAVEFORM_BARS.map((bar, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      transform: [{
                        scaleY: listeningPulse.interpolate({ inputRange: bar.input, outputRange: bar.output }),
                      }],
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Thinking dots — bridge the gap between user stop and TTS start */}
          {processing && (
            <View style={styles.thinkingRow} testID="voice-thinking-dots">
              {THINKING_DOTS.map((d, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.thinkingDot,
                    {
                      transform: [{
                        translateY: thinkingPulse.interpolate({ inputRange: d.input, outputRange: d.output }),
                      }],
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

        {showSheet ? (
          <View style={styles.resultSheet} testID="voice-result-sheet">
            <View style={styles.resultHandle} />
            <View style={styles.resultHeader}>
              <Image source={heartIcon} style={styles.heartIcon} />
              <Text style={styles.resultTitle}>CHINGU LIVE CHAT</Text>
              {turns.length > 0 && (
                <Text style={styles.turnCount} testID="voice-turn-count">{turns.length} TURN{turns.length === 1 ? "" : "S"}</Text>
              )}
            </View>

            {turns.length === 0 ? (
              <Text style={styles.emptyHint} testID="voice-empty-hint">
                Say something to Chingu — the conversation log will show up here.
              </Text>
            ) : (
              <ScrollView
                ref={logScrollRef}
                style={styles.logScroll}
                contentContainerStyle={styles.logContent}
                showsVerticalScrollIndicator={false}
                testID="voice-chat-log"
              >
                {turns.slice(-VISIBLE_LOG_TURNS).map((t) => (
                  <View key={t.id} style={styles.turnBlock} testID={`voice-turn-${t.id}`}>
                    <View style={styles.turnRow}>
                      <Text style={styles.turnLabelUser}>YOU SAID</Text>
                      <Text style={styles.turnTextUser}>{t.user}</Text>
                    </View>
                    <View style={[styles.turnRow, { marginTop: 6 }]}>
                      <Text style={styles.turnLabelChingu}>CHINGU</Text>
                      <Text style={styles.turnTextChingu}>{t.chingu}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}
          </View>
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F5F1FF",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#EFE8FC",
  },
  title: { color: "#1F1A2E", fontSize: 22, fontWeight: "900" },
  centerArea: { flex: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  sessionGlow: {
    position: "absolute", width: 320, height: 320, borderRadius: 160,
    backgroundColor: "#F3EBFF",
  },
  waveRing: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    borderWidth: 2, borderColor: "rgba(236,72,153,0.45)",
  },
  waveRingSoft: {
    position: "absolute", width: 250, height: 250, borderRadius: 125,
    borderWidth: 2, borderColor: "rgba(139,92,246,0.35)",
  },
  mainMascot: { width: 220, height: 220, resizeMode: "contain" },

  statusText: { color: "#1F1A2E", fontSize: 15, marginTop: 14, textAlign: "center", fontWeight: "800" },
  hintText: { color: "#8B7AA6", fontSize: 12, marginTop: 4, textAlign: "center", fontWeight: "600" },

  waveformRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 18, height: 44,
  },
  waveBar: { width: 5, height: 40, borderRadius: 3, backgroundColor: "#EC4899" },

  thinkingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, marginTop: 18, height: 24,
  },
  thinkingDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#8B5CF6",
  },

  resultSheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: "#FAF6FF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28,
    borderWidth: 1, borderColor: "#EFE8FC",
    shadowColor: "#7C3AED", shadowOpacity: 0.12, shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 }, elevation: 10,
    maxHeight: 320,
  },
  resultHandle: {
    alignSelf: "center", width: 64, height: 5, borderRadius: 3,
    backgroundColor: "#E6DFFC", marginBottom: 10,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  heartIcon: { width: 24, height: 24, resizeMode: "contain" },
  resultTitle: { color: "#8B5CF6", fontSize: 12, fontWeight: "900", letterSpacing: 0.4, flex: 1 },
  turnCount: {
    color: "#A78BFA", fontSize: 10, fontWeight: "900", letterSpacing: 0.6,
    backgroundColor: "#F0E8FF", borderRadius: 999,
    paddingVertical: 3, paddingHorizontal: 8,
  },

  emptyHint: {
    color: "#8B7AA6", fontStyle: "italic", fontSize: 13,
    paddingVertical: 10, fontWeight: "500",
  },

  logScroll: { flexGrow: 0, maxHeight: 230 },
  logContent: { paddingBottom: 4 },

  turnBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#EFE8FC",
    marginBottom: 8,
  },
  turnRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  turnLabelUser: {
    color: "#A78BFA", fontSize: 10, fontWeight: "900", letterSpacing: 0.6,
    width: 64, marginTop: 2,
  },
  turnLabelChingu: {
    color: "#EC4899", fontSize: 10, fontWeight: "900", letterSpacing: 0.6,
    width: 64, marginTop: 2,
  },
  turnTextUser: {
    color: "#6B6585", fontSize: 13, fontStyle: "italic", fontWeight: "500",
    flex: 1, lineHeight: 18,
  },
  turnTextChingu: {
    color: "#1F1A2E", fontSize: 15, fontWeight: "700",
    flex: 1, lineHeight: 21,
  },

  error: { color: "#EF4444", marginTop: 8, fontSize: 12, fontWeight: "700" },
});
