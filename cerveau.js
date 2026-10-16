/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CERVEAU COLLECTIF — Système de mémoire et apprentissage pour Vyrox AI
 * Enregistre les interactions pour améliorer les réponses futures
 * Licence © 2026-2029 Orinstudio
 * ══════════════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class CerveauCollectif {
  constructor(options = {}) {
    this.maxKnowledgeNodes = options.maxKnowledgeNodes || 10000;
    this.similarityThreshold = options.similarityThreshold || 0.7;
    this.minConfidence = options.minConfidence || 0.5;
    
    // S'assurer que le dossier de persistance existe
    this.persistencePath = options.persistencePath || path.join(__dirname, 'data', 'cerveau_data.json');
    const dir = path.dirname(this.persistencePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.knowledgeBase = new Map();
    this.conversationHistory = [];
    this.maxHistoryLength = options.maxHistoryLength || 1000;
    
    this.stats = {
      totalInteractions: 0,
      totalKnowledgeNodes: 0,
      totalHits: 0,
      totalMisses: 0,
      averageConfidence: 0,
      lastTraining: null
    };

    this.load();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCKAGE DES INTERACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  recordInteraction(userId, question, response, context = {}) {
    const interaction = {
      id: this.generateId(),
      userId: userId || 'anonymous',
      question: question.trim(),
      response: response,
      timestamp: Date.now(),
      context: {
        sessionId: context.sessionId || null,
        intent: context.intent || null,
        type: context.type || 'llm_response',
        model: context.model || null
      },
      feedback: null,
      confidence: 0,
      hitCount: 0
    };

    this.conversationHistory.push(interaction);
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }

    this.updateKnowledgeNode(interaction);
    this.stats.totalInteractions++;
    this.save();

    return interaction;
  }

  recordFeedback(interactionId, sentiment, comment = '') {
    const interaction = this.conversationHistory.find(i => i.id === interactionId);
    if (!interaction) return false;

    interaction.feedback = { sentiment, comment, timestamp: Date.now() };

    const knowledgeKey = this.generateKnowledgeKey(interaction.question);
    const node = this.knowledgeBase.get(knowledgeKey);
    
    if (node) {
      if (sentiment === 'positive') {
        node.confidence = Math.min(1.0, node.confidence + 0.1);
        node.positiveFeedbacks = (node.positiveFeedbacks || 0) + 1;
      } else {
        node.confidence = Math.max(0, node.confidence - 0.15);
        node.negativeFeedbacks = (node.negativeFeedbacks || 0) + 1;
      }
    }

    this.save();
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BASE DE CONNAISSANCES
  // ═══════════════════════════════════════════════════════════════════════════

  updateKnowledgeNode(interaction) {
    const key = this.generateKnowledgeKey(interaction.question);
    const existingNode = this.knowledgeBase.get(key);

    if (existingNode) {
      existingNode.hitCount++;
      existingNode.lastUsed = Date.now();
      existingNode.variants.push({ question: interaction.question, response: interaction.response, timestamp: Date.now() });

      if (existingNode.variants.length > 5) {
        existingNode.variants.sort((a, b) => b.timestamp - a.timestamp);
        existingNode.variants = existingNode.variants.slice(0, 5);
      }
      existingNode.confidence = Math.min(1.0, existingNode.confidence + 0.05);
    } else {
      const newNode = {
        key,
        canonicalQuestion: interaction.question,
        canonicalResponse: interaction.response,
        variants: [{ question: interaction.question, response: interaction.response, timestamp: Date.now() }],
        confidence: 0.5,
        hitCount: 1,
        positiveFeedbacks: 0,
        negativeFeedbacks: 0,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        tags: this.extractTags(interaction.question),
        context: interaction.context
      };

      this.knowledgeBase.set(key, newNode);
      this.stats.totalKnowledgeNodes = this.knowledgeBase.size;
    }

    if (this.knowledgeBase.size > this.maxKnowledgeNodes) {
      this.pruneKnowledgeBase();
    }
  }

  findBestResponse(question) {
    const key = this.generateKnowledgeKey(question);
    const exactMatch = this.knowledgeBase.get(key);
    
    if (exactMatch && exactMatch.confidence >= this.minConfidence) {
      this.stats.totalHits++;
      exactMatch.hitCount++;
      exactMatch.lastUsed = Date.now();
      this.save();
      return { found: true, response: exactMatch.canonicalResponse, confidence: exactMatch.confidence, source: 'exact_match', node: exactMatch };
    }

    const similarNodes = this.findSimilarNodes(question);
    if (similarNodes.length > 0 && similarNodes[0].similarity >= this.similarityThreshold) {
      this.stats.totalHits++;
      similarNodes[0].node.hitCount++;
      similarNodes[0].node.lastUsed = Date.now();
      this.save();
      return { 
        found: true, 
        response: similarNodes[0].node.canonicalResponse, 
        confidence: similarNodes[0].similarity * similarNodes[0].node.confidence, 
        source: 'similarity_match', 
        node: similarNodes[0].node 
      };
    }

    this.stats.totalMisses++;
    return { found: false, response: null, confidence: 0, source: 'miss' };
  }

  findSimilarNodes(question) {
    const questionWords = this.tokenize(question);
    const results = [];

    for (const [key, node] of this.knowledgeBase.entries()) {
      const similarity = this.calculateSimilarity(questionWords, node.tags);
      if (similarity > 0.3) {
        results.push({ node, similarity });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, 5);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APPRENTISSAGE ET UTILITAIRES
  // ═══════════════════════════════════════════════════════════════════════════

  train() {
    console.log('🧠 Début de l\'entraînement du cerveau collectif...');
    let improvedNodes = 0;

    const positiveInteractions = this.conversationHistory.filter(i => i.feedback && i.feedback.sentiment === 'positive');
    for (const interaction of positiveInteractions) {
      const node = this.knowledgeBase.get(this.generateKnowledgeKey(interaction.question));
      if (node && node.confidence < 0.9) {
        node.confidence = Math.min(1.0, node.confidence + 0.1);
        improvedNodes++;
      }
    }

    const negativeInteractions = this.conversationHistory.filter(i => i.feedback && i.feedback.sentiment === 'negative');
    for (const interaction of negativeInteractions) {
      const node = this.knowledgeBase.get(this.generateKnowledgeKey(interaction.question));
      if (node && node.confidence > 0.3) {
        node.confidence = Math.max(0, node.confidence - 0.2);
        improvedNodes++;
      }
    }

    this.stats.lastTraining = Date.now();
    this.updateAverageConfidence();
    console.log(`✅ Entraînement terminé. ${improvedNodes} nœuds améliorés.`);
    this.save();
  }

  generateKnowledgeKey(question) {
    const normalized = question.toLowerCase().replace(/[^\w\sàâäéèêëïîôùûüçœæ]/gi, '').replace(/\s+/g, ' ').trim();
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  generateId() {
    return 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  tokenize(text) {
    return text.toLowerCase().replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/gi, '').split(/\s+/).filter(t => t.length > 2);
  }

  extractTags(question) {
    const words = this.tokenize(question);
    const tags = new Set(words);
    if (/comment|faire|procéder/i.test(question)) tags.add('howto');
    if (/quoi|c'est|définition/i.test(question)) tags.add('definition');
    if (/pourquoi|raison/i.test(question)) tags.add('why');
    if (/qui|personne|auteur/i.test(question)) tags.add('who');
    if (/quand|date|heure/i.test(question)) tags.add('when');
    if (/où|lieu|endroit/i.test(question)) tags.add('where');
    if (/combien|prix|coût/i.test(question)) tags.add('quantity');
    return Array.from(tags);
  }

  calculateSimilarity(words1, words2) {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  updateAverageConfidence() {
    let totalConfidence = 0;
    let count = 0;
    for (const node of this.knowledgeBase.values()) {
      totalConfidence += node.confidence;
      count++;
    }
    this.stats.averageConfidence = count > 0 ? totalConfidence / count : 0;
  }

  pruneKnowledgeBase() {
    const toDelete = [];
    for (const [key, node] of this.knowledgeBase.entries()) {
      if (node.confidence < 0.2 && node.hitCount < 3) toDelete.push(key);
    }
    for (const key of toDelete) this.knowledgeBase.delete(key);
    console.log(`🗑️ Nettoyage cerveau : ${toDelete.length} nœuds supprimés`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTANCE
  // ═══════════════════════════════════════════════════════════════════════════

  save() {
    try {
      const data = {
        knowledgeBase: Array.from(this.knowledgeBase.entries()),
        conversationHistory: this.conversationHistory,
        stats: this.stats,
        savedAt: Date.now()
      };
      fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Erreur sauvegarde cerveau:', error.message);
    }
  }

  load() {
    try {
      if (fs.existsSync(this.persistencePath)) {
        const data = JSON.parse(fs.readFileSync(this.persistencePath, 'utf8'));
        this.knowledgeBase = new Map(data.knowledgeBase || []);
        this.conversationHistory = data.conversationHistory || [];
        this.stats = data.stats || this.stats;
        console.log(`🧠 Cerveau chargé : ${this.knowledgeBase.size} nœuds, ${this.conversationHistory.length} interactions`);
      }
    } catch (error) {
      console.error('❌ Erreur chargement cerveau:', error.message);
    }
  }

  getStats() {
    return {
      ...this.stats,
      knowledgeBaseSize: this.knowledgeBase.size,
      historyLength: this.conversationHistory.length,
      topNodes: this.getTopNodes(10)
    };
  }

  getTopNodes(count = 10) {
    const nodes = Array.from(this.knowledgeBase.values());
    nodes.sort((a, b) => b.hitCount - a.hitCount);
    return nodes.slice(0, count).map(n => ({ question: n.canonicalQuestion, hits: n.hitCount, confidence: n.confidence }));
  }

  clear() {
    this.knowledgeBase.clear();
    this.conversationHistory = [];
    this.stats = { totalInteractions: 0, totalKnowledgeNodes: 0, totalHits: 0, totalMisses: 0, averageConfidence: 0, lastTraining: null };
    this.save();
    console.log('🧹 Cerveau réinitialisé');
  }
}

module.exports = CerveauCollectif;