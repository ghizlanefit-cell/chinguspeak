<?php
// =================== SETTINGS endpoints ===================

function _setting_decode_row(array $r): array {
    $r['value'] = coerce_setting_value($r['value']);
    return $r;
}

function route_settings_list(): void {
    require_admin();
    $cat = $_GET['category'] ?? null;
    if ($cat) {
        $stmt = db()->prepare('SELECT * FROM app_settings WHERE category = ? ORDER BY `key`');
        $stmt->execute([$cat]);
    } else {
        $stmt = db()->query('SELECT * FROM app_settings ORDER BY category, `key`');
    }
    $rows = array_map('_setting_decode_row', $stmt->fetchAll());
    send_json(['items' => $rows]);
}

function route_settings_upsert(string $key): void {
    require_admin();
    $b = get_json_body();
    $value    = $b['value'] ?? '';
    $category = $b['category'] ?? 'general';
    $desc     = $b['description'] ?? null;

    // JSON-encode non-string values so we keep types
    if (!is_string($value)) {
        $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        // booleans coming through as 'true'/'false' should stay as JSON booleans for round-trip
        if (in_array(strtolower($value), ['true','false'], true)) {
            $value = strtolower($value); // keep as 'true'/'false' literal → decodes to bool
        }
    }

    $stmt = db()->prepare('INSERT INTO app_settings (`key`, `value`, category, description) VALUES (?,?,?,?)
                           ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), category = VALUES(category), description = VALUES(description), updated_at = NOW()');
    $stmt->execute([$key, $value, $category, $desc]);
    send_json(['ok' => true, 'key' => $key]);
}

function route_settings_delete(string $key): void {
    require_admin();
    $stmt = db()->prepare('DELETE FROM app_settings WHERE `key` = ?');
    $stmt->execute([$key]);
    send_json(['deleted' => $stmt->rowCount()]);
}
