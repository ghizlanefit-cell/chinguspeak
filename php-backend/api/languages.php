<?php
// =================== LANGUAGES endpoints ===================

function route_languages_list(): void {
    require_admin();
    $rows = db()->query('SELECT * FROM languages ORDER BY name')->fetchAll();
    foreach ($rows as &$r) $r['is_active'] = (bool)$r['is_active'];
    send_json(['items' => $rows]);
}

function route_languages_create(): void {
    require_admin();
    $b = get_json_body();
    if (empty($b['code']) || empty($b['name'])) send_error('code and name required', 400);
    $exists = db()->prepare('SELECT code FROM languages WHERE code = ?');
    $exists->execute([$b['code']]);
    if ($exists->fetch()) send_error('Language code already exists', 409);
    $stmt = db()->prepare('INSERT INTO languages (code, name, flag, tts_voice, is_active) VALUES (?,?,?,?,?)');
    $stmt->execute([$b['code'], $b['name'], $b['flag'] ?? null, $b['tts_voice'] ?? 'alloy', !empty($b['is_active']) ? 1 : 0]);
    send_json($b);
}

function route_languages_update(string $code): void {
    require_admin();
    $b = get_json_body();
    $sets = []; $vals = [];
    foreach (['name', 'flag', 'tts_voice', 'is_active'] as $k) {
        if (!array_key_exists($k, $b)) continue;
        $val = $b[$k];
        if ($k === 'is_active') $val = bool_field($val) ? 1 : 0;
        $sets[] = "`$k` = ?"; $vals[] = $val;
    }
    if (!$sets) send_json(['ok' => true]);
    $vals[] = $code;
    $stmt = db()->prepare('UPDATE languages SET ' . implode(', ', $sets) . ' WHERE code = ?');
    $stmt->execute($vals);
    send_json(['ok' => true]);
}

function route_languages_delete(string $code): void {
    require_admin();
    $stmt = db()->prepare('DELETE FROM languages WHERE code = ?');
    $stmt->execute([$code]);
    send_json(['deleted' => $stmt->rowCount()]);
}
