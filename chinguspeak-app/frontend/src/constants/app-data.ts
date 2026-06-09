export type AppLang = {
  code: string;
  english: string;
  native: string;
  flag: string;
};

export const APP_LANGUAGES: AppLang[] = [
  { code: "en", english: "English", native: "English", flag: "🇺🇸" },
  { code: "es", english: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "fr", english: "French", native: "Français", flag: "🇫🇷" },
  { code: "de", english: "German", native: "Deutsch", flag: "🇩🇪" },
  { code: "ja", english: "Japanese", native: "日本語", flag: "🇯🇵" },
  { code: "ko", english: "Korean", native: "한국어", flag: "🇰🇷" },
  { code: "it", english: "Italian", native: "Italiano", flag: "🇮🇹" },
  { code: "zh", english: "Chinese", native: "中文", flag: "🇨🇳" },
  { code: "pt", english: "Portuguese", native: "Português", flag: "🇵🇹" },
  { code: "ru", english: "Russian", native: "Русский", flag: "🇷🇺" },
  { code: "ar", english: "Arabic", native: "العربية", flag: "🇸🇦" },
  { code: "nl", english: "Dutch", native: "Nederlands", flag: "🇳🇱" },
  { code: "tr", english: "Turkish", native: "Türkçe", flag: "🇹🇷" },
  { code: "pl", english: "Polish", native: "Polski", flag: "🇵🇱" },
  { code: "vi", english: "Vietnamese", native: "Tiếng Việt", flag: "🇻🇳" },
];

export function getAppLang(code: string): AppLang {
  return APP_LANGUAGES.find((l) => l.code === code) || APP_LANGUAGES[0];
}

export const LEVELS = [
  {
    id: 1,
    name: "Beginner",
    description: "I can introduce myself and know simple phrases.",
    dots: 1,
  },
  {
    id: 2,
    name: "Survival",
    description: "I can understand simple sentences and communicate in familiar situations, though with a limited vocabulary.",
    dots: 2,
  },
  {
    id: 3,
    name: "Conversational",
    description: "I can hold everyday conversations, ask questions, and share my opinions clearly.",
    dots: 3,
  },
  {
    id: 4,
    name: "Proficient",
    description: "I can discuss various topics confidently, though with some limitations.",
    dots: 4,
  },
  {
    id: 5,
    name: "Fluent",
    description: "I can speak smoothly with native speakers, using a wide range of expressions.",
    dots: 5,
  },
];

export const TOPICS = [
  { id: "small-talk", title: "Small talk & first impressions", subtitle: "Warm greetings", color: "#5B7CFA" },
  { id: "food", title: "Food & ordering", subtitle: "At a café or restaurant", color: "#FF8FA3" },
  { id: "travel", title: "Travel & directions", subtitle: "Find your way around", color: "#FFC857" },
  { id: "work", title: "Work & meetings", subtitle: "Professional vibes", color: "#7BD389" },
];
