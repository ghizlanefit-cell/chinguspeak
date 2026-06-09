<?php
// ============================================================
// ChinguSpeak Admin Backend — single front controller (Hostinger ready)
// ============================================================

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/jwt.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/seed.php';

require_once __DIR__ . '/api/auth.php';
require_once __DIR__ . '/api/admins.php';
require_once __DIR__ . '/api/llm_keys.php';
require_once __DIR__ . '/api/settings.php';
require_once __DIR__ . '/api/users.php';
require_once __DIR__ . '/api/languages.php';
require_once __DIR__ . '/api/scenarios.php';
require_once __DIR__ . '/api/styles.php';
require_once __DIR__ . '/api/dashboard.php';
require_once __DIR__ . '/api/broadcast.php';
require_once __DIR__ . '/api/mobile.php';

cors();

// Idempotent seed at startup
try {
    ensure_premium_schema();
    ensure_seed_admin();
    ensure_seed_content();
} catch (Throwable $e) {
    // If seeding fails (e.g. tables not yet imported) we keep going to surface a clean error from the actual endpoint.
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri    = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');

// Normalize path: strip everything up to and including "/api/"
$apiIdx = strpos($uri, '/api/');
if ($apiIdx === false) {
    // also support exact "/api"
    if (rtrim($uri, '/') === '/api') $path = '';
    else send_error('Not found', 404);
} else {
    $path = trim(substr($uri, $apiIdx + 5), '/');
}

$segments = $path === '' ? [] : explode('/', $path);

// =======================
// Route table
// =======================
$s0 = $segments[0] ?? '';
$s1 = $segments[1] ?? '';
$s2 = $segments[2] ?? '';

try {
    switch ($s0) {
        case '':
            send_json(['service' => 'chinguspeak-admin-api', 'status' => 'ok']);
        case 'health':
            send_json(['status' => 'ok', 'ts' => now_dt()]);

        case 'admin-auth':
            if ($s1 === 'login'  && $method === 'POST')  route_auth_login();
            if ($s1 === 'me'     && $method === 'GET')   route_auth_me();
            if ($s1 === 'logout' && $method === 'POST')  route_auth_logout();
            break;

        case 'auth':
            // Mobile-app user auth (mirrors FastAPI /api/auth/*)
            if ($s1 === 'register'        && $method === 'POST')   route_mobile_register();
            if ($s1 === 'login'           && $method === 'POST')   route_mobile_login();
            if ($s1 === 'me'              && $method === 'GET')    route_mobile_me();
            if ($s1 === 'delete-account'  && $method === 'DELETE') route_mobile_delete_account();
            break;

        case 'admins':
            if (!$s1 && $method === 'GET')    route_admins_list();
            if (!$s1 && $method === 'POST')   route_admins_create();
            if ($s1 && $method === 'PATCH')   route_admins_update($s1);
            if ($s1 && $method === 'DELETE')  route_admins_delete($s1);
            break;

        case 'llm-keys':
            if (!$s1 && $method === 'GET')    route_llm_keys_list();
            if (!$s1 && $method === 'POST')   route_llm_keys_create();
            if ($s1 && !$s2 && $method === 'PATCH')  route_llm_keys_update($s1);
            if ($s1 && !$s2 && $method === 'DELETE') route_llm_keys_delete($s1);
            if ($s1 && $s2 === 'test' && $method === 'POST') route_llm_keys_test($s1);
            break;

        case 'settings':
            if (!$s1 && $method === 'GET')  route_settings_list();
            if ($s1 && $method === 'PUT')   route_settings_upsert($s1);
            if ($s1 && $method === 'DELETE')route_settings_delete($s1);
            break;

        case 'users':
            if (!$s1 && $method === 'GET')   route_users_list();
            if ($s1 && $method === 'PATCH')  route_users_update($s1);
            if ($s1 && $method === 'DELETE') route_users_delete($s1);
            break;

        case 'languages':
            if (!$s1 && $method === 'GET')   route_languages_list();
            if (!$s1 && $method === 'POST')  route_languages_create();
            if ($s1 && $method === 'PATCH')  route_languages_update($s1);
            if ($s1 && $method === 'DELETE') route_languages_delete($s1);
            break;

        case 'scenarios':
            if (!$s1 && $method === 'GET')   route_scenarios_list();
            if (!$s1 && $method === 'POST')  route_scenarios_create();
            if ($s1 && $method === 'PATCH')  route_scenarios_update($s1);
            if ($s1 && $method === 'DELETE') route_scenarios_delete($s1);
            break;

        case 'styles':
            if (!$s1 && $method === 'GET')   route_styles_list();
            if (!$s1 && $method === 'POST')  route_styles_create();
            if ($s1 && !$s2 && $method === 'PATCH')  route_styles_update($s1);
            if ($s1 && !$s2 && $method === 'DELETE') route_styles_delete($s1);
            if ($s1 && $s2 === 'apply' && $method === 'POST') route_styles_apply($s1);
            break;

        case 'dashboard':
            if ($s1 === 'overview'  && $method === 'GET') route_dashboard_overview();
            if ($s1 === 'top-users' && $method === 'GET') route_dashboard_top_users();
            break;

        case 'broadcast':
            if (!$s1 && $method === 'GET')  route_broadcast_list();
            if (!$s1 && $method === 'POST') route_broadcast_create();
            break;

        case 'export':
            if ($method === 'GET') route_export();
            break;

        // --------- PUBLIC config (mobile app) ---------
        case 'public':
            if ($s1 === 'active-llm'    && $method === 'GET') route_public_active_llm();
            if ($s1 === 'languages'     && $method === 'GET') route_public_languages();
            if ($s1 === 'scenarios'     && $method === 'GET') route_public_scenarios();
            if ($s1 === 'active-style'  && $method === 'GET') route_public_active_style();
            if ($s1 === 'settings'      && $method === 'GET') route_public_settings();
            break;

        // --------- MOBILE-APP endpoints ---------
        case 'ping':
            if ($method === 'GET')  route_mobile_ping();
            break;
        case 'translate':
            if ($method === 'POST') route_mobile_translate();
            break;
        case 'translate-image':
            if ($method === 'POST') route_mobile_translate_image();
            break;
        case 'transcribe':
            if ($method === 'POST') route_mobile_transcribe();
            break;
        case 'tts':
            if ($method === 'POST') route_mobile_tts();
            break;
        case 'chat':
            if (!$s1 && $method === 'POST') route_mobile_chat();
            if ($s1 && $s2 === 'history' && $method === 'GET') route_mobile_chat_history($s1);
            if ($s1 && !$s2 && $method === 'DELETE') route_mobile_chat_clear($s1);
            break;
        case 'credits':
            if ($s1 === 'me' && $method === 'GET') route_mobile_credits_me();
            if ($s1 === 'reward' && $method === 'POST') route_mobile_credits_reward();
            if ($s1 === 'events' && $method === 'GET') route_mobile_credits_events();
            break;
        case 'streak':
            if ($s1 === 'status' && $method === 'GET') route_mobile_streak_status();
            if ($s1 === 'claim' && $method === 'POST') route_mobile_streak_claim();
            break;
        case 'subscriptions':
            if ($s1 === 'verify' && $method === 'POST') route_mobile_subscription_verify();
            break;
        case 'modules':
            if ($s1 === 'content' && $method === 'POST') route_mobile_module_content();
            break;
        case 'history':
            if (!$s1 && $method === 'POST') route_mobile_history_create();
            if (!$s1 && $method === 'GET')  route_mobile_history_list();
            if ($s1 && !$s2 && $method === 'DELETE') route_mobile_history_delete($s1);
            if ($s1 && $s2 === 'favorite' && $method === 'POST') route_mobile_history_favorite($s1);
            break;

        // --------- USER auth (mobile) ---------
        // Note: case 'auth' is reserved for mobile user auth.
        // The earlier `case 'auth'` was changed to 'admin-auth' for admin endpoints.
    }
    send_error('Not found: ' . $method . ' /api/' . $path, 404);
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}
