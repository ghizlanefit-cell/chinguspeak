<?php
// =================== BROADCAST + EXPORT endpoints ===================

function route_broadcast_create(): void {
    $admin = require_admin();
    $b = get_json_body();
    if (empty($b['title']) || empty($b['body'])) send_error('title and body required', 400);
    $id = uuid();
    $stmt = db()->prepare('INSERT INTO broadcasts (id, title, body, audience, sent_by) VALUES (?,?,?,?,?)');
    $stmt->execute([$id, $b['title'], $b['body'], $b['audience'] ?? 'all', $admin['email']]);
    send_json(['id' => $id, 'sent_by' => $admin['email'], 'ts' => now_dt()]);
}

function route_broadcast_list(): void {
    require_admin();
    $rows = db()->query('SELECT * FROM broadcasts ORDER BY ts DESC LIMIT 100')->fetchAll();
    send_json(['items' => $rows]);
}

function route_export(): void {
    require_admin();
    $kind = $_GET['kind'] ?? 'users';
    $fmt  = $_GET['fmt']  ?? 'json';
    $map = [
        'users'     => 'SELECT id, email, name, country_flag, is_pro, is_banned, created_at FROM users',
        'scenarios' => 'SELECT id, title, description, language, difficulty, is_active, created_at FROM scenarios',
        'languages' => 'SELECT code, name, flag, tts_voice, is_active FROM languages',
        'llm_keys'  => 'SELECT id, provider, label, model, balance, is_active, updated_at FROM llm_keys',
        'settings'  => 'SELECT `key`, `value`, category, description, updated_at FROM app_settings',
    ];
    if (!isset($map[$kind])) send_error('Unknown kind', 400);
    $rows = db()->query($map[$kind])->fetchAll();

    if ($fmt === 'json') send_json($rows);

    if ($fmt === 'csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $kind . '.csv"');
        $out = fopen('php://output', 'w');
        if ($rows) {
            fputcsv($out, array_keys($rows[0]));
            foreach ($rows as $r) fputcsv($out, $r);
        }
        fclose($out);
        exit;
    }
    send_error('fmt must be json or csv', 400);
}
