-- ============================================================
-- ChinguSpeak Admin — MySQL schema
-- Import this file in phpMyAdmin (or via `mysql -u user -p db < schema.sql`)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS admins (
  id            VARCHAR(64) NOT NULL PRIMARY KEY,
  email         VARCHAR(190) NOT NULL UNIQUE,
  name          VARCHAR(120) DEFAULT NULL,
  role          VARCHAR(40)  NOT NULL DEFAULT 'admin',
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id                   VARCHAR(64) NOT NULL PRIMARY KEY,
  email                VARCHAR(190) NOT NULL UNIQUE,
  name                 VARCHAR(120) DEFAULT NULL,
  country_flag         VARCHAR(8)   DEFAULT NULL,
  is_pro               TINYINT(1)   NOT NULL DEFAULT 0,
  credits              INT          NOT NULL DEFAULT 50,
  is_banned            TINYINT(1)   NOT NULL DEFAULT 0,
  conversations_count  INT          NOT NULL DEFAULT 0,
  time_spent_minutes   INT          NOT NULL DEFAULT 0,
  progress             INT          NOT NULL DEFAULT 0,
  password_hash        VARCHAR(255) DEFAULT NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS llm_keys (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  provider    VARCHAR(40) NOT NULL,
  label       VARCHAR(160) NOT NULL,
  api_key     TEXT NOT NULL,
  model       VARCHAR(160) DEFAULT NULL,
  base_url    VARCHAR(255) DEFAULT NULL,
  balance     DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  notes       TEXT DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_settings (
  `key`       VARCHAR(120) NOT NULL PRIMARY KEY,
  `value`     TEXT NOT NULL,
  `category`  VARCHAR(60) DEFAULT 'general',
  description VARCHAR(255) DEFAULT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS languages (
  code       VARCHAR(16) NOT NULL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  flag       VARCHAR(16) DEFAULT NULL,
  tts_voice  VARCHAR(40) DEFAULT 'alloy',
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS scenarios (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  title       VARCHAR(190) NOT NULL,
  description TEXT DEFAULT NULL,
  language    VARCHAR(16) DEFAULT 'en',
  difficulty  VARCHAR(20) DEFAULT 'beginner',
  prompt      TEXT DEFAULT NULL,
  icon        VARCHAR(60) DEFAULT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  uses_count  INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS styles (
  id              VARCHAR(64) NOT NULL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  primary_color   VARCHAR(20) NOT NULL,
  secondary_color VARCHAR(20) NOT NULL,
  background      VARCHAR(20) NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 0,
  preview_image   VARCHAR(255) DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS broadcasts (
  id        VARCHAR(64) NOT NULL PRIMARY KEY,
  title     VARCHAR(190) NOT NULL,
  body      TEXT NOT NULL,
  audience  VARCHAR(40) NOT NULL DEFAULT 'all',
  sent_by   VARCHAR(190) NOT NULL,
  ts        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  identifier  VARCHAR(190) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_identifier (identifier, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS translations (
  id              VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id         VARCHAR(64) DEFAULT NULL,
  kind            VARCHAR(20) NOT NULL DEFAULT 'text',
  source_text     TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_lang     VARCHAR(16) NOT NULL,
  target_lang     VARCHAR(16) NOT NULL,
  favorite        TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id    VARCHAR(64) NOT NULL PRIMARY KEY,
  messages      LONGTEXT NOT NULL,
  practice_lang VARCHAR(16) DEFAULT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS credit_events (
  id             VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id        VARCHAR(64) NOT NULL,
  action_type    VARCHAR(60) NOT NULL,
  amount         INT NOT NULL,
  balance_after  INT NOT NULL,
  meta_json      TEXT DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_credit_user (user_id),
  KEY idx_credit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id              VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL,
  platform        VARCHAR(30) NOT NULL DEFAULT 'google_play',
  product_id      VARCHAR(120) NOT NULL,
  purchase_token  TEXT NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'active',
  expires_at      DATETIME DEFAULT NULL,
  raw_response    LONGTEXT DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sub_user (user_id),
  KEY idx_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS module_content_cache (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  module_key    VARCHAR(40) NOT NULL,
  locale_code   VARCHAR(20) NOT NULL,
  prompt_hash   VARCHAR(80) NOT NULL,
  payload_json  LONGTEXT NOT NULL,
  model_name    VARCHAR(120) DEFAULT NULL,
  expires_at    DATETIME NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_module_prompt (module_key, locale_code, prompt_hash),
  KEY idx_module_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daily_streaks (
  user_id            VARCHAR(64) NOT NULL PRIMARY KEY,
  streak_days        INT NOT NULL DEFAULT 0,
  last_claim_date    DATE DEFAULT NULL,
  last_reward        INT NOT NULL DEFAULT 0,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_streak_last_claim (last_claim_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Seed data — runs only if the tables are empty (php seed.php handles it).
-- You can also pre-load some defaults here if you like.
-- ============================================================
INSERT IGNORE INTO languages (code, name, flag, tts_voice) VALUES
  ('en', 'English', '🇺🇸', 'alloy'),
  ('ko', 'Korean', '🇰🇷', 'nova'),
  ('ar-ma', 'Moroccan Arabic (Darija)', '🇲🇦', 'shimmer'),
  ('fr', 'French', '🇫🇷', 'coral'),
  ('es', 'Spanish', '🇪🇸', 'nova'),
  ('ja', 'Japanese', '🇯🇵', 'shimmer');

INSERT IGNORE INTO app_settings (`key`, `value`, `category`, description) VALUES
  ('app_name', 'ChinguSpeak', 'general', 'Visible app name'),
  ('active_llm_provider', 'emergent', 'llm', 'Provider the mobile app uses'),
  ('free_tier_daily_limit', '30', 'limits', 'Free user requests/day'),
  ('pro_price_usd', '9.99', 'billing', 'Monthly Pro price'),
  ('groq_api_key', '', 'integrations', 'Groq API key for STT'),
  ('groq_stt_model', 'whisper-large-v3-turbo', 'integrations', 'Groq STT model name'),
  ('deepgram_api_key', '', 'integrations', 'Deepgram API key for STT'),
  ('deepgram_stt_model', 'nova-2', 'integrations', 'Deepgram STT model name'),
  ('google_tts_api_key', '', 'integrations', 'Google Text-to-Speech API key'),
  ('google_tts_voice_name', '', 'integrations', 'Optional Google TTS voice (ex: en-US-Chirp3-HD-Aoede)'),
  ('openai_tts_fallback_model', 'tts-1', 'integrations', 'Fallback OpenAI TTS model'),
  ('gemini_api_key', '', 'integrations', 'Gemini API key for dynamic modules'),
  ('gemini_content_model', 'gemini-2.5-flash', 'integrations', 'Gemini model for module content generation'),
  ('module_content_cache_hours', '24', 'integrations', 'Cache duration for generated module content (hours)'),
  ('daily_streak_base_reward', '5', 'monetization', 'Base streak reward credits'),
  ('daily_streak_max_bonus', '5', 'monetization', 'Maximum additional credits from streak multiplier'),
  ('admob_android_app_id', '', 'monetization', 'Google AdMob Android App ID'),
  ('admob_rewarded_ad_unit_id', '', 'monetization', 'Rewarded ad unit ID'),
  ('google_play_package_name', '', 'monetization', 'Android package name for billing verification'),
  ('google_play_subscription_product_id', '', 'monetization', 'Primary Google Play subscription product id'),
  ('google_play_service_account_json', '', 'monetization', 'Service account JSON for server-side billing verification'),
  ('maintenance_mode', 'false', 'general', 'Show maintenance banner'),
  ('welcome_message', 'Hi, I\'m Chingu! Your AI translation friend.', 'general', 'Onboarding message');

SET FOREIGN_KEY_CHECKS = 1;
