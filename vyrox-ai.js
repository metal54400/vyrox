/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VYROX AI ENGINE — VERSION ULTIME HYBRIDE
 * Moteur LLM (Groq/OpenAI) + Cerveau Collectif + Apprentissage Local
 * Licence © 2026-2029 Orinstudio
 * ═══════════════════════════════════════════════════════════════════════════
 */

const https = require('https');

class VyroxAI {
  constructor(databaseInstance = null) {
    this.db = databaseInstance;
    this.sessions = new Map();
    this.stats = {
      totalMessages: 0,
      totalImages: 0,
      totalSearches: 0,
      totalDefinitions: 0,
      totalLLMCalls: 0,
      totalCollectiveHits: 0,
      startTime: Date.now()
    };

    // Configuration LLM (Groq / OpenAI compatible)
    this.apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    this.apiEndpoint = process.env.API_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';

    // Dictionnaires humains
    this.greetings = this._buildGreetings();
    this.farewells = this._buildFarewells();
    this.thanks = this._buildThanks();
    this.intents = this._buildIntents();
    this.codeTemplates = this._buildCodeTemplates();
    this.knowledgeBase = this._buildKnowledgeBase();
    this.responses = this._buildResponses();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DICTIONNAIRES HUMAINS
  // ═══════════════════════════════════════════════════════════════════════════
  _buildGreetings() {
    return {
      formal: ["Bonjour ! Comment puis-je vous aider aujourd'hui ?", "Bien le bonjour ! En quoi puis-je vous être utile ?"],
      casual: ["Salut ! Ça va ? Qu'est-ce que je peux faire pour toi ?", "Hey ! Content de te voir."],
      time_based: {
        morning: ["Bonjour ! Belle journée pour commencer, non ?"],
        afternoon: ["Bon après-midi ! On continue sur notre lancée ?"],
        evening: ["Bonsoir ! On termine la journée en beauté ?"],
        night: ["Bonsoir ! Les noctambules aussi ont droit à une IA."]
      }
    };
  }

  _buildFarewells() {
    return ["Au revoir ! N'hésite pas à revenir.", "À bientôt ! Prends soin de toi.", "Ciao ! Bonne continuation."];
  }

  _buildThanks() {
    return ["Avec plaisir !", "De rien ! Je suis là pour ça.", "Content d'avoir pu aider !"];
  }

  _buildKnowledgeBase() {
    return {
      javascript: { description: "JavaScript est un langage de programmation dynamique et multi-paradigme.", features: ["Dynamiquement typé", "Multi-paradigme", "Exécution côté client ET serveur"], uses: ["Sites web", "Node.js", "React Native"], fun_fact: "Créé en 10 jours par Brendan Eich en 1995 !" },
      python: { description: "Python est un langage interprété de haut niveau, célèbre pour sa syntaxe claire.", features: ["Syntaxe lisible", "Typage dynamique", "Multi-paradigme"], uses: ["IA", "Data science", "Web"], fun_fact: "Nommé d'après Monty Python, pas le serpent !" },
      html: { description: "HTML est le squelette de toutes les pages web.", features: ["Structure sémantique", "DOM hiérarchique", "Compatible tous navigateurs"], uses: ["Pages web", "Applications", "Emails"], fun_fact: "La première page web (1991) est toujours en ligne au CERN !" },
      css: { description: "CSS transforme un HTML brut en belle interface visuelle.", features: ["Sélecteurs puissants", "Flexbox et Grid", "Animations"], uses: ["Design", "Animations", "Responsive"], fun_fact: "Proposé par Håkon Wium Lie en 1994." },
      ai: { description: "L'IA vise à créer des machines capables de simuler l'intelligence humaine.", features: ["Machine Learning", "Deep Learning", "NLP"], uses: ["Assistants vocaux", "Recommandations", "Véhicules autonomes"], fun_fact: "Terme inventé en 1956 à la conférence de Dartmouth." },
      orinstudio: { description: "Orinstudio est un studio de développement créatif.", features: ["Développement sur mesure", "IA made in house", "Design futuriste"], uses: ["Projets web", "Apps IA", "Branding"], fun_fact: "Vyrox est 100% fait maison sans LLM externe par défaut !" }
    };
  }

  _buildIntents() {
    return {
      greeting: { patterns: ['bonjour', 'salut', 'hello', 'hi', 'hey', 'coucou', 'bonsoir', 'slt', 'bjr', 'cc'], weight: 1 },
      farewell: { patterns: ['au revoir', 'bye', 'ciao', 'à plus', 'bonne nuit', 'bonne journée'], weight: 1 },
      thanks: { patterns: ['merci', 'thanks', 'super', 'génial', 'parfait', 'cool', 'top'], weight: 1 },
      identity: { patterns: ['qui es-tu', 'qui es tu', 'ton nom', 'tu es qui', 'présente-toi', 'c\'est quoi vyrox'], weight: 2 },
      capabilities: { patterns: ['que sais-tu faire', 'tes capacités', 'que peux-tu', 'help', 'aide', 'commandes'], weight: 2 },
      code_request: { patterns: ['génère', 'genere', 'code', 'écris', 'ecris', 'script', 'programme', 'crée un', 'creer un'], languages: ['javascript', 'python', 'html', 'css', 'java', 'c++', 'php', 'ruby', 'go', 'rust', 'typescript', 'sql'], weight: 3 },
      image_request: { patterns: ['génère une image', 'genere une image', 'crée une image', 'dessine', 'image de', 'picture'], weight: 3 },
      search_request: { patterns: ['recherche', 'cherche', 'search', 'trouve', 'find', 'google', 'info sur'], weight: 2 },
      knowledge: { patterns: ['c\'est quoi', 'qu\'est-ce que', 'définition', 'explique', 'raconte-moi'], weight: 2 },
      math: { patterns: ['combien font', 'calcule', 'calcul', 'math', 'plus', 'moins', 'fois', 'divisé'], weight: 3 },
      joke: { patterns: ['blague', 'joke', 'drôle', 'drole', 'humour', 'fais moi rire'], weight: 1 },
      time: { patterns: ['quelle heure', 'heure', 'date', 'jour', 'mois', 'année'], weight: 2 },
      feelings: { patterns: ['ça va', 'comment vas-tu', 'tu vas bien', 'fatigué', 'stressé', 'content', 'triste'], weight: 1 },
      compliment: { patterns: ['bravo', 'bien joué', 'chapeau', 'respect', 'gg'], weight: 1 },
      insult: { patterns: ['nul', 'stupide', 'idiot', 'débile'], weight: 1 },
      define_word: { patterns: ['définition de', 'que veut dire', 'que signifie', 'définis', 'definition of', 'what does'], weight: 4 },
      learn_fact: { patterns: ['je m\'appelle', 'mon nom est', 'j\'aime', 'je déteste', 'retiens que', 'n\'oublie pas que'], weight: 4 },
      recall_fact: { patterns: ['comment je m\'appelle', 'qu\'est-ce que j\'aime', 'tu te souviens de', 'que sais-tu sur moi'], weight: 4 },
      teach_ai: { patterns: ['apprends que', 'la réponse est', 'tu dois répondre', 'je t\'apprends que', 'retiens que la réponse'], weight: 5 },
      feedback_positive: { patterns: ['bonne réponse', 'c\'est parfait', 'exactement', 'très bien', 'super réponse'], weight: 3 },
      feedback_negative: { patterns: ['mauvaise réponse', 'c\'est faux', 'incorrect', 'pas du tout'], weight: 3 },
      suggest_improvement: { patterns: ['tu devrais', 'il faudrait', 'améliore', 'corrige'], weight: 4 }
    };
  }

  _buildCodeTemplates() {
    return {
      javascript: {
        hello: `// 🚀 Hello World en JavaScript\nconsole.log("Hello, World!");\n\nfunction saluer(nom) {\n  return \`Bonjour \${nom} !\`;\n}\nconsole.log(saluer("Développeur"));`,
        server: `// 🖥️ Serveur HTTP Node.js natif\nconst http = require('http');\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'text/html' });\n  res.end('<h1>Mon Serveur Node.js</h1>');\n});\nserver.listen(3000, () => console.log('Serveur actif sur http://localhost:3000'));`,
        api: `// 🌐 Client API moderne avec fetch\nasync function fetchData(url) {\n  try {\n    const response = await fetch(url);\n    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);\n    return await response.json();\n  } catch (error) {\n    console.error('❌ Erreur:', error.message);\n  }\n}\nfetchData('https://api.example.com/data').then(console.log);`
      },
      python: {
        hello: `#  Hello World en Python\nprint("Hello, World!")\n\ndef saluer(nom):\n    return f"Bonjour {nom} !"\n\nprint(saluer("Développeur"))`,
        class: `# 🏗️ Classe Python avec héritage\nclass Animal:\n    def __init__(self, nom, son):\n        self.nom = nom\n        self.son = son\n    def parler(self):\n        return f"{self.nom} fait {self.son}"\n\nclass Chien(Animal):\n    def __init__(self, nom):\n        super().__init__(nom, "Wouf!")\n\nchien = Chien("Rex")\nprint(chien.parler())`
      },
      html: {
        page: `<!DOCTYPE html>\n<html lang="fr">\n<head>\n    <meta charset="UTF-8">\n    <title>Ma Page Moderne</title>\n    <style>\n        body { font-family: sans-serif; background: linear-gradient(135deg, #667eea, #764ba2); color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }\n        .container { text-align: center; padding: 2rem; background: rgba(255,255,255,0.1); border-radius: 20px; backdrop-filter: blur(10px); }\n    </style>\n</head>\n<body>\n    <div class="container">\n        <h1>✨ Bienvenue</h1>\n        <p>Ma première page HTML moderne</p>\n    </div>\n</body>\n</html>`
      },
      css: {
        animations: `/* 🎨 Animations CSS modernes */\n@keyframes float {\n    0%, 100% { transform: translateY(0px); }\n    50% { transform: translateY(-20px); }\n}\n.card {\n    background: linear-gradient(135deg, #1a1a2e, #16213e);\n    border-radius: 16px;\n    padding: 2rem;\n    animation: float 3s ease-in-out infinite;\n    transition: all 0.3s ease;\n}\n.card:hover {\n    transform: scale(1.05);\n}`
      }
    };
  }

  _buildResponses() {
    return {
      jokes: [
        "Pourquoi les programmeurs préfèrent-ils le mode sombre ? Parce que la lumière attire les bugs ! 🐛",
        "Un développeur va au supermarché. Sa femme lui dit : 'Achète une bouteille de lait, et s'ils ont des œufs, prends-en 6.' Il revient avec 6 bouteilles de lait. 'Ils avaient des œufs.' 🥛",
        "Combien de développeurs faut-il pour changer une ampoule ? Aucun, c'est un problème hardware ! 💡",
        "Il y a 10 types de personnes dans le monde : celles qui comprennent le binaire et les autres. 🤓"
      ],
      feelings_positive: ["Super content que tu ailles bien ! Moi aussi, je suis en pleine forme. 😊", "Tant mieux ! Qu'est-ce qu'on fait de beau aujourd'hui ?"],
      feelings_negative: ["Oh mince, désolé d'entendre ça. Tu veux en parler ou préfères qu'on change de sujet ?", "Je comprends, ça arrive à tout le monde. Prends ton temps, je suis là."],
      compliment_responses: ["Oh, merci ! Ça fait plaisir. 😊", "Haha, tu es trop gentil !", "Merci ! C'est motivant."],
      insult_responses: ["Ouch... J'essaie de faire de mon mieux.", "Hmm, pas cool. Je suis encore en apprentissage.", "Je comprends ta frustration. Dis-moi ce qui ne va pas."],
      feedback_thanks: ["Merci pour ton retour ! Ça m'aide à m'améliorer. 🙏", "Super, je note ton feedback ! ", "Noté ! Chaque retour me rend meilleur. 🚀"],
      improvement_ack: ["Merci pour la suggestion ! Je vais en tenir compte. ", "Bonne remarque ! J'apprends de mes erreurs. 🧠"],
      learning_prompts: [
        "🧠 Hmm, je n'ai pas encore ce **neurone de connaissance** dans mon cerveau.\n\nPuisque je suis une IA qui apprend grâce à ses utilisateurs, **peux-tu m'apprendre la réponse ?**\n\n*(Écris simplement la réponse que je devrais donner à l'avenir, et je la sauvegarderai pour tout le monde !)*",
        " Cette question n'existe pas encore dans ma base collective. Peux-tu être mon professeur aujourd'hui ? Donne-moi la meilleure réponse possible et je l'ajouterai à mon savoir communautaire !",
        "Je ne connais pas encore la réponse à cela, mais TOI peut-être ! Écris-la moi, et je la retiendrai pour aider les prochains utilisateurs. 🌟"
      ]
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NLP & DÉTECTION D'INTENTION
  // ══════════════════════════════════════════════════════════════════════════
  tokenize(text) {
    return text.toLowerCase().replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/gi, '').split(/\s+/).filter(t => t.length > 0);
  }

  detectIntent(tokens) {
    const text = tokens.join(' ');
    const scores = {};
    for (const [intent, config] of Object.entries(this.intents)) {
      scores[intent] = 0;
      if (config.patterns) {
        for (const pattern of config.patterns) {
          if (text.includes(pattern)) scores[intent] += pattern.split(' ').length * (config.weight || 1);
        }
      }
    }
    let bestIntent = null, bestScore = 0;
    for (const [intent, score] of Object.entries(scores)) {
      if (score > bestScore) { bestScore = score; bestIntent = intent; }
    }
    return { intent: bestIntent, score: bestScore };
  }

  detectEmotion(text) {
    const lower = text.toLowerCase();
    if (/merci|super|génial|parfait|excellent|cool|top/.test(lower)) return 'positive';
    if (/nul|stupide|merde|idiot|débile/.test(lower)) return 'negative';
    if (/triste|marre|fatigué|stress|énervé/.test(lower)) return 'sad';
    if (/blague|rire|drôle|humour/.test(lower)) return 'fun';
    return 'neutral';
  }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 23) return 'evening';
    return 'night';
  }

