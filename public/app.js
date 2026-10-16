/**
 * ══════════════════════════════════════════════════════════════════
 * VYROX AI — APP LOGIC COMPLETE v5.1 (IMAGES + TÉLÉCHARGEMENT)
 * Conversations + Auth + Feedback + Thèmes + Markdown Pro + Code + Tableaux + Images
 * Orinstudio © 2026-2029
 * ══════════════════════════════════════════════════════════════════
 */

class VyroxApp {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.isProcessing = false;
    this.messageHistory = [];
    this.user = this.safeParse(localStorage.getItem('vyrox_user'), null);
    this.token = localStorage.getItem('vyrox_token');

    this.currentConversationId = null;
    this.conversations = [];

    // Suggestions par défaut
    this.suggestions = [
      { icon: 'fa-code', text: 'Génère un serveur Node.js', prompt: 'Code un serveur HTTP simple en Node.js' },
      { icon: 'fa-image', text: 'Crée une image futuriste', prompt: 'Génère une image cyberpunk détaillée' },
      { icon: 'fa-brain', text: 'Explique la physique quantique', prompt: 'Explique-moi la physique quantique simplement' },
      { icon: 'fa-bug', text: 'Débogue ce code Python', prompt: 'Aide-moi à trouver l\'erreur dans ce code Python' }
    ];

