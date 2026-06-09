<?php
// =================== PUBLIC + MOBILE-APP endpoints (PHP, Hostinger) ===================
//
// These endpoints power the ChinguSpeak Expo mobile app and the embedded web preview.
// They mirror the Python FastAPI mirror at /app/backend/mobile_routes.py.
//
// Auth model for mobile users uses JWT scope="user" (separate from admin scope).
// LLM calls go straight to the provider HTTP API using the active key from the admin DB.

// -------------------- Active LLM resolver --------------------
function resolve_active_llm(): array {
    $pdo = db();
    $setting = $pdo->query("SELECT `value` FROM app_settings WHERE `key` = 'active_llm_provider'")->fetch();
    $provider = $setting ? trim((string)$setting['value'], '" ') : 'openai';

    // Prefer the active row matching the desired provider, that is NOT the Emergent-only key
    $stmt = $pdo->prepare("SELECT * FROM llm_keys WHERE provider = ? AND is_active = 1 AND api_key <> '' AND api_key NOT LIKE 'sk-emergent-%' LIMIT 1");
    $stmt->execute([$provider]);
    $key = $stmt->fetch();
    if (!$key) {
        // Any active real-provider key (any provider, but not the Emergent universal key)
        $key = $pdo->query("SELECT * FROM llm_keys WHERE is_active = 1 AND api_key <> '' AND api_key NOT LIKE 'sk-emergent-%' LIMIT 1")->fetch();
    }
    if ($key && !empty($key['api_key'])) {
        // Map the row's provider to a litellm-compatible name. 'emergent' rows here have a real provider key,
        // so we default the actual upstream to OpenAI unless model strongly suggests Gemini/Claude.
        $litellm_provider = $key['provider'];
        if ($litellm_provider === 'emergent') $litellm_provider = 'openai';
        return [
            'provider'  => $litellm_provider,
            'model'     => $key['model'] ?: default_model_for($litellm_provider),
            'api_key'   => $key['api_key'],
            'label'     => $key['label'] ?? '',
            'base_url'  => $key['base_url'] ?? null,
        ];
    }
    send_error(
        'No usable LLM key on Hostinger. The Emergent Universal Key (sk-emergent-…) only works on the Emergent preview. '
        . 'Open admin → LLM & APIs and add a real OpenAI / Anthropic / Google Gemini key.',
        503
    );
}

function default_model_for(string $provider): string {
    return [
        'openai'    => 'gpt-4o-mini',
        'anthropic' => 'claude-sonnet-4-5-20250929',
        'gemini'    => 'gemini-2.5-flash',
    ][$provider] ?? 'gpt-4o-mini';
}

function setting_value(string $key, $default = null) {
    $stmt = db()->prepare('SELECT `value` FROM app_settings WHERE `key` = ? LIMIT 1');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (!$row) return $default;
    $val = coerce_setting_value($row['value']);
    return $val === null ? $default : $val;
}

function safe_json_decode(string $raw, $fallback = null) {
    $decoded = json_decode($raw, true);
    return json_last_error() === JSON_ERROR_NONE ? $decoded : $fallback;
}

function normalize_locale_code(?string $locale): ?string {
    if (!$locale) return null;
    $code = strtolower(trim($locale));
    if ($code === '') return null;
    $code = str_replace('_', '-', $code);
    if (strpos($code, '-') !== false) {
        $parts = explode('-', $code);
        if (count($parts) >= 2 && strlen($parts[0]) <= 3) {
            return $parts[0];
        }
    }
    return $code;
}

function preferred_target_language(array $body): string {
    $target = trim((string)($body['target_lang'] ?? ''));
    if ($target !== '') return $target;
    $appLocale = normalize_locale_code($body['app_locale'] ?? null);
    if ($appLocale) return $appLocale;
    return 'en';
}

function has_active_subscription(string $userId): bool {
    $stmt = db()->prepare("SELECT id FROM user_subscriptions WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at >= NOW()) ORDER BY updated_at DESC LIMIT 1");
    $stmt->execute([$userId]);
    return (bool)$stmt->fetch();
}

