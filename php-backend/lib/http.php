<?php
function send_json($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function send_error(string $detail, int $status = 400): void {
    send_json(['detail' => $detail], $status);
}

function get_json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $body = json_decode($raw, true);
    return is_array($body) ? $body : [];
}

function cors(): void {
    $origin = CORS_ORIGIN;
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With");
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function get_bearer_token(): ?string {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$auth && function_exists('apache_request_headers')) {
        $h = apache_request_headers();
        $auth = $h['Authorization'] ?? $h['authorization'] ?? '';
    }
    if (stripos($auth, 'Bearer ') === 0) {
        return trim(substr($auth, 7));
    }
    return null;
}

function mask_key(string $k): string {
    if ($k === '') return '';
    if (strlen($k) <= 8) return str_repeat('*', strlen($k));
    return substr($k, 0, 4) . str_repeat('*', strlen($k) - 8) . substr($k, -4);
}

function bool_field($v): bool {
    if (is_bool($v)) return $v;
    if (is_int($v)) return $v !== 0;
    if (is_string($v)) return in_array(strtolower($v), ['1','true','yes','on'], true);
    return (bool)$v;
}

function coerce_setting_value($raw) {
    // Try to decode JSON; if it parses to scalar/array, return that. Otherwise return raw string.
    $decoded = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE) return $decoded;
    return $raw;
}
