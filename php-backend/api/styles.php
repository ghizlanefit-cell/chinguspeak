<?php
// =================== STYLES endpoints ===================

function route_styles_list(): void {
    require_admin();
    $rows = db()->query('SELECT * FROM styles ORDER BY created_at')->fetchAll();
    foreach ($rows as &$r) $r['is_active'] = (bool)$r['is_active'];
    send_json(['items' => $rows]);
}

function route_styles_create(): void {
    require_admin();
    $b = get_json_body();
    if (empty($b['name'])) send_error('name required', 400);
    $id = uuid();
    $stmt = db()->prepare('INSERT INTO styles (id, name, primary_color, secondary_color, background, is_active, preview_image) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([$id, $b['name'], $b['primary_color'] ?? '#7C3AED', $b['secondary_color'] ?? '#EC4899', $b['background'] ?? '#0A0514', !empty($b['is_active']) ? 1 : 0, $b['preview_image'] ?? null]);
    $get = db()->prepare('SELECT * FROM styles WHERE id = ?'); $get->execute([$id]);
    send_json($get->fetch());
}

function route_styles_update(string $id): void {
    require_admin();
    $b = get_json_body();
    $sets = []; $vals = [];
    foreach (['name','primary_color','secondary_color','background','is_active','preview_image'] as $k) {
        if (!array_key_exists($k, $b)) continue;
        $val = $b[$k];
        if ($k === 'is_active') $val = bool_field($val) ? 1 : 0;
        $sets[] = "`$k` = ?"; $vals[] = $val;
    }
    if (!$sets) send_json(['ok' => true]);
    $vals[] = $id;
    $stmt = db()->prepare('UPDATE styles SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($vals);
    send_json(['ok' => true]);
}

function route_styles_delete(string $id): void {
    require_admin();
    db()->prepare('DELETE FROM styles WHERE id = ?')->execute([$id]);
    send_json(['deleted' => 1]);
}

function route_styles_apply(string $id): void {
    require_admin();
    db()->query('UPDATE styles SET is_active = 0');
    $stmt = db()->prepare('UPDATE styles SET is_active = 1 WHERE id = ?');
    $stmt->execute([$id]);
    send_json(['ok' => true]);
}
