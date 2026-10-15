<?php
require __DIR__ . '/config.php';
if (current_user()) redirect('chat.php');

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id  = trim($_POST['identifier'] ?? '');
    $pwd = $_POST['password'] ?? '';
    $stmt = db()->prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1');
    $stmt->execute([$id, $id]);
    $u = $stmt->fetch();
    if ($u && password_verify($pwd, $u['password_hash'])) {
        session_boot();
        session_regenerate_id(true);
        $_SESSION['uid'] = (int) $u['id'];
        db()->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$u['id']]);
        redirect('chat.php');
    }
    $error = "Identifiants incorrects.";
}

$page_title = 'Connexion';
require __DIR__ . '/includes/header.php';
?>
<div class="auth">
  <h2>Connexion</h2>
  <?php if ($error): ?><div class="alert"><?= e($error) ?></div><?php endif; ?>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
    <div class="field"><label>Nom d'utilisateur ou email</label>
      <input name="identifier" required></div>
    <div class="field"><label>Mot de passe</label>
      <input type="password" name="password" required></div>
    <button class="btn btn-block">Se connecter</button>
  </form>
  <p class="center muted" style="margin-top:1rem">Pas de compte ? <a href="register.php">S'inscrire</a></p>
</div>
<?php require __DIR__ . '/includes/footer.php';
