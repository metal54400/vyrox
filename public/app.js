/**
 * ══════════════════════════════════════════════════════════════════
 * VYROX AI — APP LOGIC COMPLETE v3.1
 * Conversations + Auth + Feedback + Thèmes + Blocs de code (copier / télécharger)
 * Orinstudio © 2026-2029
 * ══════════════════════════════════════════════════════════════════ */

class VyroxApp {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.isProcessing = false;
    this.messageHistory = [];
    this.user = this.safeParse(localStorage.getItem('vyrox_user'), null);
    this.token = localStorage.getItem('vyrox_token');

    // Conversation active
    this.currentConversationId = null;
    this.conversations = [];

    this.init();
  }

  async init() {
    this.applySavedTheme();
    this.bindEvents();
    this.checkAuth();
    this.updateUserUI();
    await this.loadConversations();
    this.checkStatus();
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ═══════════════════════════════════════════════════════════════
  generateSessionId() {
    return 'vyrox_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
  }

  safeParse(value, fallback = null) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  authHeaders(extra = {}) {
    const headers = { ...extra };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
  }

  // Avatar de l'IA : utilise /favicon.png (repli sur l'icône cerveau si l'image ne charge pas)
  assistantAvatar() {
    return `<img src="/favicon.png" alt="Vyrox AI" class="w-9 h-9 rounded-xl flex-shrink-0 object-cover"
      onerror="this.outerHTML='<div class=\\'w-9 h-9 rounded-xl bg-gradient-to-br from-vyrox-cyan to-vyrox-purple flex items-center justify-center flex-shrink-0\\'><i class=\\'fa-solid fa-brain text-white text-sm\\'></i></div>'">`;
  }

  scrollToBottom() {
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv?.parentElement) {
      messagesDiv.parentElement.scrollTop = messagesDiv.parentElement.scrollHeight;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GESTION DU THÈME
  // ═══════════════════════════════════════════════════════════════
  applySavedTheme() {
    const savedTheme = localStorage.getItem('vyrox_theme') || 'dark';
    const html = document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (savedTheme === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#ffffff');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#09090b');
    }
  }

  toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (isDark) {
      html.classList.remove('dark');
      html.classList.add('light');
      localStorage.setItem('vyrox_theme', 'light');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#ffffff');
      this.showToast('Mode clair activé ☀️', 'info');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
      localStorage.setItem('vyrox_theme', 'dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#09090b');
      this.showToast('Mode sombre activé 🌙', 'info');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ÉVÉNEMENTS
  // ═══════════════════════════════════════════════════════════════
  bindEvents() {
    document.getElementById('toggleSidebar')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('newChatBtn')?.addEventListener('click', () => this.newChat());
    document.getElementById('refreshHistory')?.addEventListener('click', () => this.loadConversations());

    document.getElementById('searchToggle')?.addEventListener('click', () => {
      const searchBar = document.getElementById('searchBar');
      if (!searchBar) return;
      searchBar.classList.toggle('hidden');
      if (!searchBar.classList.contains('hidden')) {
        document.getElementById('searchInput')?.focus();
      }
    });

    document.getElementById('settingsBtn')?.addEventListener('click', () => this.openModal('settingsModal'));
    document.getElementById('closeSettings')?.addEventListener('click', () => this.closeModal('settingsModal'));
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('userMenuBtn')?.addEventListener('click', () => this.handleUserMenu());

    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    input?.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim();
      this.autoResize(input);
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    sendBtn?.addEventListener('click', () => this.sendMessage());
    document.getElementById('voiceBtn')?.addEventListener('click', () => this.voiceInput());

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      this.searchConversations(e.target.value);
    });

    document.querySelectorAll('#settingsModal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal.id);
      });
    });

    // Boutons "placeholder" de la sidebar
    document.querySelectorAll('.nav-item, .capability-card').forEach(btn => {
      if (!btn.getAttribute('onclick') && !btn.id) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const text = btn.querySelector('span, h3')?.textContent || 'Fonctionnalité';
          this.showToast(`${text} : Bientôt disponible ! 🚀`, 'info');
        });
      }
    });

    // Boutons copier / télécharger des blocs de code
    this.bindCodeBlockEvents();
  }

  // ═══════════════════════════════════════════════════════════════
  // INTERFACE & SIDEBAR
  // ═══════════════════════════════════════════════════════════════
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('open');

    let overlay = document.getElementById('sidebarOverlay');
    if (sidebar.classList.contains('open') && window.innerWidth < 768) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm';
        overlay.addEventListener('click', () => this.toggleSidebar());
        document.body.appendChild(overlay);
      }
    } else if (overlay) {
      overlay.remove();
    }
  }

  openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
  }

  closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
  }

  autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 192) + 'px';
  }

  // ═══════════════════════════════════════════════════════════════
  // CONVERSATIONS
  // ═══════════════════════════════════════════════════════════════
  async loadConversations() {
    const listContainer = document.getElementById('conversationsList');
    if (!listContainer) return;

    listContainer.innerHTML = `<div class="px-3 py-4 text-center text-xs text-gray-500"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Chargement...</div>`;

    try {
      const response = await fetch('/api/conversations', { headers: this.authHeaders() });
      const data = await response.json();

      this.conversations = data.conversations || [];
      this.renderConversations();
    } catch (error) {
      listContainer.innerHTML = `<div class="px-3 py-4 text-center text-xs text-red-400"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Erreur de chargement</div>`;
    }
  }

  renderConversations() {
    const listContainer = document.getElementById('conversationsList');
    if (!listContainer) return;

    if (this.conversations.length === 0) {
      listContainer.innerHTML = `<div class="px-3 py-4 text-center text-xs text-gray-500"><i class="fa-regular fa-folder-open mr-2"></i>Aucune conversation</div>`;
      return;
    }

    const grouped = this.groupByDate(this.conversations);
    let html = '';

    for (const [dateLabel, convs] of Object.entries(grouped)) {
      html += `<div class="px-3 py-1.5"><span class="text-xs font-semibold text-gray-500">${dateLabel}</span></div>`;
      convs.forEach(conv => {
        const isActive = conv.id === this.currentConversationId;
        html += `
          <div class="conversation-item group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${isActive ? 'bg-vyrox-hover' : 'hover:bg-vyrox-hover'}"
               data-id="${conv.id}" onclick="window.vyroxApp.loadConversation(${conv.id})">
            <i class="fa-regular fa-message text-gray-400 flex-shrink-0"></i>
            <span class="text-sm flex-1 text-left truncate dark:text-gray-200 light:text-gray-800 ${isActive ? 'font-semibold' : 'group-hover:font-medium'}">
              ${this.escapeHtml(conv.title)}
            </span>
            <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              <button onclick="event.stopPropagation(); window.vyroxApp.renameConversation(${conv.id})" class="text-gray-500 hover:text-vyrox-cyan p-1 rounded" title="Renommer">
                <i class="fa-solid fa-pen text-xs"></i>
              </button>
              <button onclick="event.stopPropagation(); window.vyroxApp.deleteConversation(${conv.id})" class="text-gray-500 hover:text-red-500 p-1 rounded" title="Supprimer">
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
            </div>
          </div>
        `;
      });
    }
    listContainer.innerHTML = html;
  }

  groupByDate(conversations) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today); thisWeek.setDate(thisWeek.getDate() - 7);

    const groups = { "Aujourd'hui": [], 'Hier': [], 'Cette semaine': [], 'Plus ancien': [] };

    conversations.forEach(conv => {
      const convDate = new Date(conv.created_at || conv.updated_at);
      if (convDate >= today) groups["Aujourd'hui"].push(conv);
      else if (convDate >= yesterday) groups['Hier'].push(conv);
      else if (convDate >= thisWeek) groups['Cette semaine'].push(conv);
      else groups['Plus ancien'].push(conv);
    });

    Object.keys(groups).forEach(key => { if (groups[key].length === 0) delete groups[key]; });
    return groups;
  }

  searchConversations(query) {
    const items = document.querySelectorAll('.conversation-item');
    const lowerQuery = query.toLowerCase();
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(lowerQuery) ? 'flex' : 'none';
    });
  }

  async loadConversation(convId) {
    if (this.isProcessing) return;
    try {
      const response = await fetch(`/api/conversations/${convId}`, { headers: this.authHeaders() });

      if (!response.ok) {
        this.showToast('Conversation non trouvée', 'error');
        return;
      }

      const data = await response.json();
      const messages = data.messages || [];
      this.currentConversationId = convId;
      this.messageHistory = messages;

      document.getElementById('welcomeScreen').classList.add('hidden');
      document.getElementById('messagesContainer').classList.remove('hidden');

      const messagesDiv = document.getElementById('messages');
      messagesDiv.innerHTML = '';

      messages.forEach(msg => {
        this.addMessage(msg.content, msg.role, {
          type: msg.type,
          data: this.safeParse(msg.metadata, null)
        }, false);
      });

      this.renderConversations();
      setTimeout(() => this.scrollToBottom(), 100);

      if (window.innerWidth < 768) this.toggleSidebar();

    } catch (error) {
      this.showToast('Erreur de chargement', 'error');
    }
  }

  newChat() {
    this.currentConversationId = null;
    this.messageHistory = [];
    this.sessionId = this.generateSessionId();

    document.getElementById('messages').innerHTML = '';
    document.getElementById('welcomeScreen').classList.remove('hidden');
    document.getElementById('messagesContainer').classList.add('hidden');

    const input = document.getElementById('messageInput');
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('sendBtn').disabled = true;

    this.renderConversations();
    this.showToast('Nouvelle conversation créée', 'success');
  }

  async renameConversation(convId) {
    const conv = this.conversations.find(c => c.id === convId);
    if (!conv) return;
    const newTitle = prompt('Nouveau titre :', conv.title);
    if (!newTitle || !newTitle.trim()) return;

    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (response.ok) {
        await this.loadConversations();
        this.showToast('Conversation renommée', 'success');
      } else {
        this.showToast('Erreur lors du renommage', 'error');
      }
    } catch (error) {
      this.showToast('Erreur lors du renommage', 'error');
    }
  }

  async deleteConversation(convId) {
    if (!confirm('Supprimer définitivement cette conversation ?')) return;
    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        method: 'DELETE',
        headers: this.authHeaders()
      });
      if (response.ok) {
        if (this.currentConversationId === convId) this.newChat();
        await this.loadConversations();
        this.showToast('Conversation supprimée', 'success');
      } else {
        this.showToast('Erreur lors de la suppression', 'error');
      }
    } catch (error) {
      this.showToast('Erreur lors de la suppression', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ENVOI DE MESSAGES & RENDU
  // ═══════════════════════════════════════════════════════════════
  async sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message || this.isProcessing) return;

    this.isProcessing = true;
    document.getElementById('sendBtn').disabled = true;
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('messagesContainer').classList.remove('hidden');

    this.addMessage(message, 'user', null, true);
    input.value = '';
    input.style.height = 'auto';

    const typingId = this.showTyping();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
          conversationId: this.currentConversationId
        })
      });

      const data = await response.json();
      this.removeTyping(typingId);

      if (!response.ok || !data.response) {
        this.addMessage('❌ ' + (data.error || 'Une erreur est survenue. Veuillez réessayer.'), 'assistant', null, true);
        return;
      }

      this.addMessage(data.response, 'assistant', data, true);

      if (data.conversationId) {
        this.currentConversationId = data.conversationId;
        await this.loadConversations();
      }
    } catch (error) {
      this.removeTyping(typingId);
      this.addMessage('❌ Erreur de connexion. Veuillez réessayer.', 'assistant', null, true);
    } finally {
      this.isProcessing = false;
      document.getElementById('sendBtn').disabled = !document.getElementById('messageInput').value.trim();
    }
  }

  addMessage(content, role, data = null, scroll = true) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message flex gap-4 ${role === 'user' ? 'flex-row-reverse' : ''} animate-slide-in`;

    const avatar = role === 'user'
      ? `<div class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-user text-white text-sm"></i></div>`
      : this.assistantAvatar();

    const formattedContent = role === 'assistant'
      ? this.formatMessage(content, data)
      : this.escapeHtml(content);

    messageDiv.innerHTML = `
      ${avatar}
      <div class="flex-1 min-w-0 ${role === 'user' ? 'flex justify-end' : ''}">
        <div class="message-bubble ${role === 'user' ? 'bg-vyrox-card border border-vyrox-border rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] whitespace-pre-wrap break-words' : 'max-w-full'}">
          ${formattedContent}
        </div>
      </div>
    `;

    messagesDiv.appendChild(messageDiv);

    if (role === 'assistant') {
      this.addFeedbackButtons(messageDiv, content);
    }

    if (scroll) this.scrollToBottom();
  }

  // ═══════════════════════════════════════════════════════════════
  // FORMATAGE DES MESSAGES + BLOCS DE CODE
  // ═══════════════════════════════════════════════════════════════
  formatMessage(content, data) {
    // 1) Extraire les blocs de code AVANT tout autre remplacement
    const blocks = [];
    let text = String(content ?? '').replace(/```([\w+#-]*)[ \t]*\n?([\s\S]*?)```/g, (_, lang, code) => {
      blocks.push(this.renderCodeBlock(lang, code));
      return `@@CODEBLOCK${blocks.length - 1}@@`;
    });

    // 2) Échapper le HTML (anti-XSS) puis markdown inline
    text = this.escapeHtml(text)
      .replace(/`([^`\n]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-black/20 font-mono text-[0.85em]">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

    // 3) Remettre les blocs de code (sans <br> parasites autour)
    text = text
      .replace(/(?:<br>)*(@@CODEBLOCK\d+@@)(?:<br>)*/g, '$1')
      .replace(/@@CODEBLOCK(\d+)@@/g, (_, i) => blocks[i]);

    let formatted = text;

    if (data?.type === 'search' && data.data?.results) {
      formatted += '<div class="search-results space-y-2 mt-3">';
      data.data.results.forEach(r => {
        const url = /^https?:\/\//i.test(r.url) ? r.url : '#';
        formatted += `<div class="search-result"><h4>${this.escapeHtml(r.title)}</h4><p>${this.escapeHtml(r.snippet)}</p><a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-vyrox-cyan hover:underline"><i class="fa-solid fa-external-link-alt text-xs"></i> Voir la source</a></div>`;
      });
      formatted += '</div>';
    }

    if (data?.type === 'image_generation' && data.data?.url) {
      formatted += `<div class="image-result mt-3 rounded-xl overflow-hidden border border-vyrox-border"><img src="${this.escapeHtml(data.data.url)}" alt="${this.escapeHtml(data.data.prompt || '')}" class="w-full max-h-96 object-cover"></div>`;
    }

    return formatted;
  }

  renderCodeBlock(lang, code) {
    const language = (lang || '').toLowerCase();
    const label = language || 'code';
    const clean = code.replace(/^\n+|\s+$/g, '');
    const lineCount = clean.split('\n').length;
    const numbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

    return `
      <div class="code-block my-4 rounded-xl overflow-hidden border border-[#3c3c3c] bg-[#1e1e1e] shadow-lg" data-lang="${this.escapeHtml(language)}">
        <div class="flex items-center justify-between px-4 py-2.5 bg-[#252526] border-b border-[#3c3c3c]">
          <span class="text-sm font-semibold text-gray-200">${this.escapeHtml(label)}</span>
          <div class="flex items-center gap-1">
            <button type="button" data-action="copy-code" title="Copier"
              class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <i class="fa-regular fa-copy"></i>
            </button>
            <button type="button" data-action="download-code" title="Télécharger"
              class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <i class="fa-solid fa-download"></i>
            </button>
          </div>
        </div>
        <div class="flex overflow-x-auto font-mono text-sm leading-6" style="font-family:'JetBrains Mono',monospace">
          <div class="select-none text-right text-gray-500 py-4 pl-4 pr-3 border-r border-[#3c3c3c] whitespace-pre flex-shrink-0 min-w-[3rem]" aria-hidden="true">${numbers}</div>
          <pre class="m-0 py-4 px-4 text-[#d4d4d4]"><code class="whitespace-pre">${this.escapeHtml(clean)}</code></pre>
        </div>
      </div>
    `;
  }

  bindCodeBlockEvents() {
    document.getElementById('messages')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const block = btn.closest('.code-block');
      if (!block) return;
      const code = block.querySelector('code').textContent;

      if (btn.dataset.action === 'copy-code') {
        try {
          await navigator.clipboard.writeText(code);
          const icon = btn.querySelector('i');
          icon.className = 'fa-solid fa-check text-green-400';
          setTimeout(() => { icon.className = 'fa-regular fa-copy'; }, 2000);
        } catch {
          this.showToast('Impossible de copier', 'error');
        }
      }

      if (btn.dataset.action === 'download-code') {
        this.downloadCode(code, block.dataset.lang);
      }
    });
  }

  downloadCode(code, lang) {
    const ext = {
      javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py',
      php: 'php', html: 'html', css: 'css', json: 'json', bash: 'sh', sh: 'sh',
      sql: 'sql', yaml: 'yml', yml: 'yml', java: 'java', c: 'c', cpp: 'cpp', go: 'go', rust: 'rs'
    }[lang] || 'txt';
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `vyrox-code.${ext}` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  showTyping() {
    const messagesDiv = document.getElementById('messages');
    const id = 'typing-' + Date.now();
    const typing = document.createElement('div');
    typing.id = id;
    typing.className = 'message flex gap-4 animate-slide-in';
    typing.innerHTML = `
      ${this.assistantAvatar()}
      <div class="flex-1"><div class="flex items-center gap-2 py-3"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>
    `;
    messagesDiv.appendChild(typing);
    this.scrollToBottom();
    return id;
  }

  removeTyping(id) {
    document.getElementById(id)?.remove();
  }

  // ═══════════════════════════════════════════════════════════════
  // SYSTÈME DE FEEDBACK
  // ═══════════════════════════════════════════════════════════════
  addFeedbackButtons(messageDiv, aiResponse) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'flex items-center gap-2 mt-2 text-xs text-gray-500';
    feedbackDiv.innerHTML = `
      <span class="mr-1">Cette réponse était-elle utile ?</span>
      <button class="feedback-positive px-2 py-1 rounded hover:bg-green-500/20 hover:text-green-500 transition-colors" title="Bonne réponse"><i class="fa-solid fa-thumbs-up"></i></button>
      <button class="feedback-negative px-2 py-1 rounded hover:bg-red-500/20 hover:text-red-500 transition-colors" title="Mauvaise réponse"><i class="fa-solid fa-thumbs-down"></i></button>
    `;

    feedbackDiv.querySelector('.feedback-positive').addEventListener('click', () => {
      this.sendFeedback('positive', aiResponse);
      feedbackDiv.innerHTML = '<span class="text-green-500"><i class="fa-solid fa-check"></i> Merci !</span>';
    });

    feedbackDiv.querySelector('.feedback-negative').addEventListener('click', () => {
      this.sendFeedback('negative', aiResponse);
      feedbackDiv.innerHTML = '<span class="text-red-500"><i class="fa-solid fa-check"></i> Je vais m\'améliorer !</span>';
    });

    messageDiv.querySelector('.flex-1').appendChild(feedbackDiv);
  }

  async sendFeedback(sentiment, aiResponse) {
    if (!this.token) {
      this.showToast('Connecte-toi pour laisser un feedback', 'info');
      return;
    }
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sentiment, aiResponse })
      });
    } catch (error) {
      console.error('Erreur feedback:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // OUTILS & AUTHENTIFICATION
  // ═══════════════════════════════════════════════════════════════
  voiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.showToast('Reconnaissance vocale non supportée par ce navigateur', 'error');
      return;
    }

    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.onresult = (e) => {
      const input = document.getElementById('messageInput');
      input.value = e.results[0][0].transcript;
      document.getElementById('sendBtn').disabled = false;
      this.autoResize(input);
    };
    recognition.onerror = (e) => this.showToast('Erreur vocale: ' + e.error, 'error');
    recognition.start();
    this.showToast('🎤 Écoute en cours...', 'info');
  }

  checkAuth() {
    if (this.token && this.user) this.verifyToken();
  }

  async verifyToken() {
    try {
      const response = await fetch('/api/auth/me', { headers: this.authHeaders() });
      const data = await response.json();
      if (!data.success) this.logout();
    } catch (error) {
      console.warn('Token verification failed');
    }
  }

  updateUserUI() {
    const userName = document.getElementById('userName');
    if (this.user && userName) userName.textContent = this.user.username;
  }

  handleUserMenu() {
    if (this.user) {
      if (confirm('Veux-tu te déconnecter ?')) this.logout();
    } else {
      window.location.href = '/auth/login';
    }
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: this.authHeaders() });
    } catch (e) { /* ignoré */ }
    localStorage.removeItem('vyrox_user');
    localStorage.removeItem('vyrox_token');
    this.user = null;
    this.token = null;
    window.location.reload();
  }

  async checkStatus() {
    try {
      await fetch('/api/stats');
    } catch (e) {
      console.warn('Serveur non disponible');
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const colors = { success: 'text-green-500', error: 'text-red-500', info: 'text-vyrox-cyan' };
    const borders = { success: '#22c55e', error: '#ef4444', info: '#00d4ff' };

    const toast = document.createElement('div');
    toast.className = 'toast flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg bg-vyrox-card border border-vyrox-border animate-slide-in';
    toast.style.borderLeft = `4px solid ${borders[type] || borders.info}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} ${colors[type] || colors.info}"></i><span class="text-sm dark:text-gray-200 light:text-gray-800">${this.escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Suggestions de l'écran d'accueil
function sendSuggestion(text) {
  const input = document.getElementById('messageInput');
  input.value = text;
  document.getElementById('sendBtn').disabled = false;
  input.focus();
  window.vyroxApp.autoResize(input);
  window.vyroxApp.sendMessage();
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  window.vyroxApp = new VyroxApp();
});