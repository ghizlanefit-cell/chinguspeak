/**
 * Chingu Speak — Light Lavender Theme (Jan 2026 refresh)
 *
 * Single source of truth for colors, spacing, radii and shadows so the new
 * cute-mascot aesthetic can be applied consistently across screens. Imported
 * by screens via:   import { theme } from "@/src/theme";
 */

export const theme = {
  // ─── Surfaces ───────────────────────────────────────────────────────────
  bg: "#F5F1FF",                 // app background — soft lavender wash
  bgAlt: "#EEE7FF",              // section background / chips
  card: "#FFFFFF",               // raised surface
  cardSoft: "#F9F6FF",           // very light alt card

  // ─── Brand ──────────────────────────────────────────────────────────────
  primary: "#8B5CF6",            // brand purple
  primaryDeep: "#7C3AED",
  primaryLight: "#A78BFA",
  primaryGlow: "rgba(139, 92, 246, 0.22)",

  accent: "#EC4899",             // hot pink — Live Speak, badges
  accentSoft: "#FCE7F3",
  warning: "#F59E0B",
  success: "#10B981",
  danger:  "#EF4444",

  // ─── Text ───────────────────────────────────────────────────────────────
  text:       "#1F1A2E",         // headings, primary text
  textBody:   "#3F384F",         // body
  textMuted:  "#6B6585",         // sub / hint
  textOnDark: "#FFFFFF",

  // ─── Borders / dividers ────────────────────────────────────────────────
  border:    "#E7E0F5",
  borderSoft:"#F0EAFC",

  // ─── Shadows (works on iOS + Android via elevation) ─────────────────────
  shadow: {
    sm: {
      shadowColor: "#7C3AED",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    md: {
      shadowColor: "#7C3AED",
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    lg: {
      shadowColor: "#7C3AED",
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
  },

  // ─── Gradients (use with expo-linear-gradient) ──────────────────────────
  gradient: {
    primary:  ["#A78BFA", "#8B5CF6"] as const,
    primaryHot: ["#8B5CF6", "#EC4899"] as const,
    hero:     ["#C4B5FD", "#A78BFA", "#EC4899"] as const,
    soft:     ["#F5F1FF", "#FFFFFF"] as const,
    pink:     ["#F472B6", "#EC4899"] as const,
  },

  // ─── Radii / spacing ───────────────────────────────────────────────────
  radius: { xs: 8, sm: 12, md: 18, lg: 24, xl: 32, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },
};

// Mascot image (the cute Chingu alien holding the globe — the official hero
// artwork). Transparent background, ideal for the home hero illustration.
export const chinguMascot = require("../assets/images/chingu-bot.png");
export const chinguBotAvatar = require("../assets/images/chingu-bot.png");
export const chinguIdleMascot = require("../assets/images/chingu-idle.png");
export const chinguActiveMascot = require("../assets/images/chingu-active.png");
export const heartIcon = require("../assets/images/heart-icon.png");

export type Theme = typeof theme;
