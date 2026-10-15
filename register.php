<?php
require __DIR__ . '/config.php';
if (current_user()) redirect('chat.php');

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $username = trim($_POST['username'] ?? '');
    $email    = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if (!preg_match('/^[a-zA-Z0-9_\-]{3,30}$/', $username)) {
        $error = "Nom d'utilisateur invalide (3-30 caractères, lettres/chiffres/_/-).";
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = "Adresse email invalide.";
    } elseif (strlen($password) < 8 || !preg_match('/[A-Z]/', $password)
              || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password)) {
        $error = "Mot de passe : min. 8 caractères, avec majuscule, minuscule et chiffre.";
    } else {
        try {
            $stmt = db()->prepare(
                'INSERT INTO users (username, email, password_hash, credits, credits_reset_at)
                 VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$username, $email,
                password_hash($password, PASSWORD_DEFAULT),
                (int) env('FREE_DAILY_CREDITS', '20'), date('Y-m-d')]);
            session_boot();
            $_SESSION['uid'] = (int) db()->lastInsertId();
            redirect('chat.php');
        } catch (PDOException $ex) {
            $error = $ex->getCode() === '23000'
                ? "Ce nom d'utilisateur ou cet email est déjà pris."
                : "Erreur serveur, réessaie plus tard.";
        }
    }
}

$page_title = 'Inscription';
require __DIR__ . '/includes/header.php';
?>
<div class="auth">
  <h2>Créer un compte</h2>
  <?php if ($error): ?><div class="alert"><?= e($error) ?></div><?php endif; ?>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
    <div class="field"><label>Nom d'utilisateur</label>
      <input name="username" value="<?= e($_POST['username'] ?? '') ?>" required></div>
    <div class="field"><label>Email</label>
      <input type="email" name="email" value="<?= e($_POST['email'] ?? '') ?>" required></div>
    <div class="field"><label>Mot de passe</label>
      <input type="password" name="password" required></div>
    <button class="btn btn-block">S'inscrire</button>
  </form>
  <p class="center muted" style="margin-top:1rem">Déjà un compte ? <a href="login.php">Se connecter</a></p>
</div>
<?php require __DIR__ . '/includes/footer.php';