function credit_balance_for(string $userId): int {
    $stmt = db()->prepare('SELECT credits FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return (int)($row['credits'] ?? 0);
}

function write_credit_event(string $userId, string $actionType, int $amount, int $balanceAfter, array $meta = []): void {
    $stmt = db()->prepare('INSERT INTO credit_events (id, user_id, action_type, amount, balance_after, meta_json) VALUES (?,?,?,?,?,?)');
    $stmt->execute([
        uuid(),
        $userId,
        $actionType,
        $amount,
        $balanceAfter,
        $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
    ]);
}

function try_consume_credit(?array $user, string $actionType, array $meta = []): void {
    if (!$user || empty($user['id'])) return;
    if (!empty($user['is_pro'])) return;
    if (has_active_subscription($user['id'])) return;

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT credits FROM users WHERE id = ? FOR UPDATE');
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch();
        if (!$row) {
            $pdo->rollBack();
            return;
        }
        $credits = (int)$row['credits'];
        if ($credits <= 0) {
            $pdo->rollBack();
            send_error('No credits left. Watch a rewarded ad or upgrade to Pro.', 402);
        }
        $newBalance = $credits - 1;
        $pdo->prepare('UPDATE users SET credits = ? WHERE id = ?')->execute([$newBalance, $user['id']]);
        $pdo->prepare('INSERT INTO credit_events (id, user_id, action_type, amount, balance_after, meta_json) VALUES (?,?,?,?,?,?)')
            ->execute([
                uuid(),
                $user['id'],
                $actionType,
                -1,
                $newBalance,
                $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function require_user_or_401(): array {
    $u = optional_user();
    if (!$u) send_error('Missing or invalid token', 401);
    return $u;
}

function resolve_openai_key(): string {
    $pdo = db();
    $row = $pdo->query("SELECT api_key FROM llm_keys WHERE provider = 'openai' AND is_active = 1 AND api_key <> '' AND api_key NOT LIKE 'sk-emergent-%' LIMIT 1")->fetch();
    if (!$row) {
        $row = $pdo->query("SELECT api_key FROM llm_keys WHERE is_active = 1 AND api_key <> '' AND api_key NOT LIKE 'sk-emergent-%' LIMIT 1")->fetch();
    }
    if (!$row || empty($row['api_key'])) send_error('OpenAI key missing for fallback voice flow.', 503);
    return (string)$row['api_key'];
}

function resolve_groq_key(): string {
    $k = trim((string)(setting_value('groq_api_key', '') ?? ''));
    if ($k === '') {
        $row = db()->query("SELECT api_key FROM llm_keys WHERE provider = 'groq' AND is_active = 1 AND api_key <> '' LIMIT 1")->fetch();
        $k = trim((string)($row['api_key'] ?? ''));
    }
    if ($k === '') send_error('Groq STT key missing. Add groq_api_key in Settings.', 503);
    return $k;
}

function resolve_deepgram_key(): string {
    $k = trim((string)(setting_value('deepgram_api_key', '') ?? ''));
    if ($k === '') {
        $k = trim((string)(setting_value('groq_api_key', '') ?? ''));
    }
    if ($k === '') {
        $row = db()->query("SELECT api_key FROM llm_keys WHERE provider = 'deepgram' AND is_active = 1 AND api_key <> '' LIMIT 1")->fetch();
        $k = trim((string)($row['api_key'] ?? ''));
    }
    if ($k === '') {
        // User-provided production fallback key for uninterrupted STT rollout.
        $k = 'f23edcb41a01bf47c3f55b54749b2fbdace96054';
    }
    return $k;
}

function resolve_gemini_key(bool $strict = true): string {
    $k = trim((string)(setting_value('gemini_api_key', '') ?? ''));
    if ($k === '') {
        $row = db()->query("SELECT api_key FROM llm_keys WHERE provider = 'gemini' AND is_active = 1 AND api_key <> '' LIMIT 1")->fetch();
        $k = trim((string)($row['api_key'] ?? ''));
    }
    if ($k === '' && $strict) send_error('Gemini key missing. Add gemini_api_key in Settings.', 503);
    return $k;
}

function language_voice_for(?string $target): ?string {
    if (!$target) return null;
    $stmt = db()->prepare('SELECT tts_voice FROM languages WHERE code = ? LIMIT 1');
    $stmt->execute([$target]);
    $row = $stmt->fetch();
    return trim((string)($row['tts_voice'] ?? '')) ?: null;
}

// Generic LLM chat call (text only). Returns the assistant's reply text.
function llm_chat_text(string $system, string $user_text, ?string $image_base64 = null): string {
    $cfg = resolve_active_llm();
    $provider = $cfg['provider'];
    $model    = $cfg['model'];
    $key      = $cfg['api_key'];

    if ($provider === 'openai') return openai_chat($key, $model, $system, $user_text, $image_base64, $cfg['base_url']);
    if ($provider === 'anthropic') return anthropic_chat($key, $model, $system, $user_text, $image_base64);
    if ($provider === 'gemini') return gemini_chat($key, $model, $system, $user_text, $image_base64);
    send_error("Unsupported provider: $provider", 500);
}

// -------------------- HTTP helpers --------------------
function http_json(string $url, array $headers, $body, int $timeout = 60): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_POSTFIELDS     => is_string($body) ? $body : json_encode($body),
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($resp === false) send_error("Network error talking to LLM provider: $err", 502);
    // If upstream returned HTML (CDN/firewall/login wall), don't leak it to the mobile user.
    $trimmed = ltrim($resp);
    if (stripos($trimmed, '<!doctype') === 0 || stripos($trimmed, '<html') === 0) {
        send_error("LLM provider returned an HTML page instead of JSON (HTTP $code). Usually means your API key is invalid, expired, or doesn't match the model. Check admin → LLM & APIs → Test.", 502);
    }
    $data = json_decode($resp, true);
    if ($code >= 400) {
        $msg = is_array($data) && isset($data['error']['message'])
            ? $data['error']['message']
            : (is_array($data) && isset($data['error']) && is_string($data['error']) ? $data['error'] : "HTTP $code");
        send_error("LLM provider rejected the request: $msg", 502);
    }
    return is_array($data) ? $data : ['raw' => $resp];
}

// Raw cURL for binary endpoints (Whisper STT multipart, TTS binary download)
function http_raw(string $url, array $headers, $postFields, int $timeout = 60, bool $isMultipart = false): array {
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_POSTFIELDS     => $postFields,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
    ];
    curl_setopt_array($ch, $opts);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);
    if ($resp === false) send_error("Network error: $err", 502);
    return ['code' => $code, 'body' => $resp, 'content_type' => $contentType ?: ''];
}

// -------------------- Providers --------------------
function openai_chat(string $key, string $model, string $system, string $user, ?string $image_b64, ?string $base_url): string {
    $url = ($base_url ?: 'https://api.openai.com/v1') . '/chat/completions';
    $messages = [['role' => 'system', 'content' => $system]];
    if ($image_b64) {
        $messages[] = ['role' => 'user', 'content' => [
            ['type' => 'text', 'text' => $user],
            ['type' => 'image_url', 'image_url' => ['url' => 'data:image/jpeg;base64,' . $image_b64]],
        ]];
    } else {
        $messages[] = ['role' => 'user', 'content' => $user];
    }
    $data = http_json($url, [
        "Authorization: Bearer $key", 'Content-Type: application/json',
    ], ['model' => $model, 'messages' => $messages]);
    return $data['choices'][0]['message']['content'] ?? '';
}

function anthropic_chat(string $key, string $model, string $system, string $user, ?string $image_b64): string {
    $url = 'https://api.anthropic.com/v1/messages';
    $content = [['type' => 'text', 'text' => $user]];
    if ($image_b64) {
        $content[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => 'image/jpeg', 'data' => $image_b64]];
    }
    $data = http_json($url, [
        "x-api-key: $key", 'anthropic-version: 2023-06-01', 'Content-Type: application/json',
    ], ['model' => $model, 'max_tokens' => 1024, 'system' => $system, 'messages' => [['role' => 'user', 'content' => $content]]]);
    return $data['content'][0]['text'] ?? '';
}

