/**
 * ═══════════════════════════════════════════════════════════
 * VYROX AI — DATABASE MANAGER
 * Système de base de données SQLite avec Mémoire, Feedback et Cerveau Collectif
 * Orinstudio © 2026-2029
 * ═══════════════════════════════════════════════════════════
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class VyroxDatabase {
  constructor(dbPath = path.join(__dirname, 'vyrox.db')) {
    this.db = new Database(dbPath);
    
    // Optimisations SQLite
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    
    this._initializeTables();
    console.log('✅ Base de données SQLite initialisée');
  }

  _initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT DEFAULT 'Nouvelle conversation',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_archived INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id INTEGER PRIMARY KEY,
        theme TEXT DEFAULT 'dark',
        language TEXT DEFAULT 'fr',
        notifications INTEGER DEFAULT 1,
        voice_enabled INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Table de mémoire pour l'apprentissage utilisateur
      CREATE TABLE IF NOT EXISTS user_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        fact_type TEXT NOT NULL,
        fact_value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Table de feedback pour l'amélioration de l'IA
      CREATE TABLE IF NOT EXISTS user_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        sentiment TEXT NOT NULL CHECK(sentiment IN ('positive', 'negative')),
        user_message TEXT NOT NULL,
        ai_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Table des suggestions d'amélioration
      CREATE TABLE IF NOT EXISTS user_improvements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        suggestion TEXT NOT NULL,
        context TEXT,
        is_applied INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- NOUVEAU : Table du Cerveau Collectif (Neurones de connaissance)
      CREATE TABLE IF NOT EXISTS collective_knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger_phrase TEXT NOT NULL,
        response TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        created_by INTEGER,
        is_verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      -- Index pour performances
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_user ON user_feedback(user_id);
      CREATE INDEX IF NOT EXISTS idx_improvements_user ON user_improvements(user_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_trigger ON collective_knowledge(trigger_phrase);
    `);
  }

  // ═══════════════════════════════════════════════════════
  // MÉMOIRE UTILISATEUR
  // ═══════════════════════════════════════════════════════
  saveUserMemory(userId, factType, factValue) {
    this.db.prepare(`DELETE FROM user_memories WHERE user_id = ? AND fact_type = ?`).run(userId, factType);
    
    const result = this.db.prepare(`
      INSERT INTO user_memories (user_id, fact_type, fact_value) VALUES (?, ?, ?)
    `).run(userId, factType, factValue);
    
    return result.lastInsertRowid;
  }

  getUserMemories(userId) {
    return this.db.prepare(`
      SELECT fact_type, fact_value FROM user_memories WHERE user_id = ?
    `).all(userId);
  }

  getSpecificMemory(userId, factType) {
    return this.db.prepare(`
      SELECT fact_value FROM user_memories WHERE user_id = ? AND fact_type = ?
    `).get(userId, factType);
  }

  // ═══════════════════════════════════════════════════════
  // FEEDBACK & AMÉLIORATION
  // ═══════════════════════════════════════════════════════
  saveFeedback(userId, sentiment, userMessage, aiResponse) {
    return this.db.prepare(`
      INSERT INTO user_feedback (user_id, sentiment, user_message, ai_response)
      VALUES (?, ?, ?, ?)
    `).run(userId, sentiment, userMessage, aiResponse);
  }

  saveImprovement(userId, suggestion, context) {
    return this.db.prepare(`
      INSERT INTO user_improvements (user_id, suggestion, context)
      VALUES (?, ?, ?)
    `).run(userId, suggestion, context);
  }

  getFeedbackStats() {
    const positive = this.db.prepare("SELECT COUNT(*) as count FROM user_feedback WHERE sentiment = 'positive'").get().count;
    const negative = this.db.prepare("SELECT COUNT(*) as count FROM user_feedback WHERE sentiment = 'negative'").get().count;
    const total = positive + negative;
    const satisfactionRate = total > 0 ? ((positive / total) * 100).toFixed(1) : 0;
    return { positive, negative, total, satisfactionRate };
  }

  getRecentImprovements(limit = 10) {
    return this.db.prepare(`
      SELECT ui.*, u.username 
      FROM user_improvements ui
      JOIN users u ON ui.user_id = u.id
      ORDER BY ui.created_at DESC
      LIMIT ?
    `).all(limit);
  }

  applyImprovement(id) {
    return this.db.prepare('UPDATE user_improvements SET is_applied = 1 WHERE id = ?').run(id);
  }

  // ═══════════════════════════════════════════════════════
  // CERVEAU COLLECTIF (NOUVEAU)
  // ═══════════════════════════════════════════════════════
  findKnowledgeNode(query) {
    const words = query.toLowerCase().split(' ').filter(w => w.length > 3);
    if (words.length === 0) return null;

    const conditions = words.map(() => `trigger_phrase LIKE ?`).join(' OR ');
    const params = words.map(w => `%${w}%`);
    
    // On prend la réponse la plus upvotée et vérifiée en priorité
    return this.db.prepare(`
      SELECT * FROM collective_knowledge 
      WHERE ${conditions}
      ORDER BY is_verified DESC, upvotes DESC 
      LIMIT 1
    `).get(...params);
  }

  saveKnowledgeNode(userId, triggerPhrase, response, type = 'text') {
    return this.db.prepare(`
      INSERT INTO collective_knowledge (trigger_phrase, response, type, created_by)
      VALUES (?, ?, ?, ?)
    `).run(triggerPhrase, response, type, userId);
  }

  voteKnowledgeNode(nodeId, voteType) {
    if (voteType === 'up') {
      return this.db.prepare('UPDATE collective_knowledge SET upvotes = upvotes + 1 WHERE id = ?').run(nodeId);
    } else {
      return this.db.prepare('UPDATE collective_knowledge SET downvotes = downvotes + 1 WHERE id = ?').run(nodeId);
    }
  }

  getCollectiveBrainStats() {
    const totalNodes = this.db.prepare('SELECT COUNT(*) as count FROM collective_knowledge').get().count;
    const verifiedNodes = this.db.prepare('SELECT COUNT(*) as count FROM collective_knowledge WHERE is_verified = 1').get().count;
    return { totalNodes, verifiedNodes };
  }

  // ═══════════════════════════════════════════════════════
  // UTILISATEURS
  // ═══════════════════════════════════════════════════════
  createUser(username, email, passwordHash) {
    const stmt = this.db.prepare(`
      INSERT INTO users (username, email, password_hash) 
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(username, email, passwordHash);
    return this.getUserById(result.lastInsertRowid);
  }

  getUserByUsername(username) {
    return this.db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  }

  getUserByEmail(email) {
    return this.db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
  }

  getUserById(id) {
    return this.db.prepare('SELECT id, username, email, avatar, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(id);
  }

  updateLastLogin(userId) {
    this.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  }

  getUserCount() {
    return this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
  }

  // ═══════════════════════════════════════════════════════
  // SESSIONS & TOKENS
  // ═══════════════════════════════════════════════════════
  createSession(userId, token, expiresInHours = 72, ip = '', ua = '') {
    const expiresAt = new Date(Date.now() + expiresInHours * 3600000).toISOString();
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    this.db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, token, expiresAt, ip, ua);
    
    return { sessionId, token, expiresAt };
  }

  getSessionByToken(token) {
    return this.db.prepare(`
      SELECT s.*, u.username, u.email 
      FROM sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);
  }

  deleteSession(token) {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  deleteUserSessions(userId) {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  updateSessionActivity(token) {
    this.db.prepare("UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE token = ?").run(token);
  }

  cleanupExpiredSessions() {
    return this.db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  }

  // ═══════════════════════════════════════════════════════
  // CONVERSATIONS
  // ═══════════════════════════════════════════════════════
  createConversation(userId, title = 'Nouvelle conversation') {
    const result = this.db.prepare(`
      INSERT INTO conversations (user_id, title) VALUES (?, ?)
    `).run(userId, title);
    return this.getConversation(result.lastInsertRowid);
  }

  getConversation(id) {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  }

  getUserConversations(userId, limit = 50, offset = 0) {
    return this.db.prepare(`
      SELECT * FROM conversations 
      WHERE user_id = ? AND is_archived = 0 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
  }

  autoUpdateTitle(conversationId) {
    const firstUserMessage = this.db.prepare(`
      SELECT content FROM messages 
      WHERE conversation_id = ? AND role = 'user' 
      ORDER BY timestamp ASC 
      LIMIT 1
    `).get(conversationId);

    if (firstUserMessage && firstUserMessage.content) {
      let title = firstUserMessage.content.trim();
      title = title.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
      
      if (title.length > 50) {
        title = title.substring(0, 50) + '...';
      }
      
      this.updateConversationTitle(conversationId, title);
      return title;
    }
    return null;
  }

  updateConversationTitle(id, title) {
    this.db.prepare(`
      UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(title, id);
  }

  archiveConversation(id) {
    this.db.prepare('UPDATE conversations SET is_archived = 1 WHERE id = ?').run(id);
  }

  deleteConversation(id) {
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  // ═══════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════
  addMessage(conversationId, role, content, type = 'text', metadata = null) {
    const result = this.db.prepare(`
      INSERT INTO messages (conversation_id, role, content, type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(conversationId, role, content, type, metadata ? JSON.stringify(metadata) : null);
    
    this.db.prepare(`
      UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(conversationId);
    
    if (role === 'user') {
      const msgCount = this.db.prepare(`
        SELECT COUNT(*) as count FROM messages 
        WHERE conversation_id = ? AND role = 'user'
      `).get(conversationId);
      
      if (msgCount.count === 1) {
        this.autoUpdateTitle(conversationId);
      }
    }
    
    return this.getMessage(result.lastInsertRowid);
  }

  getMessage(id) {
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  }

  getConversationMessages(conversationId, limit = 100, offset = 0) {
    return this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY timestamp ASC 
      LIMIT ? OFFSET ?
    `).all(conversationId, limit, offset);
  }

  searchMessages(userId, query, limit = 20) {
    return this.db.prepare(`
      SELECT m.*, c.title as conversation_title 
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ? AND m.content LIKE ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `).all(userId, `%${query}%`, limit);
  }

  getConversationStats(conversationId) {
    return this.db.prepare(`
      SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
        MIN(timestamp) as first_message,
        MAX(timestamp) as last_message
      FROM messages 
      WHERE conversation_id = ?
    `).get(conversationId);
  }

  // ═══════════════════════════════════════════════════════
  // PRÉFÉRENCES
  // ═══════════════════════════════════════════════════════
  getUserPreferences(userId) {
    let prefs = this.db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
    if (!prefs) {
      this.db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(userId);
      prefs = this.getUserPreferences(userId);
    }
    return prefs;
  }

  updateUserPreferences(userId, preferences) {
    const { theme, language, notifications, voice_enabled } = preferences;
    this.db.prepare(`
      UPDATE user_preferences 
      SET theme = COALESCE(?, theme),
          language = COALESCE(?, language),
          notifications = COALESCE(?, notifications),
          voice_enabled = COALESCE(?, voice_enabled)
      WHERE user_id = ?
    `).run(theme, language, notifications, voice_enabled, userId);
  }

  // ═══════════════════════════════════════════════════════
  // STATISTIQUES GLOBALES
  // ═══════════════════════════════════════════════════════
  getGlobalStats() {
    const users = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
    const conversations = this.db.prepare('SELECT COUNT(*) as count FROM conversations').get().count;
    const messages = this.db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
    const activeSessions = this.db.prepare("SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime('now')").get().count;
    
    return { users, conversations, messages, activeSessions };
  }

  // ═══════════════════════════════════════════════════════
  // UTILITAIRES
  // ═══════════════════════════════════════════════════════
  transaction(fn) {
    return this.db.transaction(fn)();
  }

  close() {
    this.db.close();
    console.log('🔒 Base de données fermée');
  }
}

module.exports = VyroxDatabase;