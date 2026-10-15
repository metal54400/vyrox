<?php
/**
 * Vyrox AI — Configuration & helpers communs
 * Orinstudio © 2026-2029
 */
declare(strict_types=1);

// ── Chargement du .env (simple) ───────────────────────────────
(function () {
    $f = __DIR__ . '/.env';
    if (!is_file($f)) return;
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $_ENV[trim($k)] = trim($v);
    }
})();

function env(string $key, string $default = ''): string {
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

// ── Connexion MySQL (PDO) ─────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        env('DB_HOST', '127.0.0.1'), env('DB_PORT', '3306'), env('DB_NAME', 'vyrox'));
    $pdo = new PDO($dsn, env('DB_USER', 'root'), env('DB_PASS'), [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

// ── Session & authentification ────────────────────────────────
function session_boot(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict']);
        session_start();
    }
}

function current_user(): ?array {
    session_boot();
    if (empty($_SESSION['uid'])) return null;
    static $u = false;
    if ($u !== false) return $u;
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ? AND is_active = 1');
    $stmt->execute([$_SESSION['uid']]);
    $u = $stmt->fetch() ?: null;
    if ($u) $u = refresh_credits($u);
    return $u;
}

function require_login(): array {
    $u = current_user();
    if (!$u) { header('Location: login.php'); exit; }
    return $u;
}

function require_admin(): array {
    $u = require_login();
    if ($u['role'] !== 'admin') { http_response_code(403); exit('Accès réservé aux administrateurs.'); }
    return $u;
}

// ── Crédits : reset quotidien pour les comptes gratuits ───────
function refresh_credits(array $u): array {
    if ($u['plan'] === 'pro') return $u;              // pro = illimité
    $today = date('Y-m-d');
    if ($u['credits_reset_at'] !== $today) {
        $daily = (int) env('FREE_DAILY_CREDITS', '20');
        db()->prepare('UPDATE users SET credits = ?, credits_reset_at = ? WHERE id = ?')
            ->execute([$daily, $today, $u['id']]);
        $u['credits'] = $daily;
        $u['credits_reset_at'] = $today;
    }
    return $u;
}

// ── CSRF ──────────────────────────────────────────────────────
function csrf_token(): string {
    session_boot();
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(16));
}
function csrf_check(): void {
    session_boot();
    if (!hash_equals($_SESSION['csrf'] ?? '', $_POST['csrf'] ?? '')) {
        http_response_code(400); exit('Jeton CSRF invalide.');
    }
}

function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

function redirect(string $to): never { header("Location: $to"); exit; }
