<?php
// Minimal self-contained HS256 JWT (no Composer needed — works on Hostinger out of the box).

function jwt_b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function jwt_b64url_decode(string $data): string {
    $pad = strlen($data) % 4;
    if ($pad) $data .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwt_encode(array $payload, string $secret = null, string $algo = null): string {
    $secret = $secret ?: JWT_SECRET;
    $algo = $algo ?: JWT_ALGO;
    $header = ['typ' => 'JWT', 'alg' => $algo];
    $h = jwt_b64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES));
    $p = jwt_b64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
    $signature = hash_hmac('sha256', "$h.$p", $secret, true);
    $s = jwt_b64url_encode($signature);
    return "$h.$p.$s";
}

function jwt_decode(string $token, string $secret = null): ?array {
    $secret = $secret ?: JWT_SECRET;
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$h, $p, $s] = $parts;
    $expected = jwt_b64url_encode(hash_hmac('sha256', "$h.$p", $secret, true));
    if (!hash_equals($expected, $s)) return null;
    $payload = json_decode(jwt_b64url_decode($p), true);
    if (!is_array($payload)) return null;
    if (isset($payload['exp']) && time() >= (int)$payload['exp']) return null;
    return $payload;
}
