<?php
// =================== USERS endpoints ===================

function route_users_list(): void {
    require_admin();
    $q = trim($_GET['q'] ?? '');
    $limit = (int)($_GET['limit'] ?? 200);
    if ($q !== '') {
        $stmt = db()->prepare('SELECT id, email, name, country_flag, is_pro, credits, is_banned, conversations_count, time_spent_minutes, progress, created_at
                               FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT ?');
        $like = '%' . $q . '%';
        $stmt->bindValue(1, $like);
        $stmt->bindValue(2, $like);
        $stmt->bindValue(3, $limit, PDO::PARAM_INT);
        $stmt->execute();
    } else {
        $stmt = db()->prepare('SELECT id, email, name, country_flag, is_pro, credits, is_banned, conversations_count, time_spent_minutes, progress, created_at
                               FROM users ORDER BY created_at DESC LIMIT ?');
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
    }
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['is_pro'] = (bool)$r['is_pro'];
        $r['is_banned'] = (bool)$r['is_banned'];
        $r['credits'] = (int)($r['credits'] ?? 0);
    }
    send_json(['items' => $rows]);
}

function route_users_update(string $id): void {
    require_admin();
    $b = get_json_body();
    $allowed = ['name', 'email', 'is_pro', 'is_banned', 'credits'];
    $sets = []; $vals = [];
    foreach ($allowed as $k) {
        if (!array_key_exists($k, $b)) continue;
        $val = $b[$k];
        if ($k === 'is_pro' || $k === 'is_banned') $val = bool_field($val) ? 1 : 0;
        if ($k === 'credits') $val = max(0, (int)$val);
        $sets[] = "`$k` = ?";
        $vals[] = $val;
    }
    if (!$sets) send_json(['ok' => true]);
    $vals[] = $id;
    $stmt = db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($vals);
    send_json(['ok' => true]);
}

function route_users_delete(string $id): void {
    require_admin();
    $stmt = db()->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$id]);
    send_json(['deleted' => $stmt->rowCount()]);
}