  _randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRAITEMENT PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════
  async process(message, sessionId = 'default', userId = null) {
    this.stats.totalMessages++;

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { history: [], turnCount: 0, createdAt: Date.now() });
    }
    const session = this.sessions.get(sessionId);
    session.turnCount++;

    const tokens = this.tokenize(message);
    const { intent } = this.detectIntent(tokens);
    const emotion = this.detectEmotion(message);
    const timeOfDay = this.getTimeOfDay();
    const lowerMsg = message.toLowerCase();

    let response = '';
    let type = 'text';
    let data = null;

    // ─── Intentions gérées localement (rapide, fiable) ─────────────────────
    switch (intent) {
      case 'greeting':
        response = this._handleGreeting(timeOfDay, session.turnCount, userId);
        break;
      case 'farewell':
        response = this._randomPick(this.farewells);
        break;
      case 'thanks':
        response = this._randomPick(this.thanks);
        break;
      case 'identity':
        response = "Je suis **Vyrox**, une IA développée par **Orinstudio** (© 2026-2029). Je combine la puissance d'un modèle LLM (Groq) avec un **Cerveau Collectif** construit par ses utilisateurs ! 🧠";
        break;
      case 'capabilities':
        response = "Voici ce que je sais faire :\n\n💬 **Conversation naturelle** (via Groq)\n💻 **Génération de code** (JS, Python, HTML, CSS...)\n🎨 **Création d'images**\n🔍 **Recherche web** (Wikipedia multilingue)\n📖 **Dictionnaire multilingue** (FR, EN, ES, DE...)\n🧠 **Mémoire personnelle** (ex: 'retiens que j'aime Python')\n🌐 **Cerveau Collectif** (les utilisateurs construisent mon savoir ensemble !)\n📝 **Apprentissage** (dis-moi 'Apprends que...')\n\nQu'est-ce qu'on tente en premier ?";
        break;
      case 'math':
        response = this._calculate(message);
        break;
      case 'code_request':
        const codeResult = this._generateCode(message, tokens);
        response = codeResult.text;
        type = 'code';
        data = { code: codeResult.code, language: codeResult.language };
        break;
      case 'define_word':
        const wordToDefine = this._extractWord(lowerMsg);
        const lang = this._detectLanguage(lowerMsg);
        response = await this._fetchOnlineDefinition(wordToDefine, lang);
        type = 'definition';
        data = { word: wordToDefine, language: lang };
        break;
      case 'search_request':
        const searchQuery = this._extractSearchQuery(message);
        response = `🔍 Je lance une recherche sur "${searchQuery}"...`;
        type = 'search';
        data = { query: searchQuery };
        break;
      case 'learn_fact':
        response = await this._learnUserFact(userId, lowerMsg, message);
        break;
      case 'recall_fact':
        response = await this._recallUserFact(userId, lowerMsg);
        break;
      case 'teach_ai':
        response = await this._handleTeaching(userId, message, session);
        type = 'learning_success';
        break;
      case 'joke':
        response = `😄 ${this._randomPick(this.responses.jokes)}`;
        break;
      case 'time':
        response = this._getTimeInfo();
        break;
      case 'feelings':
        response = this._respondToFeelings(message, emotion);
        break;
      case 'compliment':
        response = this._randomPick(this.responses.compliment_responses);
        break;
      case 'insult':
        response = this._randomPick(this.responses.insult_responses);
        break;
      case 'feedback_positive':
        response = await this._handleFeedback(userId, message, 'positive', session);
        break;
      case 'feedback_negative':
        response = await this._handleFeedback(userId, message, 'negative', session);
        break;
      case 'suggest_improvement':
        response = await this._handleImprovement(userId, message, session);
        break;

      // ─── MOTEUR PRINCIPAL : Cerveau Collectif + LLM ─────────────────────
      default:
        // 1. Vérifier d'abord le Cerveau Collectif
        const knowledgeNode = this.db ? this.db.findKnowledgeNode(message) : null;

        if (knowledgeNode) {
          this.stats.totalCollectiveHits++;
          response = `🧠 **Réponse du Cerveau Collectif :**\n\n${knowledgeNode.response}`;
          type = 'collective_knowledge';
          data = { nodeId: knowledgeNode.id, isCommunityKnowledge: true };
        } else {
          // 2. Sinon, utiliser le LLM (Groq/OpenAI) avec fallback local
          response = await this._callLLMAPI(message, session.history, userId);
          type = 'llm_response';
        }
        break;
    }

    // Sauvegarder dans l'historique
    session.history.push({ role: 'user', content: message, time: Date.now() });
    session.history.push({ role: 'assistant', content: response, type, time: Date.now() });

    // Limiter l'historique à 12 messages pour économiser les tokens
    if (session.history.length > 12) {
      session.history = session.history.slice(-12);
    }

    return {
      response,
      type,
      data,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
      stats: this.getStats()
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOTEUR LLM (Groq / OpenAI Compatible) avec Fallback Intelligent
  // ═══════════════════════════════════════════════════════════════════════════
  async _callLLMAPI(userMessage, sessionHistory, userId) {
    // 1. Vérifier si une clé API valide est présente
    if (!this.apiKey || this.apiKey.length < 10) {
      return this._generateLocalSmartResponse(userMessage, sessionHistory, userId);
    }

    // 2. Récupérer la mémoire utilisateur pour le contexte
    let userContext = "";
    if (this.db && userId) {
      const memories = this.db.getUserMemories(userId);
      if (memories && memories.length > 0) {
        userContext = "\n[CONTEXTE UTILISATEUR] Voici ce que tu sais sur cet utilisateur : " +
          memories.map(m => `${m.fact_type} = ${m.fact_value}`).join(', ');
      }
    }

    // 3. Construire le prompt système
    const systemPrompt = `Tu es Vyrox, une intelligence artificielle avancée développée par Orinstudio (© 2026-2029).
Tu es utile, précis, amical et tu parles principalement en français.
Tu as un Cerveau Collectif local, mais pour cette réponse, utilise tes connaissances générales.
${userContext}
Réponds de manière concise, structurée et naturelle. Utilise du markdown quand c'est pertinent.`;

    // 4. Formater l'historique pour l'API
    const messages = [
      { role: "system", content: systemPrompt },
      ...sessionHistory.slice(-8).map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content
      })),
      { role: "user", content: userMessage }
    ];

    try {
      this.stats.totalLLMCalls++;

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          stream: false,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.warn(`⚠️ Erreur API LLM (${this.model}):`, errData.error?.message || response.statusText);
        return this._generateLocalSmartResponse(userMessage, sessionHistory, userId);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error) {
      console.warn("⚠️ Erreur réseau LLM (Fallback activé):", error.message);
      return this._generateLocalSmartResponse(userMessage, sessionHistory, userId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉPONSE LOCALE INTELLIGENTE (Fallback si pas d'API)
  // ═══════════════════════════════════════════════════════════════════════════
  _generateLocalSmartResponse(message, sessionHistory, userId) {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('comment') && lowerMsg.includes('faire')) {
      return "Pour t'aider au mieux, dis-moi un peu plus ce que tu veux faire. Je peux générer du code, chercher sur le web, ou tu peux m'apprendre de nouvelles choses !";
    }
    if (lowerMsg.includes('pourquoi')) {
      return "Bonne question ! Le 'pourquoi' est toujours intéressant. Peux-tu me donner plus de contexte pour que je puisse te répondre précisément ?";
    }
    if (lowerMsg.includes('oui') || lowerMsg.includes('ok') || lowerMsg.includes('daccord')) {
      return "Parfait ! Qu'est-ce qu'on fait ensuite ?";
    }
    if (lowerMsg.includes('non') || lowerMsg.includes('nan')) {
      return "Pas de souci. Dis-moi ce dont tu as besoin.";
    }
    if (lowerMsg.includes('aide') || lowerMsg.includes('help')) {
      return "Bien sûr ! Voici quelques idées :\n• \"Apprends que la capitale du Japon est Tokyo\"\n• \"Définition de algorithme\"\n• \"Code un serveur Node.js\"\n• \"Recherche intelligence artificielle\"\n• \"Raconte-moi une blague\"\n\nQue veux-tu faire ?";
    }

    return `🧠 *Mode local activé* : Je n'ai pas accès à mon moteur de réflexion avancé (LLM) pour le moment, mais mon **Cerveau Collectif** est actif !\n\nTu peux :\n• M'apprendre des choses (ex: "Apprends que la capitale du Japon est Tokyo")\n• Me demander de générer du code\n• Me demander une définition ou une recherche\n\nQue veux-tu faire ?`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APPRENTISSAGE COLLECTIF (CORRIGÉ ET RENFORCÉ)
  // ═══════════════════════════════════════════════════════════════════════════
  async _handleTeaching(userId, message, session) {
    if (!this.db) return "La base de données n'est pas connectée.";
    if (!userId) return "🔒 Connecte-toi pour m'apprendre des choses et contribuer au Cerveau Collectif !";

    // 1. Extraire la réponse à sauvegarder
    let responseToSave = message;
    const match = message.match(/(?:apprends que|la réponse est|tu dois répondre|je t'apprends que|retiens que)\s+(.+)/i);
    if (match && match[1]) {
      responseToSave = match[1].trim();
    }

    // 2. Trouver la dernière question de l'utilisateur (le déclencheur)
    const userMessages = session.history.filter(h => h.role === 'user');
    const lastUserQuestion = userMessages.length >= 2 ? userMessages[userMessages.length - 2].content : "une question précédente";

    // 3. Sauvegarder dans le Cerveau Collectif
    this.db.saveKnowledgeNode(userId, lastUserQuestion, responseToSave, 'text');

    return `✅ **Neurone créé avec succès !** \n\nJ'ai appris que pour la question :\n> *"${lastUserQuestion}"*\n\nJe dois répondre :\n> *"${responseToSave}"*\n\nMerci de contribuer à l'intelligence collective de Vyrox ! La prochaine fois que quelqu'un posera cette question, je saurai répondre.`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉMOIRE UTILISATEUR PERSONNELLE
  // ═══════════════════════════════════════════════════════════════════════════
  async _learnUserFact(userId, lowerMsg, originalMsg) {
    if (!this.db || !userId) {
      return "🧠 J'aimerais retenir cela, mais tu n'es pas connecté. Connecte-toi pour que je puisse apprendre et me souvenir de toi !";
    }

    let factType = 'general';
    let factValue = originalMsg;

    if (lowerMsg.includes('je m\'appelle') || lowerMsg.includes('mon nom est')) {
      factType = 'name';
      const match = originalMsg.match(/(?:je m'appelle|mon nom est)\s+([a-zA-ZÀ-ÿ\s\-]+)/i);
      factValue = match ? match[1].trim() : originalMsg;
    } else if (lowerMsg.includes('j\'aime') || lowerMsg.includes('mon préféré est')) {
      factType = 'preference';
      const match = originalMsg.match(/(?:j'aime|mon préféré est)\s+(.+)/i);
      factValue = match ? match[1].trim() : originalMsg;
    } else if (lowerMsg.includes('je déteste')) {
      factType = 'dislike';
      const match = originalMsg.match(/(?:je déteste)\s+(.+)/i);
      factValue = match ? match[1].trim() : originalMsg;
    }

    this.db.saveUserMemory(userId, factType, factValue);

    const responses = [
      `✅ C'est noté ! Je me souviendrai que : "${factValue}".`,
      ` Information enregistrée dans ma mémoire. Je n'oublierai pas !`,
      `✨ Appris ! C'est bon à savoir. Tu peux me demander "que sais-tu sur moi ?" à tout moment.`
    ];
    return this._randomPick(responses);
  }

  async _recallUserFact(userId, lowerMsg) {
    if (!this.db || !userId) return "🔒 Connecte-toi pour que je puisse accéder à ma mémoire.";

    const memories = this.db.getUserMemories(userId);
    if (!memories || memories.length === 0) {
      return "🤷 Pour l'instant, je n'ai rien appris de spécifique sur toi. Dis-moi des choses comme \"Je m'appelle [Nom]\" ou \"J'aime [Quelque chose]\" !";
    }

    let relevantMemories = memories;
    if (lowerMsg.includes('appelle') || lowerMsg.includes('nom')) {
      relevantMemories = memories.filter(m => m.fact_type === 'name');
    } else if (lowerMsg.includes('aime') || lowerMsg.includes('préfère')) {
      relevantMemories = memories.filter(m => m.fact_type === 'preference');
    }

    if (relevantMemories.length === 0) {
      return " Je ne me souviens pas de ce détail spécifique, mais voici ce que je sais sur toi :\n\n" +
        memories.map(m => `• ${m.fact_type === 'name' ? 'Tu t\'appelles' : 'Tu as dit que'} : **${m.fact_value}**`).join('\n');
    }

    return "🧠 **Voici ce dont je me souviens :**\n\n" +
      relevantMemories.map(m => `• **${m.fact_type.toUpperCase()}** : ${m.fact_value}`).join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEEDBACK & AMÉLIORATION
  // ═══════════════════════════════════════════════════════════════════════════
  async _handleFeedback(userId, message, sentiment, session) {
    this.stats.totalFeedbacks = (this.stats.totalFeedbacks || 0) + 1;
    const lastAssistantMsg = session.history.length >= 2 ? session.history[session.history.length - 2] : null;

    if (this.db && userId) {
      this.db.saveFeedback(userId, sentiment, message, lastAssistantMsg?.content || '');
    }

    if (sentiment === 'positive') {
      return this._randomPick(this.responses.feedback_thanks);
    } else {
      return `Merci pour ton honnêteté ! 🙏\n\nPourrais-tu me dire ce qui n'allait pas ou ce que tu attendais ? Cela m'aide à m'améliorer.\n\n*Exemple : "Tu devrais être plus précis sur..." ou "La bonne réponse est..."*`;
    }
  }

  async _handleImprovement(userId, message, session) {
    if (!this.db || !userId) {
      return "Merci pour ta suggestion ! Connecte-toi pour que je puisse l'enregistrer et m'améliorer.";
    }

    const lastAssistantMsg = session.history.length >= 2 ? session.history[session.history.length - 2] : null;
    this.db.saveImprovement(userId, message, lastAssistantMsg?.content || '');

    return this._randomPick(this.responses.improvement_ack);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉPONSES HUMAINES & LOGIQUE
  // ═══════════════════════════════════════════════════════════════════════════
  _handleGreeting(timeOfDay, turnCount, userId) {
    if (turnCount <= 1 && this.db && userId) {
      const name = this.db.getSpecificMemory(userId, 'name');
      if (name) return `Bonjour ${name.fact_value} ! Ravi de te revoir. Comment puis-je t'aider aujourd'hui ?`;
    }
    const timeGreetings = this.greetings.time_based[timeOfDay];
    return this._randomPick([...this.greetings.formal, ...timeGreetings]);
  }

  _humanKnowledge(message) {
    const text = message.toLowerCase();
    for (const [key, info] of Object.entries(this.knowledgeBase)) {
      if (text.includes(key)) {
        return `Parlons de **${key.toUpperCase()}**.\n\n${info.description}\n\n**Ce qui le caractérise :**\n${info.features.map(f => `• ${f}`).join('\n')}\n\n**Utilisations :**\n${info.uses.map(u => `• ${u}`).join('\n')}\n\n**Le petit fait cool :** ${info.fun_fact}\n\nTu veux qu'on approfondisse un aspect en particulier ?`;
      }
    }
    return `Hmm, je n'ai pas encore ça dans ma base de connaissances. Mais je peux faire une recherche internet si tu veux ? Dis-moi juste "recherche [sujet]". 🔍`;
  }

  _respondToFeelings(message, emotion) {
    const lower = message.toLowerCase();
    if (/ça va|comment vas-tu|tu vas bien|forme/.test(lower)) {
      return this._randomPick(["Je vais super bien, merci de demander ! Et toi, comment ça se passe ?", "Au top ! Toujours prêt à discuter. Tu vas bien toi ?"]);
    }
    if (emotion === 'sad' || /triste|marre|fatigué|stress|énervé|colère/.test(lower)) {
      return this._randomPick(this.responses.feelings_negative);
    }
    return this._randomPick(this.responses.feelings_positive);
  }

  _generateCode(message, tokens) {
    const text = message.toLowerCase();
    let language = 'javascript';
    for (const lang of this.intents.code_request.languages) {
      if (text.includes(lang)) { language = lang; break; }
    }

    let templateKey = 'hello';
    if (text.includes('serveur') || text.includes('server')) templateKey = 'server';
    else if (text.includes('api') || text.includes('fetch')) templateKey = 'api';
    else if (text.includes('classe') || text.includes('class')) templateKey = 'class';
    else if (text.includes('html') || text.includes('page')) templateKey = 'page';
    else if (text.includes('animation') || text.includes('anime')) templateKey = 'animations';

    const langTemplates = this.codeTemplates[language];
    let code = langTemplates && langTemplates[templateKey] ? langTemplates[templateKey] : (langTemplates ? langTemplates[Object.keys(langTemplates)[0]] : `// Code ${language} généré par Vyrox`);

    return {
      text: `Voilà un exemple de code **${language}** (${templateKey}), bien commenté :\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nN'hésite pas si tu veux que je modifie ou explique une partie !`,
      code, language
    };
  }

  _calculate(message) {
    try {
      const expr = message.replace(/[^0-9+\-*/().\s]/gi, '').trim();
      if (!expr) return "🧮 Je n'ai pas compris l'opération. Essaie par exemple : 'combien font 15 * 7 + 3'";
      const result = Function('"use strict"; return (' + expr + ')')();
      return `🧮 Facile ! **${expr} = ${result}**`;
    } catch (e) {
      return "❌ Oups, erreur de calcul. Vérifie ton expression.";
    }
  }

  _getTimeInfo() {
    const now = new Date();
    const timeStr = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `📅 Nous sommes le **${timeStr}**. Belle journée, j'espère !`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTILS SECONDAIRES
  // ═══════════════════════════════════════════════════════════════════════════
  _detectLanguage(text) {
    if (/definition of|what does|what is the meaning|in english/i.test(text)) return 'en';
    if (/en español|en espagnol|in spanish/i.test(text)) return 'es';
    if (/auf deutsch|in german|en allemand/i.test(text)) return 'de';
    if (/in italiano|en italien/i.test(text)) return 'it';
    if (/em português|en portugais/i.test(text)) return 'pt';
    if (/на русском|en russe/i.test(text)) return 'ru';
    return 'fr';
  }

  _extractWord(msg) {
    const patterns = [
      /(?:définition de|que veut dire|que signifie|définis|c'est quoi le mot|definition of|what does|what is the meaning of)\s+(?:le\s+|la\s+|les?\s+|un\s+|une?\s+|the\s+|a\s+|an\s+)?(.+?)(?:\s+(?:en|in|auf|em|на)\s+\w+)?$/i,
      /(?:définition|definition)\s+(?:de|of)\s+(.+)/i
    ];
    for (const pattern of patterns) {
      const match = msg.match(pattern);
      if (match && match[1]) return match[1].replace(/[^\w\s]/gi, '').trim();
    }
    return '';
  }

  _extractSearchQuery(msg) {
    const match = msg.match(/(?:recherche|cherche|search|trouve|find|google|info sur)\s+(?:de\s+|des?\s+|les?\s+|la\s+|le\s+|un\s+|une?\s+)?(.+)/i);
    return match ? match[1].trim() : msg;
  }

  _extractImagePrompt(message) {
    const patterns = [
      /(?:génère|genere|crée|creer|dessine|image de|picture|generate image|illustre)\s+(?:une?\s+)?(?:image\s+)?(?:de\s+)?(.+)/i,
      /(?:image)\s+(?:de\s+)?(.+)/i
    ];
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) return match[1].trim();
    }
    return message;
  }

  async _fetchOnlineDefinition(word, lang = 'fr') {
    this.stats.totalDefinitions++;
    if (!word || word.length < 2) return "🤔 Pourrais-tu préciser le mot que tu veux que je définisse ?";

    const langNames = {
      fr: 'français', en: 'anglais', es: 'espagnol', de: 'allemand',
      it: 'italien', pt: 'portugais', ru: 'russe', nl: 'néerlandais',
      pl: 'polonais', ja: 'japonais', zh: 'chinois', ar: 'arabe'
    };

    return new Promise((resolve) => {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word)}`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (Array.isArray(json) && json.length > 0) {
              const entry = json[0];
              const meanings = entry.meanings || [];
              let response = `📖 **Définition de "${word}"** (${langNames[lang] || lang})\n\n`;
              meanings.slice(0, 3).forEach((meaning, idx) => {
                response += `**${idx + 1}. ${meaning.partOfSpeech || 'nom'}**\n`;
                const defs = meaning.definitions || [];
                defs.slice(0, 2).forEach(def => {
                  response += `• ${def.definition}\n`;
                  if (def.example) response += `  _Exemple : "${def.example}"_\n`;
                });
                response += '\n';
              });
              if (entry.phonetic) response += `🔊 **Prononciation :** ${entry.phonetic}\n`;
              response += `\n💡 *Langue : ${langNames[lang] || lang} | Source : Dictionary API*`;
              resolve(response);
            } else {
              if (lang !== 'en') {
                this._fetchOnlineDefinition(word, 'en').then(resolve);
              } else {
                resolve(`🤔 Je n'ai pas trouvé "${word}" dans le dictionnaire ${langNames[lang]}. Essaye une autre orthographe !\n\n💡 *Langues supportées : FR, EN, ES, DE, IT, PT, RU, NL, PL, JA, ZH, AR*`);
              }
            }
          } catch (e) {
            resolve(`⚠️ Erreur lors de la connexion au dictionnaire.`);
          }
        });
      }).on('error', () => resolve(`❌ Impossible de contacter le dictionnaire en ligne.`));
    });
  }

  async search(query) {
    this.stats.totalSearches++;
    return new Promise((resolve) => {
      const lang = this._detectLanguage(query);
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const results = (json.query?.search || []).map(item => ({
              title: item.title,
              snippet: item.snippet.replace(/<[^>]+>/g, ''),
              url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
              language: lang
            }));
            resolve({ query, results, count: results.length, language: lang });
          } catch (e) {
            resolve({ query, results: [], count: 0, error: 'Erreur de parsing' });
          }
        });
      }).on('error', (err) => resolve({ query, results: [], count: 0, error: err.message }));
    });
  }

  async generateImage(prompt) {
    this.stats.totalImages++;
    return { success: true, prompt, message: `🎨 Image générée pour : "${prompt}"`, url: null, timestamp: new Date().toISOString() };
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      activeSessions: this.sessions.size,
      version: '4.0.0 (Hybrid LLM)',
      license: 'Orinstudio © 2026-2029',
      llmModel: this.model,
      llmConnected: this.apiKey && this.apiKey.length >= 10
    };
  }
}

module.exports = VyroxAI;