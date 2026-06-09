<?php
// Ensures the seed admin exists. Runs once per request but is idempotent + cheap.
function ensure_seed_admin(): void {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT id, password_hash FROM admins WHERE email = ?');
    $stmt->execute([SEED_ADMIN_EMAIL]);
    $row = $stmt->fetch();
    if (!$row) {
        $ins = $pdo->prepare('INSERT INTO admins (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)');
        $ins->execute([uuid(), SEED_ADMIN_EMAIL, 'Super Admin', 'super_admin', password_hash_bcrypt(SEED_ADMIN_PASSWORD)]);
        return;
    }
    // If env password changed, re-sync the hash (so admin can always log in with the configured value).
    if (!password_verify_bcrypt(SEED_ADMIN_PASSWORD, $row['password_hash'])) {
        $upd = $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?');
        $upd->execute([password_hash_bcrypt(SEED_ADMIN_PASSWORD), $row['id']]);
    }
}

// Seed initial LLM provider rows (placeholders) and a couple of style themes.
function ensure_seed_content(): void {
    $pdo = db();
    if ((int)$pdo->query('SELECT COUNT(*) FROM llm_keys')->fetchColumn() === 0) {
        $rows = [
            ['emergent',  'Emergent Universal Key', '', 'gemini-3-flash-preview', 1],
            ['openai',    'OpenAI Main',            '', 'gpt-4o-mini',            0],
            ['anthropic', 'Claude Main',            '', 'claude-sonnet-4.5',      0],
            ['gemini',    'Gemini Main',            '', 'gemini-2.5-flash',       0],
        ];
        $ins = $pdo->prepare('INSERT INTO llm_keys (id, provider, label, api_key, model, balance, is_active) VALUES (?, ?, ?, ?, ?, 0, ?)');
        foreach ($rows as $r) {
            $ins->execute([uuid(), $r[0], $r[1], $r[2], $r[3], $r[4]]);
        }
    }
    if ((int)$pdo->query('SELECT COUNT(*) FROM styles')->fetchColumn() === 0) {
        $ins = $pdo->prepare('INSERT INTO styles (id, name, primary_color, secondary_color, background, is_active) VALUES (?, ?, ?, ?, ?, ?)');
        $ins->execute([uuid(), 'Style 1 - Aurora', '#FF2E93', '#8B5CF6', '#0A0514', 1]);
        $ins->execute([uuid(), 'Style 2 - Midnight', '#7C3AED', '#3B82F6', '#0B0B1F', 0]);
    }
    if ((int)$pdo->query('SELECT COUNT(*) FROM scenarios')->fetchColumn() === 0) {
        $list = [
            ['Order at a Cafe', 'Practice ordering a coffee', 'beginner', 'coffee'],
            ['Job Interview',   'Practice common interview Qs', 'intermediate', 'briefcase'],
            ['Book a Hotel',    'Reserve a hotel room', 'beginner', 'hotel'],
            ['At the Airport',  'Check in and find your gate', 'intermediate', 'plane'],
            ['Daily Conversation', 'Casual everyday talk', 'beginner', 'message'],
        ];
        $ins = $pdo->prepare('INSERT INTO scenarios (id, title, description, language, difficulty, prompt, icon, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
        foreach ($list as $r) {
            $ins->execute([uuid(), $r[0], $r[1], 'en', $r[2], 'Roleplay scenario: ' . $r[0], $r[3]]);
        }
    }

    $settings = [
        ['groq_api_key', '', 'integrations', 'Groq API key for STT'],
        ['groq_stt_model', 'whisper-large-v3-turbo', 'integrations', 'Groq STT model name'],
        ['deepgram_api_key', '', 'integrations', 'Deepgram API key for STT'],
        ['deepgram_stt_model', 'nova-2', 'integrations', 'Deepgram STT model name'],
        ['google_tts_api_key', '', 'integrations', 'Google Text-to-Speech API key'],
        ['google_tts_voice_name', '', 'integrations', 'Optional Google TTS voice'],
        ['openai_tts_fallback_model', 'tts-1', 'integrations', 'Fallback OpenAI TTS model'],
        ['gemini_api_key', '', 'integrations', 'Gemini API key for dynamic modules'],
        ['gemini_content_model', 'gemini-2.5-flash', 'integrations', 'Gemini model for module generation'],
        ['module_content_cache_hours', '24', 'integrations', 'Cache duration for generated module content (hours)'],
        ['daily_streak_base_reward', '5', 'monetization', 'Base streak reward credits'],
        ['daily_streak_max_bonus', '5', 'monetization', 'Maximum additional credits from streak multiplier'],
        ['admob_android_app_id', '', 'monetization', 'Google AdMob Android App ID'],
        ['admob_rewarded_ad_unit_id', '', 'monetization', 'Rewarded ad unit ID'],
        ['google_play_package_name', '', 'monetization', 'Android package name for billing verification'],
        ['google_play_subscription_product_id', '', 'monetization', 'Primary Google Play subscription product id'],
        ['google_play_service_account_json', '', 'monetization', 'Service account JSON for server-side billing verification'],
    ];
    $ins = $pdo->prepare('INSERT IGNORE INTO app_settings (`key`, `value`, `category`, `description`) VALUES (?,?,?,?)');
    foreach ($settings as $s) {
        $ins->execute([$s[0], $s[1], $s[2], $s[3]]);
    }
}

function ensure_premium_schema(): void {
    $pdo = db();
    $hasCredits = false;
    $cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'credits'")->fetchAll();
    if (!empty($cols)) $hasCredits = true;
    if (!$hasCredits) {
        $pdo->exec("ALTER TABLE users ADD COLUMN credits INT NOT NULL DEFAULT 50 AFTER is_pro");
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS credit_events (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      action_type VARCHAR(60) NOT NULL,
      amount INT NOT NULL,
      balance_after INT NOT NULL,
      meta_json TEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_credit_user (user_id),
      KEY idx_credit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS user_subscriptions (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      platform VARCHAR(30) NOT NULL DEFAULT 'google_play',
      product_id VARCHAR(120) NOT NULL,
      purchase_token TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      expires_at DATETIME DEFAULT NULL,
      raw_response LONGTEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_sub_user (user_id),
      KEY idx_sub_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS module_content_cache (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      module_key VARCHAR(40) NOT NULL,
      locale_code VARCHAR(20) NOT NULL,
      prompt_hash VARCHAR(80) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      model_name VARCHAR(120) DEFAULT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_module_prompt (module_key, locale_code, prompt_hash),
      KEY idx_module_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS daily_streaks (
      user_id VARCHAR(64) NOT NULL PRIMARY KEY,
      streak_days INT NOT NULL DEFAULT 0,
      last_claim_date DATE DEFAULT NULL,
      last_reward INT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_streak_last_claim (last_claim_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
