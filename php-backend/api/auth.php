<?php
// =================== AUTH endpoints ===================

function route_auth_login(): void {
    $body = get_json_body();
    $email = strtolower(trim($body['email'] ?? ''));
    $pass  = $body['password'] ?? '';
    if (!$email || !$pass) send_error('Email and password are required', 400);
    if (is_locked($email)) send_error('Too many failed attempts. Locked for ' . LOCKOUT_MINUTES . ' minutes.', 423);

    $stmt = db()->prepare('SELECT id, email, name, role, password_hash FROM admins WHERE email = ?');
    $stmt->execute([$email]);
    $admin = $stmt->fetch();
    if (!$admin || !password_verify_bcrypt($pass, $admin['password_hash'])) {
        record_failure($email);
        send_error('Invalid email or password', 401);
    }
    clear_failures($email);

    $token = create_admin_token($admin['id'], $admin['email']);
    unset($admin['password_hash']);
    send_json([
        'access_token' => $token,
        'token_type'   => 'bearer',
        'admin'        => $admin,
    ]);
}

function route_auth_me(): void {
    $admin = require_admin();
    send_json(['admin' => $admin]);
}

function route_auth_logout(): void {
    require_admin();
    send_json(['ok' => true]);
}
