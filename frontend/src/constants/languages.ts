export type Language = {
  code: string;
  name: string;
  flag: string;
};

export const LANGUAGES: Language[] = [
  { code: "auto", name: "Auto Detect", flag: "🌐" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ar-ma", name: "Moroccan Arabic (Darija)", flag: "🇲🇦" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "zh", name: "Chinese (Mandarin)", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "pt-br", name: "Portuguese (Brazil)", flag: "🇧🇷" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "bn", name: "Bengali", flag: "🇧🇩" },
  { code: "ur", name: "Urdu", flag: "🇵🇰" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "fi", name: "Finnish", flag: "🇫🇮" },
  { code: "el", name: "Greek", flag: "🇬🇷" },
  { code: "he", name: "Hebrew", flag: "🇮🇱" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "ms", name: "Malay", flag: "🇲🇾" },
  { code: "tl", name: "Filipino", flag: "🇵🇭" },
  { code: "sw", name: "Swahili", flag: "🇰🇪" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "cs", name: "Czech", flag: "🇨🇿" },
  { code: "ro", name: "Romanian", flag: "🇷🇴" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺" },
  { code: "bg", name: "Bulgarian", flag: "🇧🇬" },
  { code: "fa", name: "Persian (Farsi)", flag: "🇮🇷" },
  { code: "ta", name: "Tamil", flag: "🇱🇰" },
  { code: "te", name: "Telugu", flag: "🇮🇳" },
  { code: "pa", name: "Punjabi", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", flag: "🇮🇳" },
  { code: "kn", name: "Kannada", flag: "🇮🇳" },
  { code: "af", name: "Afrikaans", flag: "🇿🇦" },
  { code: "ca", name: "Catalan", flag: "🇪🇸" },
  { code: "hr", name: "Croatian", flag: "🇭🇷" },
  { code: "sk", name: "Slovak", flag: "🇸🇰" },
  { code: "sr", name: "Serbian", flag: "🇷🇸" },
  { code: "sl", name: "Slovenian", flag: "🇸🇮" },
  { code: "lv", name: "Latvian", flag: "🇱🇻" },
  { code: "lt", name: "Lithuanian", flag: "🇱🇹" },
  { code: "et", name: "Estonian", flag: "🇪🇪" },
];

export function getLanguage(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[1];
}

export const TRANSLATABLE_LANGUAGES = LANGUAGES.filter((l) => l.code !== "auto");