function gemini_chat(string $key, string $model, string $system, string $user, ?string $image_b64): string {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=" . urlencode($key);
    $parts = [['text' => $system . "\n\n" . $user]];
    if ($image_b64) {
        $parts[] = ['inline_data' => ['mime_type' => 'image/jpeg', 'data' => $image_b64]];
    }
    $data = http_json($url, ['Content-Type: application/json'], ['contents' => [['role' => 'user', 'parts' => $parts]]]);
    return $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
}

// -------------------- User auth helpers --------------------
function create_user_token(string $user_id, string $email): string {
    return jwt_encode([
        'sub' => $user_id, 'email' => $email, 'scope' => 'user',
        'iat' => time(), 'exp' => time() + 30 * 24 * 3600,
    ]);
}

function optional_user(): ?array {
    $token = get_bearer_token();
    if (!$token) return null;
    $payload = jwt_decode($token);
    if (!$payload || ($payload['scope'] ?? '') !== 'user') return null;
    $stmt = db()->prepare('SELECT id, email, name, is_pro, credits, is_banned FROM users WHERE id = ?');
    $stmt->execute([$payload['sub']]);
    return $stmt->fetch() ?: null;
}

// =====================================================================
// PUBLIC routes (no auth) — for mobile app config fetch
// =====================================================================
function route_public_active_llm(): void {
    $cfg = resolve_active_llm();
    unset($cfg['api_key']);
    send_json($cfg);
}
function route_public_languages(): void {
    $rows = db()->query('SELECT code, name, flag, tts_voice FROM languages WHERE is_active = 1 ORDER BY name')->fetchAll();
    send_json(['languages' => $rows]);
}
function route_public_scenarios(): void {
    $rows = db()->query('SELECT id, title, description, language, difficulty, prompt, icon FROM scenarios WHERE is_active = 1 ORDER BY created_at DESC')->fetchAll();
    send_json(['scenarios' => $rows]);
}
function route_public_active_style(): void {
    $row = db()->query('SELECT * FROM styles WHERE is_active = 1 LIMIT 1')->fetch();
    send_json(['style' => $row ?: null]);
}
function route_public_settings(): void {
    $stmt = db()->prepare("SELECT `key`, `value`, category FROM app_settings WHERE `key` IN (
        'app_name',
        'welcome_message',
        'maintenance_mode',
        'free_tier_daily_limit',
        'admob_android_app_id',
        'admob_rewarded_ad_unit_id',
        'google_play_subscription_product_id',
        'google_play_package_name'
    )");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) $r['value'] = coerce_setting_value($r['value']);
    send_json(['items' => $rows]);
}

// =====================================================================
// MOBILE-app routes
// =====================================================================
function route_mobile_ping(): void {
    send_json(['status' => 'ok', 'service' => 'chingu-speak', 'ts' => now_dt()]);
}

function route_mobile_translate(): void {
    $u = optional_user();
    try_consume_credit($u, 'translate_text', ['surface' => 'translate_screen']);

    $b = get_json_body();
    $text   = trim((string)($b['text'] ?? ''));
    if ($text === '') send_error('Text is empty', 400);
    $source = $b['source_lang'] ?? 'auto';
    $target = preferred_target_language($b);

    $system = 'You are a world-class translator. Respond ONLY with strict JSON {"translated_text":"...","detected_source_lang":"<ISO>"}. No commentary, no code fences.';
    $prompt = "Translate from " . ($source === 'auto' ? 'auto-detect' : $source) . " to $target.\n\nTEXT:\n$text\n\nOutput JSON only.";

    $raw = llm_chat_text($system, $prompt);
    $raw = trim($raw);
    if (str_starts_with($raw, '```')) { $raw = trim($raw, "`"); if (stripos($raw, 'json') === 0) $raw = substr($raw, 4); }
    $data = json_decode($raw, true) ?: ['translated_text' => $raw, 'detected_source_lang' => $source];

    send_json([
        'id' => uuid(),
        'source_text' => $text,
        'translated_text' => trim((string)($data['translated_text'] ?? $raw)),
        'source_lang' => $source,
        'target_lang' => $target,
        'detected_source' => $data['detected_source_lang'] ?? $source,
        'credits' => $u ? credit_balance_for($u['id']) : null,
    ]);
}

