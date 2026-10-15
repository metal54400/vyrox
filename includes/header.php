<?php
/** Layout partagé — en-tête. Attend éventuellement $page_title. */
$__u = current_user();
?><!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= isset($page_title) ? e($page_title) . ' — Vyrox AI' : 'Vyrox AI' ?></title>
  <link rel="icon" href="public/favicon.png">
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
<header class="topbar">
  <a class="brand" href="index.php">VYROX<span>AI</span></a>
  <nav>
    <a href="index.php">Accueil</a>
    <?php if ($__u): ?>
      <a href="chat.php">Chat</a>
      <?php if ($__u['role'] === 'admin'): ?><a href="admin.php">Admin</a><?php endif; ?>
      <span class="badge badge-<?= e($__u['plan']) ?>"><?= strtoupper($__u['plan']) ?></span>
      <?php if ($__u['plan'] === 'free'): ?><span class="credits"><?= (int)$__u['credits'] ?> crédits</span><?php endif; ?>
      <a href="logout.php" class="btn-ghost">Déconnexion</a>
    <?php else: ?>
      <a href="login.php">Connexion</a>
      <a href="register.php" class="btn">Inscription</a>
    <?php endif; ?>
  </nav>
</header>
<main class="container">
