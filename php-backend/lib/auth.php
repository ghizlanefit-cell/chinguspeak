<?php
function require_admin(): array {
    $token = get_bearer_token();
    if (!$token) send_error('Missing admin token', 401);
    $payload = jwt_decode($token);
    if (!$payload || ($payload['scope'] ?? '') !== 'admin') send_error('Invalid or expired token', 401);
    $admin = db()->prepare('SELECT id, email, name, role, created_at FROM admins WHERE id = ?');
    $admin->execute([$payload['sub']]);
    $row = $admin->fetch();
    if (!$row) send_error('Admin not found', 401);
    return $row;
}

function create_admin_token(string $admin_id, string $email): string {
    return jwt_encode([
        'sub'   => $admin_id,
        'email' => $email,
        'scope' => 'admin',
        'iat'   => time(),
        'exp'   => time() + JWT_TTL_MIN * 60,
    ]);
}

function password_hash_bcrypt(string $plain): string {
    return password_hash($plain, PASSWORD_BCRYPT);
}

function password_verify_bcrypt(string $plain, string $hash): bool {
    return password_verify($plain, $hash);
}

function is_locked(string $identifier): bool {
    $cutoff = date('Y-m-d H:i:s', time() - LOCKOUT_MINUTES * 60);
    $stmt = db()->prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE identifier = ? AND attempted_at >= ?');
    $stmt->execute([$identifier, $cutoff]);
    $row = $stmt->fetch();
    return ((int)$row['c']) >= LOCKOUT_LIMIT;
}

function record_failure(string $identifier): void {
    $stmt = db()->prepare('INSERT INTO login_attempts (identifier) VALUES (?)');
    $stmt->execute([$identifier]);
    // House-keeping: keep only the recent attempts
    $cutoff = date('Y-m-d H:i:s', time() - 24 * 3600);
    db()->prepare('DELETE FROM login_attempts WHERE attempted_at < ?')->execute([$cutoff]);
}

function clear_failures(string $identifier): void {
    db()->prepare('DELETE FROM login_attempts WHERE identifier = ?')->execute([$identifier]);
}