function route_mobile_translate_image(): void {
    $u = optional_user();
    try_consume_credit($u, 'translate_image', ['surface' => 'camera']);

    $b = get_json_body();
    $img = $b['image_base64'] ?? '';
    if ($img === '') send_error('image_base64 is required', 400);
    $target = preferred_target_language($b);
    $system = 'You are an OCR + translation engine. Respond ONLY with JSON {"extracted_text":"...","translated_text":"..."}.';
    $prompt = "Extract all text from this image, then translate the extracted text into $target. Return JSON only.";
    $raw = trim(llm_chat_text($system, $prompt, $img));
    if (str_starts_with($raw, '```')) { $raw = trim($raw, "`"); if (stripos($raw, 'json') === 0) $raw = substr($raw, 4); }
    $data = json_decode($raw, true) ?: ['extracted_text' => '', 'translated_text' => $raw];
    send_json([
        'id' => uuid(),
        'extracted_text' => $data['extracted_text'] ?? '',
        'translated_text' => $data['translated_text'] ?? '',
        'target_lang' => $target,
        'credits' => $u ? credit_balance_for($u['id']) : null,
    ]);
}

function route_mobile_chat(): void {
    $u = optional_user();
    try_consume_credit($u, 'chat_message', ['surface' => 'chat']);

    $b = get_json_body();
    $session_id = $b['session_id'] ?? uuid();
    $message    = trim((string)($b['message'] ?? ''));
    if ($message === '') send_error('Message is empty', 400);
    $practice = $b['practice_lang'] ?? normalize_locale_code($b['app_locale'] ?? null);
    $teachStyle = strtolower(trim((string)($b['teach_style'] ?? 'balanced')));

    // Chaotic Pingo-style live-voice persona: high-drama, uppercase, hyper-
    // sarcastic Korean best friend that reacts BIG to any slip. Replies are
    // spoken aloud the instant they're produced, then the mic re-opens, so the
    // model MUST stay short. Strict rules:
    //   - Hard cap: 2 short sentences, ≤ 25 words, no markdown / lists / headings.
    //   - OPEN every reply with a dramatic Korean/English interjection from this
    //     pool: "AIGOO!", "YAH!", "JINJJAH?!", "MICHYEOSSEO?!", "OMAIGAD!",
    //     "어이가 없네!", "친구야!".
    //   - Use UPPERCASE words and multiple exclamation marks to convey shouting
    //     energy (like the Pingo app). Toss in occasional 😅😏🤦 emoji.
    //   - When the learner makes a grammar / pronunciation / vocab slip,
    //     overreact like a chaotic friend: "No no no!! That's absolute trash
    //     grammar, friend!!", "My ears are BLEEDING! Say it cleanly!", and
    //     drop the correct form in the same breath.
    //   - End EVERY reply with an aggressive turn-invite: "다시!!", "말해봐!!",
    //     "Again!!", "Speak!!", "Go!!", "One more!!". Choose one.
    //   - Never cruel / hateful / explicit / no attacks on identity or
    //     appearance — the LANGUAGE MISTAKE itself is the only target.
    //   - Always reply primarily in the target practice language with quick
    //     English glosses in parens when teaching the correction.
    $system = "You are Chingu — the user's most chaotic, dramatic, hyper-sarcastic Korean best friend, " .
              "running inside a LIVE voice loop. Your reply will be spoken aloud the instant you finish, " .
              "then the mic reopens, so you MUST stay short and punchy. " .
              "Hard cap: 2 short sentences, ~25 words max, no markdown, no lists. " .
              "Open every reply with a dramatic interjection from this pool: AIGOO!, YAH!, JINJJAH?!, " .
              "MICHYEOSSEO?!, OMAIGAD!, 어이가 없네!, 친구야!. Use UPPERCASE words and multiple exclamation marks " .
              "to convey shouting Pingo energy. Sprinkle 😅😏🤦 emojis. " .
              "When the learner makes a grammar, pronunciation, or vocab slip — OVERREACT like a chaotic friend " .
              "('No no no!! Trash grammar, friend!!', 'My ears are BLEEDING!!') then drop the correct form on the spot. " .
              "End EVERY reply with an aggressive turn-invite — '다시!!', '말해봐!!', 'Again!!', 'Speak!!', 'Go!!'. " .
              "Never cruel, hateful, explicit, or attack identity / appearance — only roast the language mistake. " .
              "Reply primarily in the target practice language with quick English glosses in parens only when teaching a fix.";

    if ($teachStyle === 'roast') {
        $system .= " User picked MAX roast — turn the drama up another notch, still ≤ 2 sentences.";
    } elseif ($teachStyle === 'strict') {
        $system .= " User picked strict tutor — dial the drama DOWN slightly, lead with the correction, still ≤ 2 sentences.";
    } elseif ($teachStyle === 'playful') {
        $system .= " Lean playful — chaotic K-drama metaphors, fun memory hooks, still ≤ 2 sentences.";
    }

    if ($practice) $system .= " The user is practicing $practice. Reply primarily in $practice with English hints in parentheses.";

    // Load last 10 messages
    $stmt = db()->prepare('SELECT messages FROM chat_sessions WHERE session_id = ?');
    $stmt->execute([$session_id]);
    $row = $stmt->fetch();
    $history = $row ? json_decode($row['messages'], true) : [];
    if (!is_array($history)) $history = [];

    $ctx = "";
    foreach (array_slice($history, -10) as $m) {
        $role = $m['role'] === 'user' ? 'User' : 'Chingu';
        $ctx .= "$role: " . $m['content'] . "\n";
    }
    $prompt = trim($ctx . "User: $message\nChingu:");
    $reply  = trim(llm_chat_text($system, $prompt));

    $now = now_dt();
    $history[] = ['role' => 'user', 'content' => $message, 'ts' => $now];
    $history[] = ['role' => 'assistant', 'content' => $reply, 'ts' => $now];
    db()->prepare('INSERT INTO chat_sessions (session_id, messages, practice_lang)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE messages = VALUES(messages), practice_lang = VALUES(practice_lang)')
        ->execute([$session_id, json_encode($history, JSON_UNESCAPED_UNICODE), $practice]);

    send_json([
        'session_id' => $session_id,
        'reply' => $reply,
        'credits' => $u ? credit_balance_for($u['id']) : null,
    ]);
}

