<?php
require __DIR__ . '/config.php';
$u = require_login();
$page_title = 'Chat';
require __DIR__ . '/includes/header.php';
?>
<div class="chat-wrap">
  <aside class="sidebar">
    <button class="btn btn-block" onclick="newChat()">+ Nouvelle discussion</button>
    <div id="convList" style="margin-top:.8rem"></div>
  </aside>

  <section class="chat-main">
    <div class="mode-tabs">
      <button id="tab-normal" class="active" onclick="setMode('normal')">💬 Normal</button>
      <button id="tab-code" onclick="setMode('code')">👨‍💻 Code</button>
    </div>
    <div class="messages" id="messages">
      <div class="msg assistant">Bonjour <?= e($u['username']) ?> ! Pose-moi ta question, ou passe en mode Code pour programmer.</div>
    </div>
    <form class="composer" id="composer">
      <textarea id="input" placeholder="Écris ton message…" required></textarea>
      <button class="btn" id="sendBtn">Envoyer</button>
    </form>
  </section>
</div>

<script>
const CSRF = <?= json_encode(csrf_token()) ?>;
const PLAN = <?= json_encode($u['plan']) ?>;
let mode = 'normal', convId = 0;

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
// Rendu markdown minimal : blocs de code + gras + retours ligne
function render(s){
  s = esc(s);
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g,(_,l,c)=>`<pre><code>${c.replace(/\n$/,'')}</code></pre>`);
  s = s.replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  return s;
}
function addMsg(role, text){
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  el.innerHTML = role === 'assistant' ? render(text) : esc(text);
  const box = document.getElementById('messages');
  box.appendChild(el); box.scrollTop = box.scrollHeight;
}
function setMode(m){
  if (convId) return; // le mode est fixé par la conversation en cours
  mode = m;
  document.getElementById('tab-normal').classList.toggle('active', m==='normal');
  document.getElementById('tab-code').classList.toggle('active', m==='code');
}
function newChat(){
  convId = 0; mode = 'normal'; setMode('normal');
  document.getElementById('messages').innerHTML =
    '<div class="msg assistant">Nouvelle discussion. Je t\'écoute !</div>';
  loadList();
}
async function loadList(){
  const r = await fetch('api.php?action=list').then(r=>r.json());
  const box = document.getElementById('convList'); box.innerHTML = '';
  for (const c of r.conversations){
    const a = document.createElement('a');
    a.className = 'conv' + (c.id==convId?' active':'');
    a.textContent = (c.mode==='code'?'👨‍💻 ':'💬 ') + c.title;
    a.onclick = () => openConv(c.id);
    box.appendChild(a);
  }
}
async function openConv(id){
  const r = await fetch('api.php?action=messages&id='+id).then(r=>r.json());
  convId = id; mode = r.conversation.mode;
  document.getElementById('tab-normal').classList.toggle('active', mode==='normal');
  document.getElementById('tab-code').classList.toggle('active', mode==='code');
  const box = document.getElementById('messages'); box.innerHTML='';
  r.messages.forEach(m => addMsg(m.role, m.content));
  loadList();
}
document.getElementById('composer').onsubmit = async (ev) => {
  ev.preventDefault();
  const ta = document.getElementById('input');
  const text = ta.value.trim(); if (!text) return;
  addMsg('user', text); ta.value = '';
  const btn = document.getElementById('sendBtn'); btn.disabled = true; btn.textContent='…';
  const body = new URLSearchParams({csrf:CSRF, message:text, mode, conversation_id:convId});
  const res = await fetch('api.php?action=send', {method:'POST', body});
  const d = await res.json();
  if (!res.ok){ addMsg('assistant', '⚠️ ' + (d.error||'Erreur')); }
  else {
    addMsg('assistant', d.reply);
    convId = d.conversation_id;
    if (d.plan === 'free'){
      const c = document.querySelector('.credits'); if (c) c.textContent = d.credits + ' crédits';
    }
    loadList();
  }
  btn.disabled = false; btn.textContent='Envoyer';
};
loadList();
</script>
<?php require __DIR__ . '/includes/footer.php';
