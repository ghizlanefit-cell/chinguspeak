<?php
// ============================================================
// ChinguSpeak Admin Backend — config
// EDIT THIS FILE before uploading to Hostinger.
// ============================================================

// --- MySQL database ---
// On Hostinger, your DB host is usually 'localhost'. Get name/user/password
// from hPanel → Databases → MySQL Databases.
define('DB_HOST', 'localhost');
define('DB_NAME', 'chinguspeak');           // <-- change me
define('DB_USER', 'chinguuser');            // <-- change me
define('DB_PASS', 'change-me-strong-pass'); // <-- change me
define('DB_CHARSET', 'utf8mb4');

// --- JWT ---
// Generate a strong random string. Linux: `openssl rand -hex 32`
define('JWT_SECRET', 'change-me-to-a-64-char-random-hex-string');
define('JWT_ALGO', 'HS256');
define('JWT_TTL_MIN', 60 * 8); // 8 hours

// --- Seed admin (used only the first time) ---
define('SEED_ADMIN_EMAIL', 'admin@chinguspeak.com');
define('SEED_ADMIN_PASSWORD', 'ChinguAdmin#2026!Secure'); // change after first login

// --- Brute force protection ---
define('LOCKOUT_LIMIT', 5);
define('LOCKOUT_MINUTES', 15);

// --- CORS ---
// Set to your admin panel's public URL, or '*' to allow all origins.
define('CORS_ORIGIN', '*');

// --- App settings ---
define('APP_NAME', 'ChinguSpeak');
define('APP_TIMEZONE', 'UTC');
date_default_timezone_set(APP_TIMEZONE);

// --- Error display ---
// Turn this OFF in production by setting to false.
define('SHOW_ERRORS', true);
if (SHOW_ERRORS) {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', 0);
    error_reporting(0);
}
