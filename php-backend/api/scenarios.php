<?php
// =================== SCENARIOS endpoints ===================

function route_scenarios_list(): void {
    require_admin();
    $rows = db()->query('SELECT * FROM scenarios ORDER BY created_at DESC')->fetchAll();
    foreach ($rows as &$r) $r['is_active'] = (bool)$r['is_active'];
    send_json(['items' => $rows]);
}

function route_scenarios_create(): void {
    require_admin();
    $b = get_json_body();
    if (empty($b['title'])) send_error('title required', 400);
    $id = uuid();
    $stmt = db()->prepare('INSERT INTO scenarios (id, title, description, language, difficulty, prompt, icon, is_active) VALUES (?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $id, $b['title'], $b['description'] ?? '', $b['language'] ?? 'en', $b['difficulty'] ?? 'beginner',
        $b['prompt'] ?? '', $b['icon'] ?? null, !empty($b['is_active']) ? 1 : 0
    ]);
    $get = db()->prepare('SELECT * FROM scenarios WHERE id = ?'); $get->execute([$id]);
    send_json($get->fetch());
}

function route_scenarios_update(string $id): void {
    require_admin();
    $b = get_json_body();
    $sets = []; $vals = [];
    foreach (['title','description','language','difficulty','prompt','icon','is_active'] as $k) {
        if (!array_key_exists($k, $b)) continue;
        $val = $b[$k];
        if ($k === 'is_active') $val = bool_field($val) ? 1 : 0;
        $sets[] = "`$k` = ?"; $vals[] = $val;
    }
    if (!$sets) send_json(['ok' => true]);
    $vals[] = $id;
    $stmt = db()->prepare('UPDATE scenarios SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($vals);
    send_json(['ok' => true]);
}

function route_scenarios_delete(string $id): void {
    require_admin();
    $stmt = db()->prepare('DELETE FROM scenarios WHERE id = ?');
    $stmt->execute([$id]);
    send_json(['deleted' => $stmt->rowCount()]);
}
