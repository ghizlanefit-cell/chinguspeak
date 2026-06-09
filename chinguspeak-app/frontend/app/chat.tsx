import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useAudioPlayer, useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api/client";
import { getLanguage, TRANSLATABLE_LANGUAGES } from "@/src/constants/languages";
import { usePrefs, loadPrefs, setChatLang, setCredits } from "@/src/state/prefs";
import { chinguBotAvatar } from "@/src/theme";

type Msg = { role: "user" | "assistant"; content: string; id: string };

const SUGGESTIONS = [
  "Teach me a fun Korean phrase",
  "How do I say 'thank you' in Moroccan Darija?",
  "Quiz me on French greetings",
  "Tell me a joke in Spanish",
];

export default function Chat() {
  const router = useRouter();
  const prefs = usePrefs();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [picker, setPicker] = React.useState(false);
  const [audioUri, setAudioUri] = React.useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 200);
  const silenceSinceRef = React.useRef<number | null>(null);
  const autoStoppedRef = React.useRef(false);
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const listRef = React.useRef<FlatList<Msg>>(null);

  React.useEffect(() => {
    loadPrefs();
  }, []);

  React.useEffect(() => {
    (async () => {
      const sid = prefs.session;
      if (!sid) return;
      try {
        const h = await api.chatHistory(sid);
        if (h.messages?.length) {
          setMessages(h.messages.map((m, i) => ({ role: m.role as any, content: m.content, id: `${i}-${m.ts}` })));
        }
      } catch {}
    })();
  }, [prefs.session]);

  React.useEffect(() => {
    if (audioUri && player) {
      player.seekTo(0);
      player.play();
    }
  }, [audioUri, player]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !prefs.session) return;
    const userMsg: Msg = { role: "user", content: msg, id: `u-${Date.now()}` };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await api.chat({
        session_id: prefs.session,
        message: msg,
        practice_lang: prefs.chatLang || undefined,
        teach_style: prefs.teachStyle || "playful",
        app_locale: prefs.appLang,
      });
      if (typeof (res as any).credits === "number") await setCredits((res as any).credits);
      setMessages((m) => [...m, { role: "assistant", content: res.reply, id: `a-${Date.now()}` }]);
      if (prefs.autoVoiceReply && res.reply?.trim()) {
        try {
          const tts = await api.tts({ text: res.reply, target_lang: prefs.chatLang || "en", app_locale: prefs.appLang } as any);
          if (typeof (tts as any).credits === "number") await setCredits((tts as any).credits);
          setAudioUri(`data:${tts.mime};base64,${tts.audio_base64}`);
        } catch {}
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `(error) ${e?.message || "Try again"}`, id: `e-${Date.now()}` }]);
    } finally {
      setSending(false);
    }
  };

  const speak = async (text: string) => {
    try {
      const tts = await api.tts({ text, target_lang: prefs.chatLang || "en", app_locale: prefs.appLang } as any);
      if (typeof (tts as any).credits === "number") await setCredits((tts as any).credits);
      setAudioUri(`data:${tts.mime};base64,${tts.audio_base64}`);
    } catch (e: any) {
      console.warn(e?.message);
    }
  };

  const clear = async () => {
    if (!prefs.session) return;
    try {
      await api.clearChat(prefs.session);
      setMessages([]);
    } catch {}
  };

  const startVoiceInput = async () => {
    try {
      setVoiceError(null);
      const s = await AudioModule.requestRecordingPermissionsAsync();
      if (!s.granted) {
        setVoiceError("Microphone permission denied.");
        return;
      }
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      setVoiceError(e?.message || "Could not start voice input.");
    }
  };

  const stopVoiceInput = async () => {
    if (voiceBusy) return;
    try {
      setVoiceBusy(true);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setVoiceBusy(false);
        return;
      }
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" as any });
      const mime = uri.toLowerCase().endsWith(".m4a") ? "audio/m4a" : "audio/mp4";
      const stt = await api.transcribe({
        audio_base64: b64,
        mime_type: mime,
        language: prefs.chatLang || undefined,
        app_locale: prefs.appLang,
      } as any);
      if (typeof (stt as any).credits === "number") await setCredits((stt as any).credits);
      const text = (stt.text || "").trim();
      if (text) await send(text);
    } catch (e: any) {
      setVoiceError(e?.message || "Voice input failed.");
    } finally {
      setVoiceBusy(false);
      silenceSinceRef.current = null;
      autoStoppedRef.current = false;
    }
  };

  React.useEffect(() => {
    if (!recorderState?.isRecording) {
      silenceSinceRef.current = null;
      autoStoppedRef.current = false;
      return;
    }
    const metering = recorderState.metering;
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
      stopVoiceInput();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState?.isRecording, recorderState?.metering]);

  const currentLang = prefs.chatLang ? getLanguage(prefs.chatLang) : null;

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F5F1FF", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="chat-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color="#1F1A2E" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Image source={chinguBotAvatar} style={styles.botAvatar} />
            <View>
              <Text style={styles.headerTitle}>Chingu</Text>
              <Text style={styles.headerSub}>Your fun language friend</Text>
            </View>
          </View>
          <TouchableOpacity testID="chat-clear" onPress={clear} style={styles.iconBtn}>
            <Feather name="trash-2" size={18} color="#1F1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.practiceRow}>
          <TouchableOpacity
            testID="chat-lang-picker"
            style={styles.practiceChip}
            onPress={() => setPicker((p) => !p)}
          >
            <Text style={styles.practiceLabel}>Practice mode:</Text>
            <Text style={styles.practiceVal}>
              {currentLang ? `${currentLang.flag} ${currentLang.name}` : "Off"}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#6B6585" />
          </TouchableOpacity>
          {prefs.chatLang && (
            <TouchableOpacity testID="chat-lang-clear" onPress={() => setChatLang(null)} style={styles.practiceClear}>
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {picker && (
          <View style={styles.pickerCard}>
            <FlatList
              data={TRANSLATABLE_LANGUAGES.slice(0, 18)}
              numColumns={3}
              keyExtractor={(i) => i.code}
              contentContainerStyle={{ gap: 8 }}
              columnWrapperStyle={{ gap: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`practice-lang-${item.code}`}
                  style={styles.pickerItem}
                  onPress={() => { setChatLang(item.code); setPicker(false); }}
                >
                  <Text style={styles.pickerFlag}>{item.flag}</Text>
                  <Text style={styles.pickerName} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={20}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, gap: 10 }}
            ListEmptyComponent={
              <View style={styles.welcome}>
                <Image source={chinguBotAvatar} style={styles.welcomeOrb} />
                <Text style={styles.welcomeTitle}>Hi! I am Chingu</Text>
                <Text style={styles.welcomeSub}>
                  Ask me anything, practice a language, or just have fun.
                </Text>
                <View style={{ gap: 8, marginTop: 12, width: "100%" }}>
                  {SUGGESTIONS.map((s, i) => (
                    <TouchableOpacity
                      key={s}
                      testID={`suggestion-${i}`}
                      style={styles.suggestion}
                      onPress={() => send(s)}
                    >
                      <Feather name="zap" size={14} color="#8B5CF6" />
                      <Text style={styles.suggestionText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.bubbleRow, item.role === "user" ? styles.rowRight : styles.rowLeft]}>
                {item.role === "assistant" && (
                  <View style={styles.botBubbleWrap}>
                    <LinearGradient
                      colors={["#EC4899", "#8B5CF6"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.botBubble}
                    >
                      <Text style={styles.bubbleText} selectable>{item.content}</Text>
                    </LinearGradient>
                    <TouchableOpacity
                      testID={`chat-tts-${item.id}`}
                      onPress={() => speak(item.content)}
                      style={styles.ttsBtn}
                    >
                      <Ionicons name="volume-high" size={14} color="#EC4899" />
                    </TouchableOpacity>
                  </View>
                )}
                {item.role === "user" && (
                  <View style={styles.userBubble}>
                    <Text style={styles.bubbleText} selectable>{item.content}</Text>
                  </View>
                )}
              </View>
            )}
          />
          {sending && (
            <View style={styles.typing}>
              <ActivityIndicator color="#EC4899" />
              <Text style={styles.typingText}>Chingu is thinking…</Text>
            </View>
          )}
          {!!voiceError && <Text testID="chat-voice-error" style={styles.voiceError}>{voiceError}</Text>}
          {recorderState?.isRecording && (
            <View style={styles.voiceLiveBadge}>
              <View style={styles.voiceDot} />
              <Text style={styles.voiceLiveText}>Listening… auto-stop after 3s silence</Text>
            </View>
          )}
          <View style={styles.inputBar}>
            <TextInput
              testID="chat-input"
              value={input}
              onChangeText={setInput}
              placeholder="Message Chingu…"
              placeholderTextColor="#6B6585"
              style={styles.input}
              multiline
            />
            <TouchableOpacity
              testID={recorderState?.isRecording ? "chat-voice-stop" : "chat-voice-start"}
              onPress={recorderState?.isRecording ? stopVoiceInput : startVoiceInput}
              disabled={voiceBusy || sending}
              style={{ opacity: voiceBusy || sending ? 0.45 : 1 }}
            >
              <LinearGradient colors={recorderState?.isRecording ? ["#EF4444", "#EC4899"] : ["#8B5CF6", "#EC4899"]} style={styles.micBtn}>
                {voiceBusy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name={recorderState?.isRecording ? "stop" : "mic"} size={18} color="#fff" />}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              testID="chat-send"
              onPress={() => send()}
              disabled={!input.trim() || sending}
              style={{ opacity: !input.trim() || sending ? 0.4 : 1 }}
            >
              <LinearGradient colors={["#EC4899", "#8B5CF6"]} style={styles.sendBtn}>
                <Ionicons name="send" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1FF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  botAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "#8B5CF6" },
  headerTitle: { color: "#1F1A2E", fontSize: 16, fontWeight: "700" },
  headerSub: { color: "#9CA3AF", fontSize: 11 },
  practiceRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  practiceChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  practiceLabel: { color: "#9CA3AF", fontSize: 11 },
  practiceVal: { color: "#1F1A2E", fontSize: 12, fontWeight: "600" },
  practiceClear: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239,68,68,0.6)" },
  pickerCard: { marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F0EAFC" },
  pickerItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "#F0EAFC" },
  pickerFlag: { fontSize: 22 },
  pickerName: { color: "#1F1A2E", fontSize: 10, marginTop: 4, paddingHorizontal: 4 },
  welcome: { alignItems: "center", padding: 24, gap: 8 },
  welcomeOrb: { width: 100, height: 100, borderRadius: 50, marginBottom: 12, borderWidth: 2, borderColor: "#8B5CF6" },
  welcomeTitle: { color: "#1F1A2E", fontSize: 20, fontWeight: "800" },
  welcomeSub: { color: "#9CA3AF", textAlign: "center" },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#F0EAFC" },
  suggestionText: { color: "#1F1A2E", fontSize: 13, flex: 1 },
  bubbleRow: { flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  botBubbleWrap: { maxWidth: "85%" },
  botBubble: { borderRadius: 18, padding: 14, borderBottomLeftRadius: 4 },
  userBubble: { maxWidth: "85%", backgroundColor: "#F0EAFC", borderRadius: 18, padding: 14, borderBottomRightRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  bubbleText: { color: "#1F1A2E", fontSize: 15, lineHeight: 22 },
  ttsBtn: { marginTop: 6, alignSelf: "flex-start", width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  typing: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, marginBottom: 4 },
  typingText: { color: "#9CA3AF", fontSize: 12 },
  voiceError: { color: "#EF4444", fontSize: 12, fontWeight: "600", paddingHorizontal: 14, marginBottom: 6 },
  voiceLiveBadge: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginBottom: 6, backgroundColor: "#FFFFFF", borderColor: "#F0EAFC", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  voiceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  voiceLiveText: { color: "#1F1A2E", fontSize: 12, fontWeight: "600" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, paddingBottom: 24, backgroundColor: "rgba(22,12,40,0.8)", borderTopWidth: 1, borderTopColor: "#F0EAFC" },
  input: { flex: 1, color: "#1F1A2E", backgroundColor: "#FFFFFF", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, maxHeight: 120, fontSize: 15 },
  micBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
