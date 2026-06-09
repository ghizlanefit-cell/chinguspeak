-- ============================================================
-- One-time fix to apply on existing Hostinger DB.
-- Run in phpMyAdmin → SQL tab → paste → Go.
-- ============================================================

-- 1. Allow api_key to default to '' (so old inserts didn't choke)
ALTER TABLE `llm_keys`
  MODIFY `api_key` TEXT NOT NULL;

-- 2. Convert any NULL api_keys to '' (clean state)
UPDATE `llm_keys` SET `api_key` = '' WHERE `api_key` IS NULL;

-- 3. Mark the Emergent Universal Key as INACTIVE (it doesn't work via raw PHP calls;
--    it only works on the Emergent Python preview backend).
UPDATE `llm_keys` SET `is_active` = 0
WHERE `api_key` LIKE 'sk-emergent-%';

-- 4. Set 'openai' as the preferred active provider once you add a real OpenAI key.
UPDATE `app_settings` SET `value` = '"openai"' WHERE `key` = 'active_llm_provider';

-- 5. Verify
SELECT id, provider, label, LEFT(api_key, 10) AS api_key_preview, is_active FROM `llm_keys`;

-- 6. Premium upgrade fields
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `credits` INT NOT NULL DEFAULT 50 AFTER `is_pro`;

CREATE TABLE IF NOT EXISTS `credit_events` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `action_type` VARCHAR(60) NOT NULL,
  `amount` INT NOT NULL,
  `balance_after` INT NOT NULL,
  `meta_json` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_credit_user` (`user_id`),
  KEY `idx_credit_created` (`created_at`)
);

CREATE TABLE IF NOT EXISTS `user_subscriptions` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `platform` VARCHAR(30) NOT NULL DEFAULT 'google_play',
  `product_id` VARCHAR(120) NOT NULL,
  `purchase_token` TEXT NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `expires_at` DATETIME DEFAULT NULL,
  `raw_response` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_sub_user` (`user_id`),
  KEY `idx_sub_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `module_content_cache` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `module_key` VARCHAR(40) NOT NULL,
  `locale_code` VARCHAR(20) NOT NULL,
  `prompt_hash` VARCHAR(80) NOT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `model_name` VARCHAR(120) DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_module_prompt` (`module_key`, `locale_code`, `prompt_hash`),
  KEY `idx_module_expiry` (`expires_at`)
);

CREATE TABLE IF NOT EXISTS `daily_streaks` (
  `user_id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `streak_days` INT NOT NULL DEFAULT 0,
  `last_claim_date` DATE DEFAULT NULL,
  `last_reward` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_streak_last_claim` (`last_claim_date`)
);

INSERT INTO `app_settings` (`key`,`value`,`category`,`description`) VALUES
('groq_api_key', '', 'integrations', 'Groq API key for STT'),
('groq_stt_model', 'whisper-large-v3-turbo', 'integrations', 'Groq STT model name'),
('deepgram_api_key', '', 'integrations', 'Deepgram API key for STT'),
('deepgram_stt_model', 'nova-2', 'integrations', 'Deepgram STT model name'),
('google_tts_api_key', '', 'integrations', 'Google Text-to-Speech API key'),
('google_tts_voice_name', '', 'integrations', 'Optional Google TTS voice'),
('openai_tts_fallback_model', 'tts-1', 'integrations', 'Fallback OpenAI TTS model'),
('gemini_api_key', '', 'integrations', 'Gemini API key for dynamic modules'),
('gemini_content_model', 'gemini-2.5-flash', 'integrations', 'Gemini model for module generation'),
('module_content_cache_hours', '24', 'integrations', 'Cache duration for generated module content (hours)'),
('daily_streak_base_reward', '5', 'monetization', 'Base streak reward credits'),
('daily_streak_max_bonus', '5', 'monetization', 'Maximum additional credits from streak multiplier'),
('admob_android_app_id', '', 'monetization', 'Google AdMob Android App ID'),
('admob_rewarded_ad_unit_id', '', 'monetization', 'Rewarded ad unit ID'),
('google_play_package_name', '', 'monetization', 'Android package name for billing verification'),
('google_play_subscription_product_id', '', 'monetization', 'Primary Google Play subscription product id'),
('google_play_service_account_json', '', 'monetization', 'Service account JSON for server-side billing verification')
ON DUPLICATE KEY UPDATE
`value` = VALUES(`value`),
`category` = VALUES(`category`),
`description` = VALUES(`description`);
