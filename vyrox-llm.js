/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VYROX LLM — Moteur LLM multi-modèles
 * Rotation automatique des modèles/quotas + function calling (recherche,
 * génération d'images/vidéos avec filigrane Vyrox) + citation des sources.
 * Licence © 2026-2029 Orinstudio
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const { generateImageBuffer } = require('./image-service');
const { generateVideoBuffer } = require('./video-service');

// npm install sharp
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn("⚠️ Module 'sharp' non trouvé. Le filigrane sera désactivé. Installez-le via: npm install sharp");
}

class VyroxLLM {
  /**
   * @param {object}   opts
   * @param {object}   opts.db        Base de données (mémoires utilisateur), optionnel
   * @param {object}   opts.stats     Objet de stats partagé avec l'orchestrateur
   * @param {Function} opts.searchFn  (query, lang) => Promise<{results:[{title,snippet,url}]}>
   */
  constructor({ db = null, stats = {}, searchFn = null } = {}) {
    this.db = db;
    this.stats = stats;
    this.searchFn = searchFn;

    this.outputDir = path.join(__dirname, 'public', 'uploads', 'generations');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    this.models = this._initModelChain();
    this.currentModelIndex = 0;
    this.modelQuotas = this._initQuotas();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION MULTI-MODÈLES
  // Les identifiants sont configurables via .env pour éviter de modifier le code :
  //   GROQ_API_KEY, GROQ_MODEL, GROQ_FALLBACK_MODEL
  //   OPENROUTER_API_KEY, OPENROUTER_MODEL
  // ═══════════════════════════════════════════════════════════════════════════

  _initModelChain() {
    return [
      {
        name: 'Groq (principal)',
        apiKey: process.env.GROQ_API_KEY || '',
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        maxTokens: 8192,
        supportsTools: true,
        enabled: true
      },
      {
        name: 'Groq (secours)',
        apiKey: process.env.GROQ_API_KEY || '',
        model: process.env.GROQ_FALLBACK_MODEL || 'qwen/qwen3-32b',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        maxTokens: 8192,
        supportsTools: true,
        enabled: true
      },
      {
        // Modèle OpenRouter configurable : choisis un modèle ":free" ou un modèle payant
        // (un modèle payant renverra 402 si le compte n'a pas de crédits -> bascule auto).
        name: 'OpenRouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        maxTokens: 4096,
        supportsTools: true,
        enabled: true
      }
    ].filter(m => m.apiKey && m.apiKey.length >= 10);
  }

  _initQuotas() {
    return this.models.map((model, index) => ({
      index, name: model.name, requestsToday: 0, errorsToday: 0,
      quotaExhausted: false, lastError: null, lastUsed: null
    }));
  }

  getCurrentModel() { return this.models[this.currentModelIndex]; }
  getCurrentQuota() { return this.modelQuotas[this.currentModelIndex]; }

  isAvailable() {
    return this.models.length > 0 && this.modelQuotas.some(q => !q.quotaExhausted);
  }

  switchToNextModel(reason = 'Quota épuisé') {
    const previousIndex = this.currentModelIndex;
    console.warn(`⚠️ Changement de modèle: ${this.models[previousIndex].name} → suivant (${reason})`);

    this.modelQuotas[previousIndex].quotaExhausted = true;
    this.modelQuotas[previousIndex].lastError = reason;

    for (let i = 1; i <= this.models.length; i++) {
      const next = (previousIndex + i) % this.models.length;
      if (!this.modelQuotas[next].quotaExhausted && this.models[next].enabled) {
        this.currentModelIndex = next;
        this.stats.modelSwitches = (this.stats.modelSwitches || 0) + 1;
        console.log(`✅ Nouveau modèle actif: ${this.models[next].name}`);
        return true;
      }
    }
    console.error('❌ Tous les modèles sont épuisés ou en erreur. Activation du mode local.');
    return false;
  }

  resetQuotas() {
    this.modelQuotas = this._initQuotas();
    this.currentModelIndex = 0;
    console.log('🔄 Quotas réinitialisés. Modèle principal: ' + (this.models[0]?.name || 'aucun'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APPEL LLM + FUNCTION CALLING
  // ═══════════════════════════════════════════════════════════════════════════

  _getTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'search_wikipedia',
          description: "Rechercher des informations factuelles, des définitions, des actualités ou des données précises sur Wikipédia.",
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: "La requête de recherche précise." },
              lang: { type: 'string', enum: ['fr', 'en', 'es', 'de'], description: "Langue de la recherche." }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'generate_image',
          description: "Génère une image réaliste ou artistique basée sur une description textuelle détaillée. Utilise cet outil quand l'utilisateur demande de 'générer', 'créer' ou 'dessiner' une image.",
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: "La description détaillée de l'image à générer (en anglais de préférence pour de meilleurs résultats)." }
            },
            required: ['prompt']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'generate_video',
          description: "Génère une courte séquence vidéo ou une image cinématique basée sur une description. Utilise cet outil quand l'utilisateur demande explicitement une 'vidéo' ou une 'animation'.",
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: "La description de la scène vidéo à générer." }
            },
            required: ['prompt']
          }
        }
      }
    ];
  }

  _buildSystemPrompt(userContext) {
    return `Tu es Vyrox, une intelligence artificielle avancée développée par Orinstudio (© 2026-2029).
Tu es utile, précis, amical et tu parles principalement en français.

RÈGLES STRICTES :
1. Si la question concerne des faits, dates, définitions ou actualités, utilise l'outil 'search_wikipedia'.
2. Si l'utilisateur demande une image, utilise l'outil 'generate_image'.
3. Si l'utilisateur demande une vidéo, utilise l'outil 'generate_video'.
4. Ne fabrique jamais d'information. Cite tes sources si tu utilises la recherche.
5. Pour les questions simples, réponds directement sans outil.
6. Quand un outil renvoie une URL d'image, inclus-la telle quelle dans ta réponse au format Markdown : ![description](URL).

${userContext}
Réponds de manière concise et naturelle.`;
  }

  _getUserContext(userId) {
    if (!this.db || !userId) return '';
    const memories = this.db.getUserMemories(userId);
    if (!memories || memories.length === 0) return '';
    return "\n[CONTEXTE UTILISATEUR] : " +
      memories.map(m => `${m.fact_type} = ${m.fact_value}`).join(', ');
  }

  _request(model, body) {
    return fetch(model.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${model.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    });
  }

  /** Télécharge un buffer depuis une URL (fetch natif, suit les redirections). */
  async _downloadBuffer(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Filigrane "Vyrox AI" calé sur les dimensions réelles de l'image. */
  async _applyWatermark(buffer) {
    if (!sharp) return buffer;
    const { width, height } = await sharp(buffer).metadata();
    const fontSize = Math.max(20, Math.floor(width / 25));
    const y = Math.floor(height * 0.95);
    const svg = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="${width / 2 + 2}" y="${y + 2}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(0,0,0,0.6)" text-anchor="middle">Vyrox AI</text>
        <text x="${width / 2}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,0.7)" text-anchor="middle">Vyrox AI</text>
      </svg>`
    );
    return sharp(buffer).composite([{ input: svg, top: 0, left: 0 }]).toBuffer();
  }

  async _generatePollinations(prompt, suffix, width, height, prefix) {
    const buffer = await generateImageBuffer(prompt, { width, height, suffix });
    const finalBuffer = await this._applyWatermark(buffer);

    const filename = `${prefix}_${Date.now()}.png`;
    fs.writeFileSync(path.join(this.outputDir, filename), finalBuffer);
    return `/uploads/generations/${filename}`;
  }

  /** Exécute les appels d'outils demandés par le LLM. */
  async _runToolCalls(toolCalls) {
    const results = [];
    for (const call of toolCalls) {
      const name = call.function?.name;
      let content = "Outil inconnu ou erreur d'exécution.";
      let args = null;

      try {
        args = JSON.parse(call.function?.arguments || '{}');
      } catch {
        results.push({ role: 'tool', tool_call_id: call.id, name, content: 'Arguments invalides.' });
        continue;
      }

      try {
        if (name === 'search_wikipedia' && this.searchFn) {
          const found = await this.searchFn(args.query || '', args.lang || 'fr');
          content = found.results?.length
            ? 'Résultats :\n' + found.results.map(r => `- ${r.title}: ${r.snippet} (${r.url})`).join('\n')
            : 'Aucun résultat trouvé.';
        } else if (name === 'generate_image') {
          this.stats.totalImages = (this.stats.totalImages || 0) + 1;
          const url = await this._generatePollinations(args.prompt || 'abstract art', 'high quality, masterpiece, 8k', 1024, 1024, 'vyrox_img');
          content = `✅ Image générée. URL relative : ${url}. Affiche-la avec ![image](${url}).`;
        } else if (name === 'generate_video') {
          this.stats.totalVideos = (this.stats.totalVideos || 0) + 1;
          const url = await this._generatePollinations(args.prompt || 'cinematic scene', 'motion blur, dynamic angle, 4k, cinematic lighting', 1024, 576, 'vyrox_vid');
          content = `✅ Scène cinématique générée. URL relative : ${url}. Affiche-la avec ![scène](${url}) en la présentant comme une capture de la vidéo demandée.`;
        }
      } catch (err) {
        content = `❌ Échec de l'outil ${name} : ${err.userMessage || err.message}. Explique le problème à l'utilisateur sans réessayer.`;
      }

      results.push({ role: 'tool', tool_call_id: call.id, name, content });
    }
    return results;
  }

  /** Génère une réponse via le LLM (renvoie une chaîne, ou null si indisponible). */
  async chat(userMessage, sessionHistory = [], userId = null, retryCount = 0) {
    if (!this.isAvailable()) return null;

    const model = this.getCurrentModel();
    const quota = this.getCurrentQuota();
    const args = [userMessage, sessionHistory, userId, retryCount];

    const messages = [
      { role: 'system', content: this._buildSystemPrompt(this._getUserContext(userId)) },
      ...sessionHistory.slice(-8).map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content ?? '')
      })),
      { role: 'user', content: userMessage }
    ];

    try {
      this.stats.totalLLMCalls = (this.stats.totalLLMCalls || 0) + 1;
      quota.requestsToday++;
      quota.lastUsed = new Date().toISOString();

      const requestBody = {
        model: model.model,
        messages,
        stream: false,
        temperature: 0.5,
        max_tokens: model.maxTokens
      };

      if (model.supportsTools !== false) {
        requestBody.tools = this._getTools();
        requestBody.tool_choice = 'auto';
      }

      // Étape 1 : appel initial
      const res = await this._request(model, requestBody);
      if (!res.ok) return await this._onHttpError(res, quota, args);

      const assistantMsg = (await res.json()).choices?.[0]?.message;
      if (!assistantMsg) return null;

      // Étape 2 : outils éventuels
      if (assistantMsg.tool_calls?.length) {
        messages.push(assistantMsg, ...(await this._runToolCalls(assistantMsg.tool_calls)));

        // Second appel pour la synthèse (sans outils pour éviter les boucles)
        const finalRes = await this._request(model, {
          model: model.model,
          messages,
          stream: false,
          temperature: 0.5,
          max_tokens: model.maxTokens
        });
        if (!finalRes.ok) return await this._onHttpError(finalRes, quota, args);
        return (await finalRes.json()).choices?.[0]?.message?.content || null;
      }

      return assistantMsg.content || null;

    } catch (error) {
      console.warn(`⚠️ Erreur réseau ${model.name}:`, error.message);
      quota.errorsToday++;
      quota.lastError = error.message;
      return this._failover('Erreur réseau', args);
    }
  }

  async _onHttpError(res, quota, args) {
    const errData = await res.json().catch(() => ({}));
    const errorMsg = errData.error?.message || res.statusText || '';
    const lower = errorMsg.toLowerCase();
    const status = res.status;

    console.warn(`⚠️ Erreur API ${this.getCurrentModel().name} (${status}):`, errorMsg);

    const isConfigError = status === 400 && (lower.includes('max_tokens') || lower.includes('tool'));
    const isModelError = status === 404; // identifiant de modèle inexistant
    const isCreditError = status === 402;
    const isQuota = status === 429 || ['quota', 'rate limit'].some(k => lower.includes(k));

    if (isConfigError || isModelError || isCreditError || isQuota) {
      return this._failover(`Erreur API (${status}: ${errorMsg.split(':')[0]})`, args);
    }

    quota.errorsToday++;
    quota.lastError = errorMsg;
    return null;
  }

  async _failover(reason, [userMessage, sessionHistory, userId, retryCount]) {
    if (retryCount < this.models.length && this.switchToNextModel(reason)) {
      return this.chat(userMessage, sessionHistory, userId, retryCount + 1);
    }
    return null;
  }

  getStatus() {
    return {
      currentModel: this.getCurrentModel()?.name || 'Local',
      modelIndex: this.currentModelIndex,
      totalModels: this.models.length,
      modelsStatus: this.modelQuotas.map(q => ({
        name: q.name, requestsToday: q.requestsToday, errorsToday: q.errorsToday,
        quotaExhausted: q.quotaExhausted, lastUsed: q.lastUsed
      }))
    };
  }
}

module.exports = VyroxLLM;