<?php
/**
 * Vyrox AI — Installation : crée les tables MySQL puis le premier administrateur.
 * À supprimer après usage. Se bloque dès qu'un admin existe.
 */
require __DIR__ . '/config.php';

try {
    db()->exec(file_get_contents(__DIR__ . '/schema.sql'));
} catch (PDOException $ex) {
    exit('Erreur base de données : ' . e($ex->getMessage()) . '. Vérifie la config dans .env.');
}

$hasAdmin = (int) db()->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn() > 0;

$msg = '';
if (!$hasAdmin && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $email    = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    if (strlen($username) < 3 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
        $msg = "Champs invalides (nom ≥3, email valide, mot de passe ≥8).";
    } else {
        db()->prepare("INSERT INTO users (username,email,password_hash,role,plan,credits,credits_reset_at)
                       VALUES (?,?,?, 'admin','pro', 999999, ?)")
            ->execute([$username, $email, password_hash($password, PASSWORD_DEFAULT), date('Y-m-d')]);
        exit('<p style="font-family:sans-serif">✅ Administrateur créé. '
            . '<strong>Supprime maintenant install.php</strong> puis <a href="login.php">connecte-toi</a>.</p>');
    }
}

$page_title = 'Installation';
require __DIR__ . '/includes/header.php';
?>
<div class="auth">
  <h2>Installation</h2>
  <p class="muted center">✅ Tables MySQL créées / vérifiées.</p>
  <?php if ($hasAdmin): ?>
    <div class="alert">Un administrateur existe déjà. Supprime <code>install.php</code> et
      va sur <a href="login.php">la page de connexion</a>.</div>
  <?php else: ?>
    <?php if ($msg): ?><div class="alert"><?= e($msg) ?></div><?php endif; ?>
    <p class="muted">Crée le premier compte administrateur.</p>
    <form method="post">
      <div class="field"><label>Nom d'utilisateur</label><input name="username" required></div>
      <div class="field"><label>Email</label><input type="email" name="email" required></div>
      <div class="field"><label>Mot de passe</label><input type="password" name="password" required></div>
      <button class="btn btn-block">Créer l'administrateur</button>
    </form>
  <?php endif; ?>
</div>
<?php require __DIR__ . '/includes/footer.php';
