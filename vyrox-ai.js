/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VYROX AI — Orchestrateur
 * Relie l'IA locale (vyrox-local-ai.js) et l'IA LLM (vyrox-llm.js).
 * Garde la même API publique : require('./vyrox-ai') → new VyroxAI(db)
 * Licence © 2026-2029 Orinstudio
 * ═══════════════════════════════════════════════════════════════════════════
 */

const VyroxLocalAI = require('./vyrox-local-ai');
const VyroxLLM = require('./vyrox-llm');

class VyroxAI {
  constructor(databaseInstance = null) {
    this.db = databaseInstance;
    this.sessions = new Map();
    this.stats = {
      totalMessages: 0, totalImages: 0, totalSearches: 0, totalDefinitions: 0,
      totalLLMCalls: 0, totalCollectiveHits: 0, modelSwitches: 0, startTime: Date.now()
    };

    this.local = new VyroxLocalAI(this.db, this.stats);
    this.llm = new VyroxLLM({
      db: this.db,
      stats: this.stats,
      searchFn: (query, lang) => this.local.search(query, lang)
    });

    // Réinitialisation automatique des quotas toutes les 24 h
    setInterval(() => this.llm.resetQuotas(), 24 * 60 * 60 * 1000).unref();
  }

  // ── Routeur principal ────────────────────────────────────────────────────
  async process(message, sessionId = 'default', userId = null) {
    this.stats.totalMessages++;

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { history: [], turnCount: 0, createdAt: Date.now() });
    }
    const session = this.sessions.get(sessionId);
    session.turnCount++;

    const tokens = this.local.tokenize(message);
    const { intent } = this.local.detectIntent(tokens);

    // 1) IA locale : intentions connues
    let result = await this.local.handle(intent, message, tokens, session, userId);

    // 2) Cerveau Collectif
    if (!result) result = this.local.findCollective(message);

    // 3) IA LLM
    if (!result) {
      const text = await this.llm.chat(message, session.history, userId);
      result = text !== null
        ? { response: text, type: 'llm_response', data: null }
        // 4) Repli sur l'IA locale si aucun LLM n'est disponible
        : { response: this.local.fallback(message), type: 'local_fallback', data: null };
    }

    const { response, type, data } = result;
    this._updateSessionHistory(session, message, response, type);

    return { response, type, data, sessionId, userId, timestamp: new Date().toISOString(), stats: this.getStats() };
  }

  _updateSessionHistory(session, userMsg, botResponse, type) {
    session.history.push({ role: 'user', content: userMsg, time: Date.now() });
    session.history.push({ role: 'assistant', content: botResponse, type, time: Date.now() });
    if (session.history.length > 12) session.history = session.history.slice(-12);
  }

  // ── API publique conservée (délégations) ─────────────────────────────────
  search(query, lang) { return this.local.search(query, lang); }
  generateImage(prompt) { return this.local.generateImage(prompt); }
  resetQuotas() { return this.llm.resetQuotas(); }
  getCurrentModel() { return this.llm.getCurrentModel(); }
  getCurrentQuota() { return this.llm.getCurrentQuota(); }
  switchToNextModel(reason) { return this.llm.switchToNextModel(reason); }

  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      activeSessions: this.sessions.size,
      version: '5.0.0 (IA locale + LLM séparés)',
      license: 'Orinstudio © 2026-2029',
      ...this.llm.getStatus()
    };
  }
}

module.exports = VyroxAI;