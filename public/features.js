/**
 * VYROX AI — features.js
 * Fonctions ajoutées à VyroxApp (à charger APRÈS app.js)
 * Réglages, raccourcis, export/partage, copier/régénérer, son, scroll, statut réseau
 */
(() => {
  const P = VyroxApp.prototype;
  const $ = (id) => document.getElementById(id);
  const cfg = {
    get: (k, d) => { try { const v = localStorage.getItem('vyrox_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => localStorage.setItem('vyrox_' + k, JSON.stringify(v))
  };

  const SUGGESTIONS = [
    ['fa-brands fa-js', 'cyan', 'Explique-moi le JavaScript', 'Concepts modernes et bonnes pratiques', 'Explique-moi le JavaScript moderne'],
    ['fa-solid fa-image', 'purple', 'Créer une image', 'Ville futuriste avec néons', 'Génère une image de ville futuriste la nuit'],
    ['fa-solid fa-server', 'pink', 'Coder un serveur', 'Node.js avec Express', 'Code un serveur Node.js complet avec Express'],
    ['fa-solid fa-magnifying-glass', 'orange', 'Rechercher sur le web', 'Dernières actualités en IA', 'Recherche les dernières nouvelles en IA']
  ];
  const COLORS = { cyan: '#00d4ff', purple: '#a855f7', pink: '#ec4899', orange: '#f97316' };

  // ── Hooks sur les méthodes existantes ────────────────────────
  const baseBind = P.bindEvents;
  P.bindEvents = function () { baseBind.call(this); this.bindFeatures(); };

  const baseSidebar = P.toggleSidebar;
  P.toggleSidebar = function () {
    if (window.innerWidth >= 768) $('sidebar').classList.toggle('collapsed');
    else baseSidebar.call(this);
  };

  const baseTheme = P.toggleTheme;
  P.toggleTheme = function () {
    baseTheme.call(this);
    $('setDark').checked = document.documentElement.classList.contains('dark');
  };

  const baseSend = P.sendMessage;
  P.sendMessage = function () {
    const v = $('messageInput').value.trim();
    if (v && !this.isProcessing) this.lastUserMessage = v;
    $('charCount').textContent = '0/4000';
    return baseSend.call(this);
  };

  const baseAdd = P.addMessage;
  P.addMessage = function (content, role, data, scroll) {
    baseAdd.call(this, content, role, data, scroll);
    if (role === 'assistant' && scroll && cfg.get('sound', false)) this.beep();
  };

  const baseFeedback = P.addFeedbackButtons;
  P.addFeedbackButtons = function (messageDiv, text) {
    baseFeedback.call(this, messageDiv, text);
    const bar = document.createElement('div');
    bar.className = 'flex items-center gap-1 mt-1 text-xs text-gray-500';
    bar.innerHTML = `
      <button data-a="copy" class="px-2 py-1 rounded hover:bg-white/10 transition-colors" title="Copier la réponse"><i class="fa-regular fa-copy"></i> Copier</button>
      <button data-a="regen" class="px-2 py-1 rounded hover:bg-white/10 transition-colors" title="Régénérer"><i class="fa-solid fa-rotate"></i> Régénérer</button>`;
    bar.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'copy') {
        try { await navigator.clipboard.writeText(text); this.showToast('Réponse copiée', 'success'); }
        catch { this.showToast('Impossible de copier', 'error'); }
      } else if (a === 'regen') {
        if (this.isProcessing || !this.lastUserMessage) return;
        $('messageInput').value = this.lastUserMessage;
        this.sendMessage();
      }
    });
    messageDiv.querySelector('.flex-1').appendChild(bar);
  };

  // ── Nouvelles méthodes ───────────────────────────────────────
  P.beep = function () {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.frequency.value = 880; gain.gain.value = 0.05;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
    } catch { /* audio indisponible */ }
  };

  P.chatToMarkdown = function () {
    const items = [...document.querySelectorAll('#messages .message')].filter(m => m.querySelector('.message-bubble'));
    if (!items.length) return '';
    const lines = ['# Conversation Vyrox AI', `_Exportée le ${new Date().toLocaleString('fr-FR')}_`, ''];
    items.forEach(m => {
      const isUser = m.classList.contains('flex-row-reverse');
      lines.push(`**${isUser ? 'Moi' : 'Vyrox'}** :`, '', m.querySelector('.message-bubble').innerText.trim(), '');
    });
    return lines.join('\n');
  };

  P.exportChat = function () {
    const md = this.chatToMarkdown();
    if (!md) return this.showToast('Aucune conversation à exporter', 'info');
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `vyrox-${Date.now()}.md` });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    this.showToast('Conversation exportée', 'success');
  };

  P.shareChat = async function () {
    const md = this.chatToMarkdown();
    if (!md) return this.showToast('Aucune conversation à partager', 'info');
    try {
      if (navigator.share) await navigator.share({ title: 'Conversation Vyrox AI', text: md });
      else { await navigator.clipboard.writeText(md); this.showToast('Conversation copiée dans le presse-papiers', 'success'); }
    } catch { /* partage annulé */ }
  };

  P.clearAllConversations = async function () {
    if (!this.conversations.length) return this.showToast('Aucune conversation', 'info');
    if (!confirm(`Supprimer définitivement ${this.conversations.length} conversation(s) ?`)) return;
    await Promise.allSettled(this.conversations.map(c =>
      fetch(`/api/conversations/${c.id}`, { method: 'DELETE', headers: this.authHeaders() })));
    this.newChat();
    await this.loadConversations();
    this.closeModal('settingsModal');
  };

  P.bindFeatures = function () {
    // Suggestions de l'écran d'accueil
    $('suggestions').innerHTML = SUGGESTIONS.map(([icon, c, title, sub, prompt]) => `
      <button onclick="sendSuggestion(${JSON.stringify(prompt).replace(/"/g, '&quot;')})"
        class="flex items-start gap-4 p-4 bg-vyrox-card border border-vyrox-border rounded-xl hover:bg-vyrox-hover transition-all">
        <span class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${COLORS[c]}1a">
          <i class="${icon} text-xl" style="color:${COLORS[c]}"></i></span>
        <span class="min-w-0"><span class="block text-sm font-semibold t1">${title}</span><span class="block text-xs t2">${sub}</span></span>
      </button>`).join('');

    // Réglages
    const html = document.documentElement;
    $('setDark').checked = html.classList.contains('dark');
    $('setDark').addEventListener('change', (e) => { if (e.target.checked !== html.classList.contains('dark')) this.toggleTheme(); });
    $('setEnter').checked = cfg.get('enterSend', true);
    $('setEnter').addEventListener('change', (e) => cfg.set('enterSend', e.target.checked));
    $('setSound').checked = cfg.get('sound', false);
    $('setSound').addEventListener('change', (e) => { cfg.set('sound', e.target.checked); if (e.target.checked) this.beep(); });
    const applyFont = (px) => { html.style.fontSize = px + 'px'; $('setFont').value = px; };
    applyFont(cfg.get('font', 16));
    $('setFont').addEventListener('change', (e) => { cfg.set('font', +e.target.value); applyFont(+e.target.value); });
    $('exportChat').addEventListener('click', () => this.exportChat());
    $('clearAll').addEventListener('click', () => this.clearAllConversations());
    $('shareBtn').addEventListener('click', () => this.shareChat());

    // Entrée / Ctrl+Entrée (écouteur en capture, passe avant celui d'app.js)
    $('messageInput').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || cfg.get('enterSend', true)) return;
      e.stopImmediatePropagation();
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.sendMessage(); }
    }, true);

    // Compteur de caractères
    $('messageInput').addEventListener('input', (e) => {
      const n = e.target.value.length;
      $('charCount').textContent = `${n}/4000`;
      $('charCount').classList.toggle('text-red-500', n > 3800);
    });

    // Bouton "Coder"
    $('navCoder').addEventListener('click', () => {
      const input = $('messageInput');
      input.value = 'Aide-moi à coder : ';
      input.focus(); input.setSelectionRange(input.value.length, input.value.length);
      $('sendBtn').disabled = false;
      if (window.innerWidth < 768) this.toggleSidebar();
    });

    // Bouton "aller en bas"
    const scroller = $('chatScroll');
    scroller.addEventListener('scroll', () => {
      const away = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 300;
      $('scrollBtn').classList.toggle('hidden', !away);
    });
    $('scrollBtn').addEventListener('click', () => scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' }));

    // Raccourcis clavier
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); $('searchToggle').click(); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); this.newChat(); }
      else if (e.key === 'Escape') this.closeModal('settingsModal');
      else if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('messageInput').focus(); }
    });

    // Statut réseau
    const setStatus = (on) => {
      $('statusText').textContent = on ? 'En ligne' : 'Hors ligne';
      $('statusDot').className = `w-1.5 h-1.5 rounded-full ${on ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`;
    };
    window.addEventListener('online', () => { setStatus(true); this.showToast('Connexion rétablie', 'success'); });
    window.addEventListener('offline', () => { setStatus(false); this.showToast('Vous êtes hors ligne', 'error'); });
    setStatus(navigator.onLine);
  };
})();