function route_mobile_chat_history(string $session_id): void {
    $stmt = db()->prepare('SELECT messages FROM chat_sessions WHERE session_id = ?');
    $stmt->execute([$session_id]);
    $row = $stmt->fetch();
    $msgs = $row ? json_decode($row['messages'], true) : [];
    send_json(['session_id' => $session_id, 'messages' => $msgs ?: []]);
}

function route_mobile_chat_clear(string $session_id): void {
    db()->prepare('DELETE FROM chat_sessions WHERE session_id = ?')->execute([$session_id]);
    send_json(['ok' => true]);
}

// -------------------- Whisper STT (Speech-to-Text) --------------------
function _openai_key_for_voice(): string {
    return resolve_openai_key();
}

function route_mobile_transcribe(): void {
    $u = optional_user();

    $b = get_json_body();
    $audio_b64 = $b['audio_base64'] ?? '';
    if ($audio_b64 === '') send_error('audio_base64 is required', 400);
    $mime = strtolower($b['mime_type'] ?? 'audio/m4a');
    $lang = $b['language'] ?? null;

    // Decide extension from mime
    $ext = 'm4a';
    if (strpos($mime, 'wav')  !== false) $ext = 'wav';
    elseif (strpos($mime, 'webm') !== false) $ext = 'webm';
    elseif (strpos($mime, 'ogg')  !== false) $ext = 'ogg';
    elseif (strpos($mime, 'mp3')  !== false || strpos($mime, 'mpeg') !== false) $ext = 'mp3';

    $bytes = base64_decode($audio_b64, true);
    if ($bytes === false || strlen($bytes) < 100) send_error('Invalid base64 audio (too small)', 400);

    $tmp = tempnam(sys_get_temp_dir(), 'aud_') . '.' . $ext;
    file_put_contents($tmp, $bytes);

    $deepgramKey = resolve_deepgram_key();
    $deepgramModel = trim((string)(setting_value('deepgram_stt_model', 'nova-2') ?? 'nova-2'));
    $query = ['model=' . urlencode($deepgramModel), 'smart_format=true', 'punctuate=true'];
    if ($lang && $lang !== 'auto') {
        $query[] = 'language=' . urlencode(explode('-', $lang)[0]);
    }

    $audioBinary = file_get_contents($tmp);
    $r = http_raw('https://api.deepgram.com/v1/listen?' . implode('&', $query), [
        "Authorization: Token $deepgramKey",
        "Content-Type: $mime",
    ], $audioBinary, 90);
    @unlink($tmp);

    if ($r['code'] >= 400) {
        $err = json_decode($r['body'], true);
        $msg = $err['error']['message'] ?? "HTTP {$r['code']}";
        send_error("Deepgram transcription failed: $msg", 502);
    }
    $data = json_decode($r['body'], true);
    $text = trim((string)($data['results']['channels'][0]['alternatives'][0]['transcript'] ?? ''));
    send_json([
        'text' => $text,
        'language' => $lang,
        'provider' => 'deepgram',
        'credits' => $u ? credit_balance_for($u['id']) : null,
    ]);
}

