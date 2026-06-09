<?php
// =================== ADMINS endpoints ===================

function route_admins_list(): void {
    require_admin();
    $rows = db()->query('SELECT id, email, name, role, created_at FROM admins ORDER BY created_at DESC')->fetchAll();
    send_json(['items' => $rows]);
}

function route_admins_create(): void {
    require_admin();
    $body = get_json_body();
    $email = strtolower(trim($body['email'] ?? ''));
    $pass  = $body['password'] ?? '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 6) {
        send_error('Invalid email or password (min 6 chars)', 400);
    }
    $exists = db()->prepare('SELECT id FROM admins WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) send_error('Admin email already exists', 409);

    $id = uuid();
    $stmt = db()->prepare('INSERT INTO admins (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$id, $email, explode('@', $email)[0], 'admin', password_hash_bcrypt($pass)]);
    send_json(['id' => $id, 'email' => $email, 'role' => 'admin']);
}

function route_admins_update(string $admin_id): void {
    require_admin();
    $body = get_json_body();
    $sets = [];
    $vals = [];
    if (!empty($body['name'])) { $sets[] = 'name = ?'; $vals[] = $body['name']; }
    if (!empty($body['password'])) { $sets[] = 'password_hash = ?'; $vals[] = password_hash_bcrypt($body['password']); }
    if (!$sets) send_json(['ok' => true]);
    $vals[] = $admin_id;
    $stmt = db()->prepare('UPDATE admins SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($vals);
    send_json(['ok' => true]);
}

function route_admins_delete(string $admin_id): void {
    $me = require_admin();
    if ($me['id'] === $admin_id) send_error('Cannot delete yourself', 400);
    $stmt = db()->prepare('DELETE FROM admins WHERE id = ?');
    $stmt->execute([$admin_id]);
    send_json(['deleted' => $stmt->rowCount()]);
}