    this.init();
  }

  async init() {
    this.applySavedTheme();
    this.bindEvents();
    this.bindElectronEvents();
    this.checkAuth();
    this.updateUserUI();
    this.renderSuggestions();
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

  /** Échappe le HTML ET les guillemets (sûr dans le texte comme dans les attributs). */
  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  assistantAvatar() {
    return `<img src="/favicon.png" alt="Vyrox AI" class="w-8 h-8 rounded-xl flex-shrink-0 object-cover shadow-md"
      onerror="this.outerHTML='<div class=\\'w-8 h-8 rounded-xl bg-gradient-to-br from-vyrox-cyan to-vyrox-purple flex items-center justify-center flex-shrink-0 shadow-md\\'><i class=\\'fa-solid fa-brain text-white text-sm\\'></i></div>'">`;
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
  // ÉVÉNEMENTS & LIAISON ELECTRON
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

    // Le menu utilisateur (et le lien Admin) est géré par le script inline du HTML.

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

    document.querySelectorAll('.nav-item, .capability-card').forEach(btn => {
      if (!btn.getAttribute('onclick') && !btn.id) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const text = btn.querySelector('span, h3')?.textContent || 'Fonctionnalité';
          this.showToast(`${text} : Bientôt disponible ! 🚀`, 'info');
        });
      }
    });

    this.bindCodeBlockEvents();
  }

  bindElectronEvents() {
    if (window.vyroxElectron) {
      window.vyroxElectron.onNewConversation(() => this.newChat());
      window.vyroxElectron.onShowStats(() => this.showStatsModal());
      window.vyroxElectron.onExportConversation((filePath) => this.exportCurrentConversation(filePath));
      window.vyroxElectron.notify('Vyrox AI', 'Application prête');
    }
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
      html += `<div class="px-3 py-1.5"><span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">${dateLabel}</span></div>`;
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

      // Le champ metadata (JSON) contient { prompt, url, ... } pour les images/scènes
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

      // `data` = { response, type, data: { url, prompt, ... }, conversationId }
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
    messageDiv.className = `message flex gap-4 mb-6 ${role === 'user' ? 'flex-row-reverse' : ''} animate-slide-in`;

    const avatar = role === 'user'
      ? `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-md"><i class="fa-solid fa-user text-white text-xs"></i></div>`
      : this.assistantAvatar();

    const formattedContent = role === 'assistant'
      ? this.formatMessage(content, data)
      : `<p class="whitespace-pre-wrap break-words leading-relaxed dark:text-gray-100 light:text-gray-800">${this.escapeHtml(content)}</p>`;

    const bubbleClass = role === 'user'
      ? 'bg-vyrox-primary/10 border border-vyrox-primary/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]'
      : 'max-w-full w-full';

    messageDiv.innerHTML = `
      ${avatar}
      <div class="flex-1 min-w-0 ${role === 'user' ? 'flex justify-end' : ''}">
        <div class="message-bubble ${bubbleClass}">
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
  // FORMATAGE MARKDOWN PRO (TABLEAUX, CODE, IMAGES)
  // ═══════════════════════════════════════════════════════════════

  getTextColorClass() {
    return 'dark:text-gray-200 light:text-gray-800';
  }

  parseInline(text) {
    const safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const textColor = this.getTextColorClass();

    return safeText
      .replace(/\*\*(.*?)\*\*/g, `<strong class="font-semibold ${textColor}">$1</strong>`)
      .replace(/\*([^*]+)\*/g, `<em class="italic ${textColor}">$1</em>`)
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-black/40 font-mono text-sm text-vyrox-cyan border border-white/10">$1</code>')
      // Images générées par le LLM : seuls les chemins /uploads/generations/ sont acceptés
      .replace(/!\[([^\]]*)\]\((\/uploads\/generations\/[^)\s"'<>]+)\)/g,
        `<span class="block mt-3 max-w-xl"><img src="$2" alt="$1" loading="lazy" class="rounded-lg max-h-[500px] max-w-full border border-vyrox-border">` +
        `<button type="button" data-action="download-media" data-url="$2" data-filename="vyrox-image.png" ` +
        `class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-vyrox-cyan/10 text-vyrox-cyan hover:bg-vyrox-cyan/20 transition-colors">` +
        `<i class="fa-solid fa-download"></i> Télécharger</button></span>`)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-vyrox-cyan hover:text-vyrox-purple transition-colors underline decoration-vyrox-cyan/30 underline-offset-2">$1</a>');
  }

  formatMessage(content, data) {
    if (!content) return '';
    let text = String(content);

    // 1. Convertir les <br> en sauts de ligne
    text = text.replace(/<br\s*\/?>/gi, '\n');

    const codeBlocks = [];
    const tableBlocks = [];

    // 2. Extraire les blocs de code
    text = text.replace(/```([\w+#-]*)[ \t]*\n?([\s\S]*?)```/g, (_, lang, code) => {
      codeBlocks.push(this.renderCodeBlock(lang, code));
      return `\n@@CODEBLOCK${codeBlocks.length - 1}@@\n`;
    });

    // 3. Extraire et parser les tableaux Markdown
    const tableRegex = /((?:^\s*\|.*\|\s*\n)+^\s*\|[\s\-:|]+\|\s*\n(?:^\s*\|.*\|\s*\n?)*)/gm;
    text = text.replace(tableRegex, (match) => {
      const rows = match.trim().split('\n').map(r => r.trim());
      if (rows.length < 2) return match;

      let html = '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-vyrox-border border border-vyrox-border rounded-lg overflow-hidden text-sm">';

      html += '<thead class="bg-vyrox-card/50"><tr>';
      const headers = rows[0].split('|').filter(cell => cell.trim() !== '');
      headers.forEach(h => {
        html += `<th class="px-4 py-3 text-left font-semibold ${this.getTextColorClass()} border-b border-vyrox-border">${this.parseInline(h.trim())}</th>`;
      });
      html += '</tr></thead>';

      html += '<tbody class="divide-y divide-vyrox-border bg-vyrox-bg/30">';
      for (let i = 2; i < rows.length; i++) {
        const cells = rows[i].split('|').filter(cell => cell.trim() !== '');
        if (cells.length > 0) {
          html += `<tr class="hover:bg-vyrox-hover/30 transition-colors">`;
          cells.forEach(c => {
            html += `<td class="px-4 py-3 ${this.getTextColorClass()}">${this.parseInline(c.trim())}</td>`;
          });
          html += '</tr>';
        }
      }
      html += '</tbody></table></div>';

      tableBlocks.push(html);
      return `\n@@TABLE${tableBlocks.length - 1}@@\n`;
    });

    // 4. Parser le reste du Markdown (titres, listes, paragraphes)
    const paragraphs = text.split(/\n\s*\n/);
    const textColor = this.getTextColorClass();

    let html = paragraphs.map(block => {
      block = block.trim();
      if (!block) return '';

      if (/^@@CODEBLOCK\d+@@$/.test(block)) {
        return codeBlocks[parseInt(block.replace(/@@CODEBLOCK(\d+)@@/, '$1'))];
      }
      if (/^@@TABLE\d+@@$/.test(block)) {
        return tableBlocks[parseInt(block.replace(/@@TABLE(\d+)@@/, '$1'))];
      }

      if (/^###\s+(.*)/.test(block)) {
        return `<h3 class="text-lg font-bold mt-5 mb-2 ${textColor}">${this.parseInline(block.replace(/^###\s+/, ''))}</h3>`;
      }
      if (/^##\s+(.*)/.test(block)) {
        return `<h2 class="text-xl font-bold mt-6 mb-3 ${textColor}">${this.parseInline(block.replace(/^##\s+/, ''))}</h2>`;
      }
      if (/^#\s+(.*)/.test(block)) {
        return `<h1 class="text-2xl font-bold mt-6 mb-4 ${textColor}">${this.parseInline(block.replace(/^#\s+/, ''))}</h1>`;
      }

      if (/^>\s+(.*)/.test(block)) {
        const lines = block.split('\n').map(l => l.replace(/^>\s?/, '')).join('<br>');
        return `<blockquote class="border-l-4 border-vyrox-cyan pl-4 py-2 my-4 italic ${textColor} bg-vyrox-card/30 rounded-r-lg">${this.parseInline(lines)}</blockquote>`;
      }

      if (/^[-*]\s+/.test(block) || /^\d+\.\s+/.test(block)) {
        const lines = block.split('\n').filter(l => l.trim());
        const isOrdered = /^\d+\.\s+/.test(lines[0]);
        const tag = isOrdered ? 'ol' : 'ul';
        const items = lines.map(l => {
          const itemContent = l.replace(/^(\d+\.\s+|[-*]\s+)/, '').trim();
          return `<li class="ml-4 mb-1.5 pl-1 ${textColor}">${this.parseInline(itemContent)}</li>`;
        }).join('');
        return `<${tag} class="list-inside space-y-1.5 my-4 ${textColor} marker:text-vyrox-cyan">${items}</${tag}>`;
      }

      if (block.includes('\n')) {
        const lines = block.split('\n').filter(l => l.trim());
        return `<div class="space-y-2 my-3">${lines.map(line =>
          `<p class="${textColor}">${this.parseInline(line.trim())}</p>`
        ).join('')}</div>`;
      }

      return `<p class="mb-3 leading-relaxed ${textColor}">${this.parseInline(block)}</p>`;
    }).join('');

    // 5. Éléments riches : sources, images, scènes
    if (data?.type === 'search' && data.data?.results) {
      html += `<div class="mt-6 space-y-3 border-t border-vyrox-border pt-4">
        <h4 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Sources trouvées</h4>
        ${data.data.results.map(r => {
          const url = /^https?:\/\//i.test(r.url) ? r.url : '#';
          return `<div class="group p-3 rounded-lg bg-vyrox-card/50 border border-vyrox-border hover:border-vyrox-cyan/50 transition-colors">
            <h5 class="font-medium ${textColor} mb-1">${this.escapeHtml(r.title)}</h5>
            <p class="text-sm text-gray-400 mb-2 line-clamp-2">${this.escapeHtml(r.snippet)}</p>
            <a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-medium text-vyrox-cyan hover:text-vyrox-purple transition-colors">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Voir la source
            </a>
          </div>`;
        }).join('')}
      </div>`;
    }

    // Image ou scène générée, avec bouton de téléchargement
    if ((data?.type === 'image_generation' || data?.type === 'video_generation') && data.data?.url) {
      html += this.renderMedia(
        data.data.url,
        data.data.prompt || '',
        data.type === 'video_generation' ? 'video' : 'image'
      );
    }

    return `<div class="prose prose-invert max-w-none">${html}</div>`;
  }

  /** Affiche une image/scène générée + bouton Télécharger. */
  renderMedia(url, prompt, kind = 'image') {
    const safeUrl = this.escapeHtml(url);
    const safePrompt = this.escapeHtml(prompt);
    const isVideo = kind === 'video';
    const filename = `vyrox-${isVideo ? 'scene' : 'image'}-${Date.now()}.png`;

    return `
      <div class="mt-4 rounded-xl overflow-hidden border border-vyrox-border shadow-lg bg-black/20 p-2 max-w-xl">
        <img src="${safeUrl}" alt="${safePrompt}" loading="lazy"
             class="w-full h-auto rounded-lg object-contain max-h-[600px]">
        <div class="mt-2 px-2 pb-1 flex items-center justify-between gap-3">
          <p class="text-xs text-gray-500 italic truncate">${isVideo ? '🎬 Scène' : '🎨 Prompt'} : ${safePrompt}</p>
          <button type="button" data-action="download-media" data-url="${safeUrl}" data-filename="${filename}"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-vyrox-cyan/10 text-vyrox-cyan hover:bg-vyrox-cyan/20 transition-colors flex-shrink-0">
            <i class="fa-solid fa-download"></i> Télécharger
          </button>
        </div>
      </div>`;
  }

  renderCodeBlock(lang, code) {
    const language = (lang || '').toLowerCase();
    const label = language || 'code';
    const clean = code.replace(/^\n+|\s+$/g, '');
    const lineCount = clean.split('\n').length;
    const numbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

    return `
      <div class="code-block my-5 rounded-xl overflow-hidden border border-[#3c3c3c] bg-[#1e1e1e] shadow-2xl" data-lang="${this.escapeHtml(language)}">
        <div class="flex items-center justify-between px-4 py-2.5 bg-[#252526] border-b border-[#3c3c3c]">
          <div class="flex items-center gap-2">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
              <div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
              <div class="w-3 h-3 rounded-full bg-[#27c93f]"></div>
            </div>
            <span class="text-xs font-mono font-medium text-gray-400 ml-2 uppercase">${this.escapeHtml(label)}</span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" data-action="copy-code" title="Copier le code"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              <i class="fa-regular fa-copy"></i> <span class="hidden sm:inline">Copier</span>
            </button>
            <button type="button" data-action="download-code" title="Télécharger"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              <i class="fa-solid fa-download"></i> <span class="hidden sm:inline">Fichier</span>
            </button>
          </div>
        </div>
        <div class="flex overflow-x-auto font-mono text-sm leading-6 custom-scrollbar" style="font-family:'JetBrains Mono', 'Fira Code', monospace">
          <div class="select-none text-right text-gray-600 py-4 pl-4 pr-3 border-r border-[#3c3c3c] whitespace-pre flex-shrink-0 min-w-[3.5rem] bg-[#1e1e1e]" aria-hidden="true">${numbers}</div>
          <pre class="m-0 py-4 px-4 text-[#d4d4d4] flex-1"><code class="whitespace-pre">${this.escapeHtml(clean)}</code></pre>
        </div>
      </div>
    `;
  }

  bindCodeBlockEvents() {
    document.getElementById('messages')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      // Téléchargement d'une image / scène générée
      if (btn.dataset.action === 'download-media') {
        await this.downloadMedia(btn.dataset.url, btn.dataset.filename);
        return;
      }

      const block = btn.closest('.code-block');
      if (!block) return;
      const code = block.querySelector('code').textContent;

      if (btn.dataset.action === 'copy-code') {
        try {
          await navigator.clipboard.writeText(code);
          const icon = btn.querySelector('i');
          const textSpan = btn.querySelector('span');
          icon.className = 'fa-solid fa-check text-green-400';
          if (textSpan) textSpan.textContent = 'Copié !';
          setTimeout(() => {
            icon.className = 'fa-regular fa-copy';
            if (textSpan) textSpan.textContent = 'Copier';
          }, 2000);
        } catch {
          this.showToast('Impossible de copier', 'error');
        }
      }

      if (btn.dataset.action === 'download-code') {
        this.downloadCode(code, block.dataset.lang);
      }
    });
  }

  /** Télécharge une image du serveur via un Blob (force le téléchargement). */
  async downloadMedia(url, filename = 'vyrox-image.png') {
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: objUrl, download: filename });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      this.showToast('Téléchargement lancé', 'success');
    } catch (err) {
      console.error('Téléchargement impossible:', err);
      this.showToast('Téléchargement impossible', 'error');
    }
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
    typing.className = 'message flex gap-4 mb-6 animate-slide-in';
    typing.innerHTML = `
      ${this.assistantAvatar()}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 py-3 px-4 bg-vyrox-card/50 rounded-2xl border border-vyrox-border w-fit">
          <div class="typing-dot w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
          <div class="typing-dot w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
          <div class="typing-dot w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
        </div>
      </div>
    `;
    messagesDiv.appendChild(typing);
    this.scrollToBottom();
    return id;
  }

  removeTyping(id) {
    document.getElementById(id)?.remove();
  }

  // ═══════════════════════════════════════════════════════════════
  // SYSTÈME DE FEEDBACK & EXPORT
  // ═══════════════════════════════════════════════════════════════
  addFeedbackButtons(messageDiv, aiResponse) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'flex items-center gap-2 mt-3 text-xs text-gray-500';
    feedbackDiv.innerHTML = `
      <span class="mr-1">Cette réponse était-elle utile ?</span>
      <button class="feedback-positive px-2 py-1 rounded hover:bg-green-500/20 hover:text-green-500 transition-colors" title="Bonne réponse"><i class="fa-solid fa-thumbs-up"></i></button>
      <button class="feedback-negative px-2 py-1 rounded hover:bg-red-500/20 hover:text-red-500 transition-colors" title="Mauvaise réponse"><i class="fa-solid fa-thumbs-down"></i></button>
    `;

    feedbackDiv.querySelector('.feedback-positive').addEventListener('click', () => {
      this.sendFeedback('positive', aiResponse);
      feedbackDiv.innerHTML = '<span class="text-green-500 font-medium"><i class="fa-solid fa-check"></i> Merci !</span>';
    });

    feedbackDiv.querySelector('.feedback-negative').addEventListener('click', () => {
      this.sendFeedback('negative', aiResponse);
      feedbackDiv.innerHTML = '<span class="text-red-500 font-medium"><i class="fa-solid fa-check"></i> Je vais m\'améliorer !</span>';
    });

    messageDiv.querySelector('.flex-1').appendChild(feedbackDiv);
  }

  async sendFeedback(sentiment, aiResponse) {
    if (!this.token) {
      this.showToast('Connecte-toi pour laisser un feedback', 'info');
      return;
    }
    try {
      // Le serveur attend { sentiment, message, aiResponse }
      const lastUser = [...document.querySelectorAll('.message')]
        .reverse()
        .find(el => el.classList.contains('flex-row-reverse'));
      const userMessage = lastUser?.textContent?.trim() || '(message inconnu)';

      await fetch('/api/feedback', {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sentiment, message: userMessage, aiResponse })
      });
    } catch (error) {
      console.error('Erreur feedback:', error);
    }
  }

  async exportCurrentConversation(electronFilePath = null) {
    if (this.messageHistory.length === 0) {
      this.showToast('Aucune conversation à exporter', 'info');
      return;
    }

    const exportData = {
      conversationId: this.currentConversationId,
      date: new Date().toISOString(),
      messages: this.messageHistory
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vyrox-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    this.showToast('Conversation exportée avec succès', 'success');
  }

  showStatsModal() {
    this.showToast('Statistiques : Fonctionnalité en cours de développement', 'info');
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

  // Suggestions de l'écran d'accueil (listeners au lieu de onclick inline,
  // pour éviter de casser le HTML avec les apostrophes des prompts)
  renderSuggestions() {
    const container = document.getElementById('suggestions');
    if (!container) return;

    container.innerHTML = this.suggestions.map((s, i) => `
      <button type="button" data-suggestion="${i}"
        class="p-4 rounded-xl bg-vyrox-card border border-vyrox-border hover:border-vyrox-cyan/50 hover:bg-vyrox-hover transition-all text-left group">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 rounded-lg bg-vyrox-darker flex items-center justify-center text-vyrox-cyan group-hover:scale-110 transition-transform">
            <i class="fa-solid ${s.icon}"></i>
          </div>
          <span class="font-medium text-sm t1">${this.escapeHtml(s.text)}</span>
        </div>
      </button>
    `).join('');

    container.querySelectorAll('[data-suggestion]').forEach(btn => {
      btn.addEventListener('click', () => {
        const suggestion = this.suggestions[parseInt(btn.dataset.suggestion, 10)];
        if (suggestion) sendSuggestion(suggestion.prompt);
      });
    });
  }
}

// Fonction globale pour les suggestions (compatibilité avec le HTML existant)
function sendSuggestion(text) {
  const input = document.getElementById('messageInput');
  if (!input) return;
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