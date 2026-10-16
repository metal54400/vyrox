/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VYROX LOCAL AI — Moteur local (sans LLM)
 * Intentions, réponses statiques, code, calcul, dictionnaire, Wikipédia,
 * Génération d'Images/Vidéos réelles avec Filigrane Dynamique.
 * Licence © 2026-2029 Orinstudio
 * ═══════════════════════════════════════════════════════════════════════════
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { generateImageBuffer } = require('./image-service');

// npm install sharp
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn("⚠️ Module 'sharp' non trouvé. Le filigrane sera désactivé.");
}

class VyroxLocalAI {
  constructor(databaseInstance = null, stats = {}) {
    this.db = databaseInstance;
    this.stats = stats;

    // Dossier pour stocker les générations locales
    this.outputDir = path.join(__dirname, 'public', 'uploads', 'generations');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    this.staticData = {
      greetings: this._initGreetings(),
      farewells: ["Au revoir ! N'hésite pas à revenir.", "À bientôt ! Prends soin de toi.", "Ciao ! Bonne continuation."],
      thanks: ["Avec plaisir !", "De rien ! Je suis là pour ça.", "Content d'avoir pu aider !"],
      intents: this._initIntents(),
      codeTemplates: this._initCodeTemplates(),
      knowledgeBase: this._initKnowledgeBase(),
      responses: this._initResponses()
    };
  }

