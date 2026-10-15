<?php
require __DIR__ . '/config.php';
$page_title = 'Accueil';
require __DIR__ . '/includes/header.php';
?>
<section class="hero">
  <h1>Vyrox <span>AI</span></h1>
  <p>L'intelligence artificielle d'Orinstudio. Discute, pose tes questions et génère du
     code — avec une mémoire de tes conversations et un mode expert pour les développeurs.</p>
  <div>
    <a href="register.php" class="btn">Créer un compte gratuit</a>
    <a href="login.php" class="btn-ghost">Se connecter</a>
  </div>
</section>

<section class="cards">
  <div class="card"><h3>💬 Conversation naturelle</h3><p>Pose n'importe quelle question,
     Vyrox répond de façon claire et structurée en français.</p></div>
  <div class="card"><h3>👨‍💻 Mode Code</h3><p>Un assistant spécialisé programmation :
     code commenté, bonnes pratiques et explications.</p></div>
  <div class="card"><h3>🧠 Mémoire</h3><p>Tes conversations sont sauvegardées et
     retrouvables à tout moment dans ton espace.</p></div>
  <div class="card"><h3>⚡ Plan Pro</h3><p>Un modèle plus puissant et un usage illimité
     pour aller plus loin.</p></div>
</section>

<section style="margin-top:3rem">
  <h2 class="center">Tarifs</h2>
  <div class="pricing">
    <div class="plan">
      <h3>Gratuit</h3>
      <div class="price">0€</div>
      <ul>
        <li><?= (int) env('FREE_DAILY_CREDITS', '20') ?> messages par jour</li>
        <li>Mode normal &amp; mode code</li>
        <li>Historique des conversations</li>
        <li>Modèle standard</li>
      </ul>
      <a href="register.php" class="btn btn-block">Commencer</a>
    </div>
    <div class="plan pro">
      <h3>Pro ⚡</h3>
      <div class="price">Sur demande</div>
      <ul>
        <li>Messages illimités</li>
        <li>Modèle plus performant</li>
        <li>Priorité &amp; réponses plus fines</li>
        <li>Tout le gratuit inclus</li>
      </ul>
      <a href="register.php" class="btn-ghost btn-block">Passer Pro via l'admin</a>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php';