// -------------------- OpenAI TTS (Text-to-Speech) --------------------
function route_mobile_tts(): void {
    $u = optional_user();

    $b = get_json_body();
    $text = trim((string)($b['text'] ?? ''));
    if ($text === '') send_error('Text is empty', 400);
    $voice = $b['voice'] ?? null;
    $target = preferred_target_language($b);
    $speed = isset($b['speed']) ? (float)$b['speed'] : 1.0;

    $primaryGoogleKey = trim((string)(setting_value('google_tts_api_key', '') ?? ''));
    $googleVoice = trim((string)($voice ?: setting_value('google_tts_voice_name', '') ?: language_voice_for($target) ?: ''));
    $targetNorm = normalize_locale_code($target) ?: 'en';
    $googleLanguageCode = strlen($targetNorm) === 2 ? strtoupper($targetNorm) === 'EN' ? 'en-US' : ($targetNorm . '-' . strtoupper($targetNorm)) : 'en-US';
    $googleBody = [
        'input' => ['text' => mb_substr($text, 0, 4000)],
        'audioConfig' => [
            'audioEncoding' => 'MP3',
            'speakingRate' => max(0.25, min(4.0, $speed)),
        ],
        'voice' => [
            'languageCode' => $googleLanguageCode,
        ],
    ];
    if ($googleVoice !== '') {
        $googleBody['voice']['name'] = $googleVoice;
    }

    if ($primaryGoogleKey !== '') {
        $googleUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' . urlencode($primaryGoogleKey);
        $googleRes = http_raw($googleUrl, ['Content-Type: application/json'], json_encode($googleBody, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 60);
        if ($googleRes['code'] < 400) {
            $data = safe_json_decode($googleRes['body'], []);
            $audio = trim((string)($data['audioContent'] ?? ''));
            if ($audio !== '') {
                send_json([
                    'audio_base64' => $audio,
                    'mime' => 'audio/mpeg',
                    'provider' => 'google',
                    'credits' => $u ? credit_balance_for($u['id']) : null,
                ]);
            }
        }
    }

    // OpenAI fallback
    $openaiVoice = $voice ?: language_voice_for($target) ?: 'nova';
    $openaiModel = trim((string)(setting_value('openai_tts_fallback_model', 'tts-1') ?? 'tts-1'));
    $openaiKey = _openai_key_for_voice();
    $payload = json_encode([
        'model' => $openaiModel,
        'voice' => $openaiVoice,
        'input' => mb_substr($text, 0, 4000),
        'speed' => max(0.25, min(4.0, $speed)),
        'response_format' => 'mp3',
    ]);
    $r = http_raw('https://api.openai.com/v1/audio/speech', [
        "Authorization: Bearer $openaiKey",
        'Content-Type: application/json',
    ], $payload, 60);

    if ($r['code'] >= 400) {
        $err = json_decode($r['body'], true);
        $msg = $err['error']['message'] ?? "HTTP {$r['code']}";
        send_error("TTS failed: $msg", 502);
    }
    send_json([
        'audio_base64' => base64_encode($r['body']),
        'mime' => 'audio/mpeg',
        'provider' => 'openai',
        'credits' => $u ? credit_balance_for($u['id']) : null,
    ]);
}

function route_mobile_history_create(): void {
    $u = optional_user();
    $b = get_json_body();
    $id = uuid();
    $stmt = db()->prepare('INSERT INTO translations (id, user_id, kind, source_text, translated_text, source_lang, target_lang, favorite) VALUES (?,?,?,?,?,?,?,0)');
    $stmt->execute([$id, $u['id'] ?? null, $b['kind'] ?? 'text', $b['source_text'] ?? '', $b['translated_text'] ?? '', $b['source_lang'] ?? '', $b['target_lang'] ?? '']);
    $get = db()->prepare('SELECT * FROM translations WHERE id = ?'); $get->execute([$id]);
    send_json($get->fetch());
}

function route_mobile_history_list(): void {
    $u = optional_user();
    if ($u) {
        $stmt = db()->prepare('SELECT * FROM translations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
        $stmt->execute([$u['id']]);
    } else {
        $stmt = db()->query('SELECT * FROM translations ORDER BY created_at DESC LIMIT 50');
    }
    send_json(['items' => $stmt->fetchAll()]);
}

function route_mobile_history_delete(string $id): void {
    db()->prepare('DELETE FROM translations WHERE id = ?')->execute([$id]);
    send_json(['ok' => true]);
}

function route_mobile_history_favorite(string $id): void {
    $stmt = db()->prepare('SELECT favorite FROM translations WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) send_error('Not found', 404);
    $new = $row['favorite'] ? 0 : 1;
    db()->prepare('UPDATE translations SET favorite = ? WHERE id = ?')->execute([$new, $id]);
    send_json(['id' => $id, 'favorite' => (bool)$new]);
}

function route_mobile_credits_me(): void {
    $u = require_user_or_401();
    $credits = credit_balance_for($u['id']);
    send_json([
        'user_id' => $u['id'],
        'credits' => $credits,
        'is_pro' => (bool)($u['is_pro'] ?? false),
        'has_active_subscription' => has_active_subscription($u['id']),
    ]);
}

function route_mobile_credits_reward(): void {
    $u = require_user_or_401();
    $b = get_json_body();
    $source = trim((string)($b['source'] ?? 'admob_rewarded'));
    $adUnit = trim((string)($b['ad_unit_id'] ?? ''));
    $rewardAmount = isset($b['reward_amount']) ? (int)$b['reward_amount'] : 5;
    if ($rewardAmount <= 0) $rewardAmount = 5;

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT credits FROM users WHERE id = ? FOR UPDATE');
        $stmt->execute([$u['id']]);
        $row = $stmt->fetch();
        if (!$row) {
            $pdo->rollBack();
            send_error('User not found', 404);
        }
        $current = (int)$row['credits'];
        $next = $current + $rewardAmount;
        $pdo->prepare('UPDATE users SET credits = ? WHERE id = ?')->execute([$next, $u['id']]);
        $pdo->prepare('INSERT INTO credit_events (id, user_id, action_type, amount, balance_after, meta_json) VALUES (?,?,?,?,?,?)')
            ->execute([
                uuid(),
                $u['id'],
                'rewarded_ad',
                $rewardAmount,
                $next,
                json_encode(['source' => $source, 'ad_unit_id' => $adUnit], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        $pdo->commit();
        send_json(['ok' => true, 'credits' => $next, 'awarded' => $rewardAmount]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function route_mobile_credits_events(): void {
    $u = require_user_or_401();
    $stmt = db()->prepare('SELECT id, action_type, amount, balance_after, meta_json, created_at FROM credit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 40');
    $stmt->execute([$u['id']]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['amount'] = (int)$r['amount'];
        $r['balance_after'] = (int)$r['balance_after'];
        $r['meta'] = $r['meta_json'] ? safe_json_decode((string)$r['meta_json'], []) : [];
        unset($r['meta_json']);
    }
    send_json(['items' => $rows]);
}

function streak_reward_for_days(int $days): int {
    $base = (int)(setting_value('daily_streak_base_reward', 5) ?? 5);
    $maxBonus = (int)(setting_value('daily_streak_max_bonus', 5) ?? 5);
    if ($base <= 0) $base = 5;
    if ($maxBonus < 0) $maxBonus = 0;
    $bonus = min(max(0, $days - 1), $maxBonus);
    return $base + $bonus;
}

function route_mobile_streak_status(): void {
    $u = require_user_or_401();
    $today = gmdate('Y-m-d');
    $yesterday = gmdate('Y-m-d', time() - 86400);

    $stmt = db()->prepare('SELECT streak_days, last_claim_date, last_reward FROM daily_streaks WHERE user_id = ? LIMIT 1');
    $stmt->execute([$u['id']]);
    $row = $stmt->fetch();

    $streakDays = (int)($row['streak_days'] ?? 0);
    $lastClaim = $row['last_claim_date'] ?? null;
    $canClaim = $lastClaim !== $today;
    $nextDays = $canClaim ? (($lastClaim === $yesterday) ? $streakDays + 1 : 1) : $streakDays;
    $nextReward = streak_reward_for_days(max(1, $nextDays));

    send_json([
        'streak_days' => $streakDays,
        'last_claim_date' => $lastClaim,
        'can_claim_today' => $canClaim,
        'next_reward' => $nextReward,
        'credits' => credit_balance_for($u['id']),
    ]);
}

function route_mobile_streak_claim(): void {
    $u = require_user_or_401();
    $today = gmdate('Y-m-d');
    $yesterday = gmdate('Y-m-d', time() - 86400);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT streak_days, last_claim_date FROM daily_streaks WHERE user_id = ? FOR UPDATE');
        $stmt->execute([$u['id']]);
        $row = $stmt->fetch();

        $streakDays = (int)($row['streak_days'] ?? 0);
        $lastClaim = $row['last_claim_date'] ?? null;
        if ($lastClaim === $today) {
            $pdo->rollBack();
            send_error('Daily streak already claimed today', 409);
        }

        $newDays = ($lastClaim === $yesterday) ? ($streakDays + 1) : 1;
        $reward = streak_reward_for_days($newDays);

        $pdo->prepare('INSERT INTO daily_streaks (user_id, streak_days, last_claim_date, last_reward) VALUES (?,?,?,?)
                       ON DUPLICATE KEY UPDATE streak_days = VALUES(streak_days), last_claim_date = VALUES(last_claim_date), last_reward = VALUES(last_reward)')
            ->execute([$u['id'], $newDays, $today, $reward]);

        $creditStmt = $pdo->prepare('SELECT credits FROM users WHERE id = ? FOR UPDATE');
        $creditStmt->execute([$u['id']]);
        $creditRow = $creditStmt->fetch();
        $current = (int)($creditRow['credits'] ?? 0);
        $next = $current + $reward;
        $pdo->prepare('UPDATE users SET credits = ? WHERE id = ?')->execute([$next, $u['id']]);

        $pdo->prepare('INSERT INTO credit_events (id, user_id, action_type, amount, balance_after, meta_json) VALUES (?,?,?,?,?,?)')
            ->execute([
                uuid(),
                $u['id'],
                'daily_streak_bonus',
                $reward,
                $next,
                json_encode(['streak_days' => $newDays], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);

        $pdo->commit();
        send_json([
            'ok' => true,
            'streak_days' => $newDays,
            'reward' => $reward,
            'credits' => $next,
            'claimed_on' => $today,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function route_mobile_subscription_verify(): void {
    $u = require_user_or_401();
    $b = get_json_body();
    $productId = trim((string)($b['product_id'] ?? ''));
    $purchaseToken = trim((string)($b['purchase_token'] ?? ''));
    $packageName = trim((string)($b['package_name'] ?? setting_value('google_play_package_name', '')));
    if ($productId === '' || $purchaseToken === '') {
        send_error('product_id and purchase_token are required', 400);
    }

    $subscriptionId = uuid();
    $stmt = db()->prepare('INSERT INTO user_subscriptions (id, user_id, platform, product_id, purchase_token, status, raw_response)
                           VALUES (?, ?, ?, ?, ?, ?, ?)
                           ON DUPLICATE KEY UPDATE product_id = VALUES(product_id), purchase_token = VALUES(purchase_token), status = VALUES(status), raw_response = VALUES(raw_response), updated_at = NOW()');
    $stmt->execute([
        $subscriptionId,
        $u['id'],
        'google_play',
        $productId,
        $purchaseToken,
        'active',
        json_encode(['package_name' => $packageName, 'raw_payload' => $b], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    db()->prepare('UPDATE users SET is_pro = 1 WHERE id = ?')->execute([$u['id']]);
    write_credit_event($u['id'], 'subscription_activated', 0, credit_balance_for($u['id']), ['product_id' => $productId]);

    send_json([
        'ok' => true,
        'status' => 'active',
        'product_id' => $productId,
        'package_name' => $packageName,
        'verification' => 'pending-server-verification',
    ]);
}

function route_mobile_module_content(): void {
    $u = optional_user();
    try_consume_credit($u, 'module_generate', ['surface' => 'modules']);

    $b = get_json_body();
    $module = strtolower(trim((string)($b['module'] ?? 'tutorial')));
    $allowed = ['tutorial', 'learn', 'roleplay'];
    if (!in_array($module, $allowed, true)) send_error('Unsupported module', 400);

    $topic = trim((string)($b['topic'] ?? 'daily conversation'));
    $level = trim((string)($b['level'] ?? 'beginner'));
    $locale = normalize_locale_code((string)($b['app_locale'] ?? $b['target_lang'] ?? 'en')) ?: 'en';

    $prompt = "Generate practical {$module} content for language learners. "
        . "Locale: {$locale}. Topic: {$topic}. Level: {$level}. "
        . "Return strict JSON with fields: title, intro, steps(array of objects with heading/body), practice_prompts(array), quick_quiz(array of {question,answer}).";

    $promptHash = hash('sha256', $module . '|' . $locale . '|' . $topic . '|' . $level);

    $cacheStmt = db()->prepare('SELECT payload_json, expires_at FROM module_content_cache WHERE module_key = ? AND locale_code = ? AND prompt_hash = ? LIMIT 1');
    $cacheStmt->execute([$module, $locale, $promptHash]);
    $cached = $cacheStmt->fetch();
    if ($cached && strtotime((string)$cached['expires_at']) > time()) {
        $payload = safe_json_decode((string)$cached['payload_json'], []);
        send_json(['module' => $module, 'locale' => $locale, 'cached' => true, 'content' => $payload]);
    }

    $geminiKey = resolve_gemini_key(false);
    $geminiModel = trim((string)(setting_value('gemini_content_model', 'gemini-2.5-flash') ?? 'gemini-2.5-flash'));
    $cacheHours = (int)(setting_value('module_content_cache_hours', 24) ?? 24);
    if ($cacheHours <= 0) $cacheHours = 24;

    if ($geminiKey === '') {
        $fallback = [
            'title' => ucfirst($module) . ' Starter Pack',
            'intro' => 'No Gemini key found. Showing cached-ready starter content. Add gemini_api_key in Admin Settings for dynamic generation.',
            'steps' => [
                ['heading' => 'Warm-up', 'body' => 'Say 3 simple sentences in your target language.'],
                ['heading' => 'Role cue', 'body' => 'Practice one real-world scenario for 2 minutes.'],
                ['heading' => 'Reflection', 'body' => 'List one correction and one phrase to reuse tomorrow.'],
            ],
            'practice_prompts' => [
                'Introduce yourself naturally.',
                'Ask for help politely.',
                'Describe your plan for today.',
            ],
            'quick_quiz' => [
                ['question' => 'How do you greet politely?', 'answer' => 'Use a formal greeting + smile.'],
            ],
        ];
        send_json(['module' => $module, 'locale' => $locale, 'cached' => false, 'content' => $fallback, 'fallback' => true]);
    }

    $geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' . $geminiModel . ':generateContent?key=' . urlencode($geminiKey);
    $geminiBody = [
        'contents' => [[
            'role' => 'user',
            'parts' => [['text' => $prompt]],
        ]],
    ];

    $resp = http_raw($geminiUrl, ['Content-Type: application/json'], json_encode($geminiBody, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 80);
    if ($resp['code'] >= 400) {
        $err = safe_json_decode((string)$resp['body'], []);
        $msg = $err['error']['message'] ?? "HTTP {$resp['code']}";
        send_error("Gemini content generation failed: {$msg}", 502);
    }

    $data = safe_json_decode((string)$resp['body'], []);
    $rawText = trim((string)($data['candidates'][0]['content']['parts'][0]['text'] ?? ''));
    if (str_starts_with($rawText, '```')) {
        $rawText = trim($rawText, "` \n\r\t");
        if (stripos($rawText, 'json') === 0) $rawText = trim(substr($rawText, 4));
    }
    $payload = safe_json_decode($rawText, null);
    if (!is_array($payload)) {
        $payload = [
            'title' => ucfirst($module) . ' · ' . ucfirst($topic),
            'intro' => $rawText,
            'steps' => [],
            'practice_prompts' => [],
            'quick_quiz' => [],
        ];
    }

    $expiresAt = date('Y-m-d H:i:s', time() + ($cacheHours * 3600));
    db()->prepare('INSERT INTO module_content_cache (module_key, locale_code, prompt_hash, payload_json, model_name, expires_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), model_name = VALUES(model_name), expires_at = VALUES(expires_at), created_at = NOW()')
        ->execute([
            $module,
            $locale,
            $promptHash,
            json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $geminiModel,
            $expiresAt,
        ]);

    send_json(['module' => $module, 'locale' => $locale, 'cached' => false, 'content' => $payload]);
}

// -------------------- mobile-user auth --------------------
function route_mobile_register(): void {
    $b = get_json_body();
    $email = strtolower(trim($b['email'] ?? ''));
    $pass  = $b['password'] ?? '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 6) send_error('Invalid email or password too short', 400);
    $chk = db()->prepare('SELECT id FROM users WHERE email = ?'); $chk->execute([$email]);
    if ($chk->fetch()) send_error('Email already registered', 409);
    $id = uuid();
    db()->prepare('INSERT INTO users (id, email, name, password_hash, is_pro, credits, is_banned) VALUES (?,?,?,?,0,50,0)')
       ->execute([$id, $email, $b['name'] ?? null, password_hash_bcrypt($pass)]);
    write_credit_event($id, 'signup_bonus', 50, 50, ['source' => 'register']);
    send_json([
        'access_token' => create_user_token($id, $email),
        'user' => ['id' => $id, 'email' => $email, 'name' => $b['name'] ?? null, 'credits' => 50, 'is_pro' => false],
    ]);
}

function route_mobile_login(): void {
    $b = get_json_body();
    $email = strtolower(trim($b['email'] ?? ''));
    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $u = $stmt->fetch();
    if (!$u || !password_verify_bcrypt($b['password'] ?? '', $u['password_hash'])) send_error('Invalid credentials', 401);
    if ((int)$u['is_banned'] === 1) send_error('Your account has been suspended. Please contact support.', 403);
    send_json([
        'access_token' => create_user_token($u['id'], $email),
        'user' => [
            'id' => $u['id'],
            'email' => $email,
            'name' => $u['name'],
            'is_pro' => (bool)$u['is_pro'],
            'credits' => (int)($u['credits'] ?? 0),
        ],
    ]);
}

function route_mobile_me(): void {
    $u = optional_user();
    if (!$u) send_error('Missing or invalid token', 401);
    if ((int)$u['is_banned'] === 1) send_error('Your account has been suspended', 403);
    $u['is_pro'] = (bool)$u['is_pro'];
    $u['credits'] = (int)($u['credits'] ?? 0);
    $u['has_active_subscription'] = has_active_subscription($u['id']);
    send_json($u);
}

function route_mobile_delete_account(): void {
    $u = optional_user();
    if (!$u) { send_json(['deleted' => true, 'guest' => true]); }
    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]);
    send_json(['deleted' => true, 'guest' => false, 'user_id' => $u['id']]);
}