  _initGreetings() {
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

  _initKnowledgeBase() {
    return {
      javascript: { description: "JavaScript est un langage de programmation dynamique et multi-paradigme.", features: ["Dynamiquement typé", "Multi-paradigme", "Exécution côté client ET serveur"], uses: ["Sites web", "Node.js", "React Native"], fun_fact: "Créé en 10 jours par Brendan Eich en 1995 !" },
      python: { description: "Python est un langage interprété de haut niveau, célèbre pour sa syntaxe claire.", features: ["Syntaxe lisible", "Typage dynamique", "Multi-paradigme"], uses: ["IA", "Data science", "Web"], fun_fact: "Nommé d'après Monty Python, pas le serpent !" },
      html: { description: "HTML est le squelette de toutes les pages web.", features: ["Structure sémantique", "DOM hiérarchique", "Compatible tous navigateurs"], uses: ["Pages web", "Applications", "Emails"], fun_fact: "La première page web (1991) est toujours en ligne au CERN !" },
      css: { description: "CSS transforme un HTML brut en belle interface visuelle.", features: ["Sélecteurs puissants", "Flexbox et Grid", "Animations"], uses: ["Design", "Animations", "Responsive"], fun_fact: "Proposé par Håkon Wium Lie en 1994." },
      ai: { description: "L'IA vise à créer des machines capables de simuler l'intelligence humaine.", features: ["Machine Learning", "Deep Learning", "NLP"], uses: ["Assistants vocaux", "Recommandations", "Véhicules autonomes"], fun_fact: "Terme inventé en 1956 à la conférence de Dartmouth." },
      orinstudio: { description: "Orinstudio est un studio de développement créatif.", features: ["Développement sur mesure", "IA made in house", "Design futuriste"], uses: ["Projets web", "Apps IA", "Branding"], fun_fact: "Vyrox est 100% fait maison sans LLM externe par défaut !" }
    };
  }

  _initIntents() {
    return {
      greeting: { patterns: ['bonjour', 'salut', 'hello', 'hi', 'hey', 'coucou', 'bonsoir', 'slt', 'bjr', 'cc'], weight: 1 },
      farewell: { patterns: ['au revoir', 'bye', 'ciao', 'à plus', 'bonne nuit', 'bonne journée'], weight: 1 },
      thanks: { patterns: ['merci', 'thanks', 'super', 'génial', 'parfait', 'cool', 'top'], weight: 1 },
      identity: { patterns: ['qui es-tu', 'qui es tu', 'ton nom', 'tu es qui', 'présente-toi', 'c\'est quoi vyrox'], weight: 2 },
      capabilities: { patterns: ['que sais-tu faire', 'tes capacités', 'que peux-tu', 'help', 'aide', 'commandes'], weight: 2 },
      code_request: { patterns: ['génère', 'genere', 'code', 'écris', 'ecris', 'script', 'programme', 'crée un', 'creer un'], languages: ['javascript', 'python', 'html', 'css', 'java', 'c++', 'php', 'ruby', 'go', 'rust', 'typescript', 'sql'], weight: 3 },
      image_request: { patterns: ['génère une image', 'genere une image', 'crée une image', 'dessine', 'image de', 'picture', 'photo de'], weight: 3 },
      video_request: { patterns: ['génère une vidéo', 'genere une video', 'anime', 'vidéo de'], weight: 3 },
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

  _initCodeTemplates() {
    return {
      javascript: {
        hello: `// 🚀 Hello World en JavaScript\nconsole.log("Hello, World!");\n\nfunction saluer(nom) {\n  return \`Bonjour \${nom} !\`;\n}\nconsole.log(saluer("Développeur"));`,
        server: `// 🖥️ Serveur HTTP Node.js natif\nconst http = require('http');\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'text/html' });\n  res.end('<h1>Mon Serveur Node.js</h1>');\n});\nserver.listen(3000, () => console.log('Serveur actif sur http://localhost:3000'));`,
        api: `// 🌐 Client API moderne avec fetch\nasync function fetchData(url) {\n  try {\n    const response = await fetch(url);\n    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);\n    return await response.json();\n  } catch (error) {\n    console.error('❌ Erreur:', error.message);\n  }\n}\nfetchData('https://api.example.com/data').then(console.log);`
      },
      python: {
        hello: `# Hello World en Python\nprint("Hello, World!")\n\ndef saluer(nom):\n    return f"Bonjour {nom} !"\n\nprint(saluer("Développeur"))`,
        class: `# Classe Python avec héritage\nclass Animal:\n    def __init__(self, nom, son):\n        self.nom = nom\n        self.son = son\n    def parler(self):\n        return f"{self.nom} fait {self.son}"\n\nclass Chien(Animal):\n    def __init__(self, nom):\n        super().__init__(nom, "Wouf!")\n\nchien = Chien("Rex")\nprint(chien.parler())`
      },
      html: {
        page: `<!DOCTYPE html>\n<html lang="fr">\n<head>\n    <meta charset="UTF-8">\n    <title>Ma Page Moderne</title>\n    <style>\n        body { font-family: sans-serif; background: linear-gradient(135deg, #667eea, #764ba2); color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }\n        .container { text-align: center; padding: 2rem; background: rgba(255,255,255,0.1); border-radius: 20px; backdrop-filter: blur(10px); }\n    </style>\n</head>\n<body>\n    <div class="container">\n        <h1>✨ Bienvenue</h1>\n        <p>Ma première page HTML moderne</p>\n    </div>\n</body>\n</html>`
      },
      css: {
        animations: `/* 🎨 Animations CSS modernes */\n@keyframes float {\n    0%, 100% { transform: translateY(0px); }\n    50% { transform: translateY(-20px); }\n}\n.card {\n    background: linear-gradient(135deg, #1a1a2e, #16213e);\n    border-radius: 16px;\n    padding: 2rem;\n    animation: float 3s ease-in-out infinite;\n    transition: all 0.3s ease;\n}\n.card:hover {\n    transform: scale(1.05);\n}`
      }
    };
  }

  _initResponses() {
    return {
      jokes: [
        "Pourquoi les programmeurs préfèrent-ils le mode sombre ? Parce que la lumière attire les bugs ! 🐛",
        "Un développeur va au supermarché. Sa femme lui dit : 'Achète une bouteille de lait, et s'ils ont des œufs, prends-en 6.' Il revient avec 6 bouteilles de lait. 'Ils avaient des œufs.' 🥛",
        "Combien de développeurs faut-il pour changer une ampoule ? Aucun, c'est un problème hardware ! 💡",
        "Il y a 10 types de personnes dans le monde : celles qui comprennent le binaire et les autres. 🤓"
      ],
      feelings_positive: ["Super content que tu ailles bien ! Moi aussi, je suis en pleine forme. 😊", "Tant mieux ! Qu'est-ce qu'on fait de beau aujourd'hui ?"],
      feelings_negative: ["Oh mince, désolé d'entendre ça. Tu veux en parler ou préfères qu'on change de sujet ?", "Je comprends, ça arrive à tout le monde. Prends ton temps, je suis là."],
      compliment_responses: ["Oh, merci ! Ça fait plaisir. ", "Haha, tu es trop gentil !", "Merci ! C'est motivant."],
      insult_responses: ["Ouch... J'essaie de faire de mon mieux.", "Hmm, pas cool. Je suis encore en apprentissage.", "Je comprends ta frustration. Dis-moi ce qui ne va pas."],
      feedback_thanks: ["Merci pour ton retour ! Ça m'aide à m'améliorer. ", "Super, je note ton feedback ! ", "Noté ! Chaque retour me rend meilleur. "],
      improvement_ack: ["Merci pour la suggestion ! Je vais en tenir compte. ", "Bonne remarque ! J'apprends de mes erreurs. "],
      learning_prompts: [
        "🧠 Hmm, je n'ai pas encore ce **neurone de connaissance** dans mon cerveau.\n\nPuisque je suis une IA qui apprend grâce à ses utilisateurs, **peux-tu m'apprendre la réponse ?**\n\n*(Écris simplement la réponse que je devrais donner à l'avenir, et je la sauvegarderai pour tout le monde !)*",
        "Cette question n'existe pas encore dans ma base collective. Peux-tu être mon professeur aujourd'hui ? Donne-moi la meilleure réponse possible et je l'ajouterai à mon savoir communautaire !",
        "Je ne connais pas encore la réponse à cela, mais TOI peut-être ! Écris-la moi, et je la retiendrai pour aider les prochains utilisateurs. "
      ]
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITAIRES & NLP
  // ═══════════════════════════════════════════════════════════════════════════

  tokenize(text) {
    return text.toLowerCase().replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/gi, '').split(/\s+/).filter(t => t.length > 0);
  }

  _randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 23) return 'evening';
    return 'night';
  }

  detectEmotion(text) {
    const lower = text.toLowerCase();
    if (/merci|super|génial|parfait|excellent|cool|top/.test(lower)) return 'positive';
    if (/nul|stupide|merde|idiot|débile/.test(lower)) return 'negative';
    if (/triste|marre|fatigué|stress|énervé/.test(lower)) return 'sad';
    if (/blague|rire|drôle|humour/.test(lower)) return 'fun';
    return 'neutral';
  }

  /** Normalise : minuscules, sans apostrophes (droites et typographiques), sans ponctuation. */
  _normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[\u2018\u2019'`´]/g, '')
      .replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  detectIntent(tokens) {
    const originalText = tokens.join(' ');
    const normalizedText = this._normalizeText(originalText);

    const questionMarkers = ['quoi', 'comment', 'pourquoi', 'qui', 'où', 'ou', 'quand', 'quel', 'quelle', 'quels', 'quelles', 'combien', 'definition', 'définition', 'c est quoi', 'quest ce que', 'qu est ce que'];
    const isQuestion = questionMarkers.some(marker => normalizedText.includes(marker));

    const scores = {};
    for (const [intent, config] of Object.entries(this.staticData.intents)) {
      scores[intent] = 0;
      for (const pattern of config.patterns || []) {
        const normalizedPattern = this._normalizeText(pattern);
        if (normalizedText.includes(normalizedPattern)) {
          scores[intent] += normalizedPattern.split(' ').length * (config.weight || 1);
        }
      }
    }

    let bestIntent = null;
    let bestScore = 0;
    for (const [intent, score] of Object.entries(scores)) {
      if (score > bestScore) { bestScore = score; bestIntent = intent; }
    }

    // Question factuelle + intention faible → on laisse le LLM répondre
    if (isQuestion && bestScore <= 2) {
      console.log(`🔍 Question factuelle détectée : "${originalText}" → Passage au LLM`);
      return { intent: null, score: 0 };
    }
    return { intent: bestIntent, score: bestScore };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTAGE DES INTENTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * IMPORTANT : `response` est TOUJOURS une chaîne. Les données structurées
   * (URL d'image, etc.) vont dans `data`.
   */
  async handle(intent, message, tokens, session, userId) {
    const lowerMsg = message.toLowerCase();
    const R = this.staticData.responses;
    const out = (response, type = 'text', data = null) => ({
      response: typeof response === 'string' ? response : JSON.stringify(response ?? ''),
      type,
      data
    });

    switch (intent) {
      case 'greeting':
        return out(this._handleGreeting(this.getTimeOfDay(), session.turnCount, userId));
      case 'farewell':
        return out(this._randomPick(this.staticData.farewells));
      case 'thanks':
        return out(this._randomPick(this.staticData.thanks));
      case 'identity':
        return out("Je suis **Vyrox**, une IA développée par **Orinstudio** (© 2026-2029). Mon moteur principal est **GPT-OSS-20B** via Groq, avec rotation automatique vers d'autres modèles si besoin ! 🧠");
      case 'capabilities':
        return out("Voici ce que je sais faire :\n\n💬 **Conversation naturelle** (GPT-OSS-20B + rotation auto)\n💻 **Génération de code** (JS, Python, HTML, CSS...)\n🎨 **Création d'images & Vidéos** (avec filigrane Vyrox)\n🔍 **Recherche web autonome** (je cherche moi-même sur Wikipédia)\n📖 **Dictionnaire multilingue** (FR, EN, ES, DE...)\n🧠 **Mémoire personnelle** (ex: 'retiens que j'aime Python')\n🌐 **Cerveau Collectif** (les utilisateurs construisent mon savoir ensemble !)\n📝 **Apprentissage** (dis-moi 'Apprends que...')\n\nQu'est-ce qu'on tente en premier ?");
      case 'math':
        return out(this._calculate(message));
      case 'code_request': {
        const c = this._generateCode(message, tokens);
        return out(c.text, 'code', { code: c.code, language: c.language });
      }
      case 'define_word': {
        const word = this._extractWord(lowerMsg);
        const lang = this._detectLanguage(lowerMsg);
        return out(await this._fetchOnlineDefinition(word, lang), 'definition', { word, language: lang });
      }
      case 'search_request': {
        const query = this._extractSearchQuery(message);
        return out(`🔍 Je lance une recherche sur "${query}"...`, 'search', { query });
      }
      case 'learn_fact':
        return out(await this._learnUserFact(userId, lowerMsg, message));
      case 'recall_fact':
        return out(await this._recallUserFact(userId, lowerMsg));
      case 'teach_ai':
        return out(await this._handleTeaching(userId, message, session), 'learning_success');
      case 'joke':
        return out(`😄 ${this._randomPick(R.jokes)}`);
      case 'time':
        return out(this._getTimeInfo());
      case 'feelings':
        return out(this._respondToFeelings(message, this.detectEmotion(message)));
      case 'compliment':
        return out(this._randomPick(R.compliment_responses));
      case 'insult':
        return out(this._randomPick(R.insult_responses));
      case 'feedback_positive':
        return out(await this._handleFeedback(userId, message, 'positive', session));
      case 'feedback_negative':
        return out(await this._handleFeedback(userId, message, 'negative', session));
      case 'suggest_improvement':
        return out(await this._handleImprovement(userId, message, session));

      // ✅ CORRIGÉ : texte dans `response`, URL dans `data`
      case 'image_request': {
        const prompt = this._extractImagePrompt(message);
        const img = await this.generateImage(prompt);
        return out(img.message, 'image_generation', { prompt, url: img.url, success: img.success });
      }
      case 'video_request': {
        const prompt = this._extractImagePrompt(message);
        const vid = await this.generateVideo(prompt);
        return out(vid.message, 'video_generation', { prompt, url: vid.url, success: vid.success });
      }

      default:
        return null;
    }
  }

  /** Cherche une réponse dans le Cerveau Collectif (base de données). */
  findCollective(message) {
    const node = this.db ? this.db.findKnowledgeNode(message) : null;
    if (!node) return null;
    this.stats.totalCollectiveHits = (this.stats.totalCollectiveHits || 0) + 1;
    return {
      response: `🧠 **Réponse du Cerveau Collectif :**\n\n${node.response}`,
      type: 'collective_knowledge',
      data: { nodeId: node.id, isCommunityKnowledge: true }
    };
  }

  /** Réponse de secours quand aucun LLM n'est disponible. */
  fallback(message) {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('comment') && lowerMsg.includes('faire')) {
      return "Pour t'aider au mieux, dis-moi un peu plus ce que tu veux faire. Je peux générer du code, chercher sur le web, ou tu peux m'apprendre de nouvelles choses !";
    }
    if (lowerMsg.includes('pourquoi')) {
      return "Bonne question ! Le 'pourquoi' est toujours intéressant. Peux-tu me donner plus de contexte pour que je puisse te répondre précisément ?";
    }
    if (lowerMsg.includes('oui') || lowerMsg.includes('ok') || lowerMsg.includes('daccord')) return "Parfait ! Qu'est-ce qu'on fait ensuite ?";
    if (lowerMsg.includes('non') || lowerMsg.includes('nan')) return "Pas de souci. Dis-moi ce dont tu as besoin.";
    if (lowerMsg.includes('aide') || lowerMsg.includes('help')) {
      return "Bien sûr ! Voici quelques idées :\n• \"Apprends que la capitale du Japon est Tokyo\"\n• \"Définition de algorithme\"\n• \"Code un serveur Node.js\"\n• \"Recherche intelligence artificielle\"\n• \"Raconte-moi une blague\"\n\nQue veux-tu faire ?";
    }
    return `🧠 *Mode local activé* : Tous les modèles LLM sont temporairement indisponibles, mais mon **Cerveau Collectif** est actif !\n\nTu peux :\n• M'apprendre des choses (ex: "Apprends que la capitale du Japon est Tokyo")\n• Me demander de générer du code\n• Me demander une définition ou une recherche\n\nQue veux-tu faire ?`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIQUE MÉTIER
  // ═══════════════════════════════════════════════════════════════════════════

  async _handleTeaching(userId, message, session) {
    if (!this.db) return "La base de données n'est pas connectée.";
    if (!userId) return "🔒 Connecte-toi pour m'apprendre des choses et contribuer au Cerveau Collectif !";

    let responseToSave = message;
    const match = message.match(/(?:apprends que|la réponse est|tu dois répondre|je t'apprends que|retiens que)\s+(.+)/i);
    if (match && match[1]) responseToSave = match[1].trim();

    const userMessages = session.history.filter(h => h.role === 'user');
    const lastUserQuestion = userMessages.length >= 2 ? userMessages[userMessages.length - 2].content : "une question précédente";

    this.db.saveKnowledgeNode(userId, lastUserQuestion, responseToSave, 'text');

    return `✅ **Neurone créé avec succès !**\n\nJ'ai appris que pour la question :\n> *"${lastUserQuestion}"*\n\nJe dois répondre :\n> *"${responseToSave}"*\n\nMerci de contribuer à l'intelligence collective de Vyrox ! La prochaine fois que quelqu'un posera cette question, je saurai répondre.`;
  }

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

    return this._randomPick([
      `✅ C'est noté ! Je me souviendrai que : "${factValue}".`,
      `ℹ️ Information enregistrée dans ma mémoire. Je n'oublierai pas !`,
      `✨ Appris ! C'est bon à savoir. Tu peux me demander "que sais-tu sur moi ?" à tout moment.`
    ]);
  }

  async _recallUserFact(userId, lowerMsg) {
    if (!this.db || !userId) return "🔒 Connecte-toi pour que je puisse accéder à ma mémoire.";

    const memories = this.db.getUserMemories(userId);
    if (!memories || memories.length === 0) {
      return "🤷 Pour l'instant, je n'ai rien appris de spécifique sur toi. Dis-moi des choses comme \"Je m'appelle [Nom]\" ou \"J'aime [Quelque chose]\" !";
    }

    let relevant = memories;
    if (lowerMsg.includes('appelle') || lowerMsg.includes('nom')) relevant = memories.filter(m => m.fact_type === 'name');
    else if (lowerMsg.includes('aime') || lowerMsg.includes('préfère')) relevant = memories.filter(m => m.fact_type === 'preference');

    if (relevant.length === 0) {
      return "ℹ️ Je ne me souviens pas de ce détail spécifique, mais voici ce que je sais sur toi :\n\n" +
        memories.map(m => `• ${m.fact_type === 'name' ? 'Tu t\'appelles' : 'Tu as dit que'} : **${m.fact_value}**`).join('\n');
    }
    return "🧠 **Voici ce dont je me souviens :**\n\n" + relevant.map(m => `• **${m.fact_type.toUpperCase()}** : ${m.fact_value}`).join('\n');
  }

  async _handleFeedback(userId, message, sentiment, session) {
    this.stats.totalFeedbacks = (this.stats.totalFeedbacks || 0) + 1;
    const lastAssistantMsg = session.history.length >= 2 ? session.history[session.history.length - 2] : null;

    if (this.db && userId) this.db.saveFeedback(userId, sentiment, message, lastAssistantMsg?.content || '');

    if (sentiment === 'positive') return this._randomPick(this.staticData.responses.feedback_thanks);
    return `Merci pour ton honnêteté ! 🙏\n\nPourrais-tu me dire ce qui n'allait pas ou ce que tu attendais ? Cela m'aide à m'améliorer.\n\n*Exemple : "Tu devrais être plus précis sur..." ou "La bonne réponse est..."*`;
  }

  async _handleImprovement(userId, message, session) {
    if (!this.db || !userId) return "Merci pour ta suggestion ! Connecte-toi pour que je puisse l'enregistrer et m'améliorer.";
    const lastAssistantMsg = session.history.length >= 2 ? session.history[session.history.length - 2] : null;
    this.db.saveImprovement(userId, message, lastAssistantMsg?.content || '');
    return this._randomPick(this.staticData.responses.improvement_ack);
  }

  _handleGreeting(timeOfDay, turnCount, userId) {
    if (turnCount <= 1 && this.db && userId) {
      const name = this.db.getSpecificMemory(userId, 'name');
      if (name) return `Bonjour ${name.fact_value} ! Ravi de te revoir. Comment puis-je t'aider aujourd'hui ?`;
    }
    const g = this.staticData.greetings;
    return this._randomPick([...g.formal, ...g.time_based[timeOfDay]]);
  }

  _respondToFeelings(message, emotion) {
    const lower = message.toLowerCase();
    if (/ça va|comment vas-tu|tu vas bien|forme/.test(lower)) {
      return this._randomPick(["Je vais super bien, merci de demander ! Et toi, comment ça se passe ?", "Au top ! Toujours prêt à discuter. Tu vas bien toi ?"]);
    }
    if (emotion === 'sad' || /triste|marre|fatigué|stress|énervé|colère/.test(lower)) {
      return this._randomPick(this.staticData.responses.feelings_negative);
    }
    return this._randomPick(this.staticData.responses.feelings_positive);
  }

  _generateCode(message, tokens) {
    const text = message.toLowerCase();
    let language = 'javascript';
    for (const lang of this.staticData.intents.code_request.languages) {
      if (text.includes(lang)) { language = lang; break; }
    }

    let templateKey = 'hello';
    if (text.includes('serveur') || text.includes('server')) templateKey = 'server';
    else if (text.includes('api') || text.includes('fetch')) templateKey = 'api';
    else if (text.includes('classe') || text.includes('class')) templateKey = 'class';
    else if (text.includes('html') || text.includes('page')) templateKey = 'page';
    else if (text.includes('animation') || text.includes('anime')) templateKey = 'animations';

    const langTemplates = this.staticData.codeTemplates[language];
    const code = langTemplates && langTemplates[templateKey]
      ? langTemplates[templateKey]
      : (langTemplates ? langTemplates[Object.keys(langTemplates)[0]] : `// Code ${language} généré par Vyrox`);

    return {
      text: `Voilà un exemple de code **${language}** (${templateKey}), bien commenté :\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nN'hésite pas si tu veux que je modifie ou explique une partie !`,
      code, language
    };
  }

  /** Calcul sécurisé : parseur arithmétique maison (pas de Function()/eval). */
  _calculate(message) {
    try {
      const expr = message
        .toLowerCase()
        .replace(/×/g, '*').replace(/÷/g, '/')
        .replace(/,/g, '.')
        .replace(/[^0-9+\-*/().\s]/g, '')
        .trim();
      if (!expr) return "🧮 Je n'ai pas compris l'opération. Essaie par exemple : 'combien font 15 * 7 + 3'";
      const result = this._evalArithmetic(expr);
      if (!Number.isFinite(result)) return "🧮 Résultat indéfini (division par zéro ?).";
      return `🧮 Facile ! **${expr} = ${result}**`;
    } catch (e) {
      return "Oups, erreur de calcul. Vérifie ton expression.";
    }
  }

  /** Parseur récursif : + - * / parenthèses, moins unaire. */
  _evalArithmetic(input) {
    const s = input.replace(/\s+/g, '');
    let i = 0;
    const peek = () => s[i];
    const parseExpr = () => {
      let v = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = s[i++];
        const r = parseTerm();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    };
    const parseTerm = () => {
      let v = parseFactor();
      while (peek() === '*' || peek() === '/') {
        const op = s[i++];
        const r = parseFactor();
        v = op === '*' ? v * r : v / r;
      }
      return v;
    };
    const parseFactor = () => {
      if (peek() === '-') { i++; return -parseFactor(); }
      if (peek() === '+') { i++; return parseFactor(); }
      if (peek() === '(') {
        i++;
        const v = parseExpr();
        if (peek() !== ')') throw new Error('Parenthèse manquante');
        i++;
        return v;
      }
      const start = i;
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      if (start === i) throw new Error('Nombre attendu');
      return parseFloat(s.slice(start, i));
    };
    const result = parseExpr();
    if (i < s.length) throw new Error('Expression invalide');
    return result;
  }

  _getTimeInfo() {
    const timeStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `📅 Nous sommes le **${timeStr}**. Belle journée, j'espère !`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTILS & API EXTERNES
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
      if (match && match[1]) return match[1].replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/gi, '').trim();
    }
    return '';
  }

  _extractSearchQuery(msg) {
    const match = msg.match(/(?:recherche|cherche|search|trouve|find|google|info sur)\s+(?:de\s+|des?\s+|les?\s+|la\s+|le\s+|un\s+|une?\s+)?(.+)/i);
    return match ? match[1].trim() : msg;
  }

  _extractImagePrompt(message) {
    const patterns = [
      /(?:génère|genere|crée|creer|dessine|image de|picture|generate image|illustre|photo de|vidéo de)\s+(?:une?\s+)?(?:image\s+|vidéo\s+)?(?:de\s+)?(.+)/i,
      /(?:image|vidéo)\s+(?:de\s+)?(.+)/i
    ];
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) return match[1].trim();
    }
    return message;
  }

  async _fetchOnlineDefinition(word, lang = 'fr') {
    this.stats.totalDefinitions = (this.stats.totalDefinitions || 0) + 1;
    if (!word || word.length < 2) return "🤔 Pourrais-tu préciser le mot que tu veux que je définisse ?";

    const langNames = { fr: 'français', en: 'anglais', es: 'espagnol', de: 'allemand', it: 'italien', pt: 'portugais', ru: 'russe', nl: 'néerlandais', pl: 'polonais', ja: 'japonais', zh: 'chinois', ar: 'arabe' };

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
              let response = `📖 **Définition de "${word}"** (${langNames[lang] || lang})\n\n`;
              (entry.meanings || []).slice(0, 3).forEach((meaning, idx) => {
                response += `**${idx + 1}. ${meaning.partOfSpeech || 'nom'}**\n`;
                (meaning.definitions || []).slice(0, 2).forEach(def => {
                  response += `• ${def.definition}\n`;
                  if (def.example) response += `  _Exemple : "${def.example}"_\n`;
                });
                response += '\n';
              });
              if (entry.phonetic) response += `🔊 **Prononciation :** ${entry.phonetic}\n`;
              response += `\n💡 *Langue : ${langNames[lang] || lang} | Source : Dictionary API*`;
              resolve(response);
            } else if (lang !== 'en') {
              this._fetchOnlineDefinition(word, 'en').then(resolve);
            } else {
              resolve(`🤔 Je n'ai pas trouvé "${word}" dans le dictionnaire ${langNames[lang]}. Essaye une autre orthographe !\n\n💡 *Langues supportées : FR, EN, ES, DE, IT, PT, RU, NL, PL, JA, ZH, AR*`);
            }
          } catch (e) {
            resolve(`⚠️ Erreur lors de la connexion au dictionnaire.`);
          }
        });
      }).on('error', () => resolve(`❌ Impossible de contacter le dictionnaire en ligne.`));
    });
  }

  async search(query, lang = 'fr') {
    this.stats.totalSearches = (this.stats.totalSearches || 0) + 1;
    return new Promise((resolve) => {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // GÉNÉRATION D'IMAGES ET VIDÉOS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Ajoute le filigrane "Vyrox AI" aux dimensions réelles de l'image. */
  async _applyWatermark(buffer) {
    if (!sharp) return buffer;
    const { width, height } = await sharp(buffer).metadata();
    const fontSize = Math.max(20, Math.floor(width / 25));
    const y = Math.floor(height * 0.95);
    // librsvg ne gère pas text-shadow : on simule l'ombre avec un 2e texte décalé
    const svg = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="${width / 2 + 2}" y="${y + 2}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="rgba(0,0,0,0.6)" text-anchor="middle">Vyrox AI</text>
        <text x="${width / 2}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="rgba(255,255,255,0.7)" text-anchor="middle">Vyrox AI</text>
      </svg>`
    );
    return sharp(buffer).composite([{ input: svg, top: 0, left: 0 }]).toBuffer();
  }

  /** Génère une image via Pollinations.ai + filigrane Vyrox. */
  async generateImage(prompt) {
    this.stats.totalImages = (this.stats.totalImages || 0) + 1;

    try {
      const buffer = await generateImageBuffer(prompt, {
        width: 1024, height: 1024, suffix: 'high quality, detailed, 8k, masterpiece'
      });
      const finalBuffer = await this._applyWatermark(buffer);

      const filename = `vyrox_img_${Date.now()}.png`;
      fs.writeFileSync(path.join(this.outputDir, filename), finalBuffer);

      return {
        success: true,
        prompt,
        message: '🎨 Image générée avec succès !',
        url: `/uploads/generations/${filename}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erreur génération image:', error);
      return { success: false, prompt, message: error.userMessage || "❌ Erreur lors de la génération de l'image.", url: null };
    }
  }

  /**
   * "Vidéo" : image cinématique 16:9 (la vraie génération vidéo n'est pas
   * réaliste en local sans GPU). Le filigrane est appliqué aussi.
   */
  async generateVideo(prompt) {
    this.stats.totalVideos = (this.stats.totalVideos || 0) + 1;

    try {
      const buffer = await generateImageBuffer(prompt, {
        width: 1024, height: 576, suffix: 'cinematic, motion blur, dynamic angle, 4k'
      });
      const finalBuffer = await this._applyWatermark(buffer);

      const filename = `vyrox_vid_${Date.now()}.png`;
      fs.writeFileSync(path.join(this.outputDir, filename), finalBuffer);

      return {
        success: true,
        prompt,
        message: '🎬 Scène générée (format image cinématique) :',
        url: `/uploads/generations/${filename}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erreur génération vidéo:', error);
      return { success: false, prompt, message: error.userMessage || '❌ Erreur lors de la génération de la scène.', url: null };
    }
  }

  /** Télécharge un buffer (suit les redirections, timeout 60 s). */
  _downloadBuffer(url, redirects = 5) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          res.resume();
          resolve(this._downloadBuffer(new URL(res.headers.location, url).toString(), redirects - 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.setTimeout(60000, () => req.destroy(new Error('Timeout téléchargement')));
      req.on('error', reject);
    });
  }
}

module.exports = VyroxLocalAI;