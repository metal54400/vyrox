<?php
require __DIR__ . '/config.php';
$admin = require_admin();

$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int) ($_POST['user_id'] ?? 0);
    $op = $_POST['op'] ?? '';

    if ($id === $admin['id'] && in_array($op, ['delete', 'role'], true)) {
        $msg = "Tu ne peux pas modifier ton propre rôle ni te supprimer.";
    } elseif ($op === 'update') {
        $role    = ($_POST['role'] ?? 'user') === 'admin' ? 'admin' : 'user';
        $plan    = ($_POST['plan'] ?? 'free') === 'pro' ? 'pro' : 'free';
        $credits = max(0, (int) ($_POST['credits'] ?? 0));
        $active  = isset($_POST['is_active']) ? 1 : 0;
        if ($id === $admin['id']) $role = 'admin';  // ne pas se rétrograder
        db()->prepare('UPDATE users SET role=?, plan=?, credits=?, is_active=? WHERE id=?')
            ->execute([$role, $plan, $credits, $active, $id]);
        $msg = "Utilisateur #$id mis à jour.";
    } elseif ($op === 'delete') {
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        $msg = "Utilisateur #$id supprimé.";
    }
}

$users = db()->query('SELECT id, username, email, role, plan, credits, is_active, created_at, last_login
                      FROM users ORDER BY id')->fetchAll();

$page_title = 'Administration';
require __DIR__ . '/includes/header.php';
?>
<h2>Administration — Utilisateurs & rôles</h2>
<?php if ($msg): ?><div class="alert" style="background:#102a1a;border-color:#1f7a3a;color:#9dffb5"><?= e($msg) ?></div><?php endif; ?>
<p class="muted">Gère ici les rôles (user / admin), le plan (gratuit / Pro), les crédits et l'activation des comptes.</p>

<table>
  <thead><tr>
    <th>#</th><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Plan</th>
    <th>Crédits</th><th>Actif</th><th>Inscrit</th><th></th>
  </tr></thead>
  <tbody>
  <?php foreach ($users as $row): $fid = 'u' . (int)$row['id']; ?>
    <tr>
      <td><?= (int)$row['id'] ?>
        <form id="<?= $fid ?>" method="post">
          <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
          <input type="hidden" name="user_id" value="<?= (int)$row['id'] ?>">
        </form>
      </td>
      <td><?= e($row['username']) ?></td>
      <td class="muted"><?= e($row['email']) ?></td>
      <td>
        <select name="role" form="<?= $fid ?>">
          <option value="user"  <?= $row['role']==='user'?'selected':'' ?>>user</option>
          <option value="admin" <?= $row['role']==='admin'?'selected':'' ?>>admin</option>
        </select>
      </td>
      <td>
        <select name="plan" form="<?= $fid ?>">
          <option value="free" <?= $row['plan']==='free'?'selected':'' ?>>free</option>
          <option value="pro"  <?= $row['plan']==='pro'?'selected':'' ?>>pro</option>
        </select>
      </td>
      <td><input type="number" name="credits" form="<?= $fid ?>" value="<?= (int)$row['credits'] ?>" min="0" style="width:70px"></td>
      <td><input type="checkbox" name="is_active" form="<?= $fid ?>" <?= $row['is_active']?'checked':'' ?>></td>
      <td class="muted"><?= e(substr((string)$row['created_at'],0,10)) ?></td>
      <td style="white-space:nowrap">
        <button class="btn" form="<?= $fid ?>" name="op" value="update">💾</button>
        <?php if ($row['id'] != $admin['id']): ?>
          <button class="btn-ghost" form="<?= $fid ?>" name="op" value="delete"
                  onclick="return confirm('Supprimer définitivement cet utilisateur ?')">🗑</button>
        <?php endif; ?>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
<?php require __DIR__ . '/includes/footer.php';
