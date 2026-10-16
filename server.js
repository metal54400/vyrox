/**
 * ═══════════════════════════════════════════════════════════
 * VYROX AI SERVER — VERSION ULTIME HYBRIDE (HTTP + HTTPS)
 * Auth + SQLite + Groq/OpenAI + Cerveau Collectif + Double Port
 * Licence © 2026-2029 Orinstudio
 * ═══════════════════════════════════════════════════════════
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const bcrypt = require('bcrypt');
const multer = require('multer'); // ← NOUVEAU : Pour l'upload d'avatars

// Imports des modules principaux
const VyroxAI = require('./vyrox-ai');
const VyroxDatabase = require('./database');
const AuthSystem = require('./auth');
const CerveauCollectif = require('./cerveau');

// Configuration des ports
const PORT = parseInt(process.env.PORT || '80', 10);
const HttpsPort = parseInt(process.env.HttpsPort || '443', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');
const CERTS_DIR = path.join(__dirname, 'cert');

// ═══════════════════════════════════════════════════════════
// CONFIGURATION MULTER (Upload d'avatars)
// ═══════════════════════════════════════════════════════════
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(PUBLIC_DIR, 'uploads', 'avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // On utilise req.user.id qui sera attaché avant l'appel à multer
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  }
});

const uploadAvatar = multer({ 
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Max 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont autorisées'), false);
  }
}).single('avatar');

// ═══════════════════════════════════════════════════════════
// DÉTECTION AUTOMATIQUE SSL
// ══════════════════════════════════════════════════════════

const sslFiles = {
  key:  path.join(CERTS_DIR, 'vyrox.deepstone.fr-key.pem'),
  cert: path.join(CERTS_DIR, 'vyrox.deepstone.fr-crt.pem'),
  ca:   path.join(CERTS_DIR, 'vyrox.deepstone.fr-chain.pem')
};

const sslReady = Object.values(sslFiles).every(f => fs.existsSync(f));

let serverModule;
let serverOptions = {};
let activePort;

if (sslReady) {
  serverModule = require('https');
  activePort = HttpsPort;
  serverOptions = {
    key:  fs.readFileSync(sslFiles.key),
    cert: fs.readFileSync(sslFiles.cert),
    ca:   fs.readFileSync(sslFiles.ca),
    passphrase: '1504',
    minVersion: 'TLSv1.2',
    ciphers: [
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384'
    ].join(':'),
    honorCipherOrder: true
  };
  console.log(`🔒 Certificats SSL détectés → Mode HTTPS activé sur le port ${HttpsPort}`);
} else {
  serverModule = require('http');
  activePort = PORT;
  console.log(`⚠️  Certificats SSL introuvables → Mode HTTP activé sur le port ${PORT} (développement)`);
}

// ══════════════════════════════════════════════════════════
// INITIALISATION DES SYSTÈMES CENTRAUX
// ══════════════════════════════════════════════════════════

const db = new VyroxDatabase();
const auth = new AuthSystem(db);

const cerveau = new CerveauCollectif({ 
  maxKnowledgeNodes: 10000,
  similarityThreshold: 0.7,
  minConfidence: 0.5,
  persistencePath: path.join(__dirname, 'data', 'cerveau.json')
});

const vyrox = new VyroxAI(db); 

// Réinitialisation automatique des quotas gratuits à minuit
const now = new Date();
const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();

setTimeout(() => {
  vyrox.resetQuotas();
  console.log('🔄 Quotas gratuits réinitialisés. Modèle principal restauré.');
  
  setInterval(() => {
    vyrox.resetQuotas();
    console.log('🔄 Quotas gratuits réinitialisés (minuit)');
  }, 24 * 60 * 60 * 1000);
}, msUntilMidnight);

// Entraînement automatique du cerveau toutes les 24h
setInterval(() => {
  console.log('🧠 Entraînement automatique du Cerveau Collectif en cours...');
  cerveau.train();
}, 24 * 60 * 60 * 1000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

// ═══════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════

function readFileSafe(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function getCookie(req, name) {
  const cookies = req.headers.cookie?.split(';') || [];
  const cookie = cookies.find(c => c.trim().startsWith(`${name}=`));
  return cookie ? cookie.split('=')[1] : null;
}

function setCookie(res, name, value, maxAge = 259200) {
  const secureFlag = sslReady ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureFlag}`);
}

function getAuthenticatedUser(req) {
  const token = getCookie(req, 'vyrox_token') || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const result = auth.verifyToken(token);
  return result.valid ? result.user : null;
}

// ══════════════════════════════════════════════════════════
// SERVEUR (HTTP ou HTTPS selon détection)
// ══════════════════════════════════════════════════════════

const server = serverModule.createServer(serverOptions, async (req, res) => {
  const protocol = sslReady ? 'https' : 'http';
  const parsedUrl = new URL(req.url, `${protocol}://localhost:${activePort}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Headers de sécurité
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (sslReady) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ── AUTHENTIFICATION ───────────────────────────────
    
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req);
      const result = await auth.register(body.username, body.email, body.password);
      if (result.success) {
        setCookie(res, 'vyrox_token', result.token);
        sendJSON(res, 201, result);
      } else {
        sendJSON(res, 400, result);
      }
      return;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const ua = req.headers['user-agent'] || '';
      const result = await auth.login(body.identifier, body.password, ip, ua);
      if (result.success) {
        setCookie(res, 'vyrox_token', result.token);
        sendJSON(res, 200, result);
      } else {
        sendJSON(res, 401, result);
      }
      return;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = getCookie(req, 'vyrox_token') || req.headers.authorization?.replace('Bearer ', '');
      if (token) auth.logout(token);
      res.setHeader('Set-Cookie', `vyrox_token=; Path=/; Max-Age=0${sslReady ? '; Secure' : ''}`);
      sendJSON(res, 200, { success: true, message: 'Déconnecté' });
      return;
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const token = getCookie(req, 'vyrox_token') || req.headers.authorization?.replace('Bearer ', '');
      if (!token) { sendJSON(res, 401, { success: false, error: 'Non connecté' }); return; }
      const result = auth.verifyToken(token);
      if (!result.valid) { sendJSON(res, 401, { success: false, error: result.error }); return; }
      sendJSON(res, 200, { success: true, user: result.user });
      return;
    }

    // ─ CONVERSATIONS ──────────────────────────────────
    
    if (pathname === '/api/conversations' && method === 'GET') {
      const user = getAuthenticatedUser(req);
      if (!user) { sendJSON(res, 401, { error: 'Non connecté' }); return; }
      sendJSON(res, 200, { conversations: db.getUserConversations(user.id) });
      return;
    }

    if (pathname === '/api/conversations' && method === 'POST') {
      const user = getAuthenticatedUser(req);
      if (!user) { sendJSON(res, 401, { error: 'Non connecté' }); return; }
      const body = await parseBody(req);
      sendJSON(res, 201, { conversation: db.createConversation(user.id, body.title) });
      return;
    }

    if (pathname.match(/^\/api\/conversations\/(\d+)$/) && method === 'GET') {
      const user = getAuthenticatedUser(req);
      if (!user) { sendJSON(res, 401, { error: 'Non connecté' }); return; }
      const convId = parseInt(pathname.split('/').pop());
      const conv = db.getConversation(convId);
      if (!conv || conv.user_id !== user.id) { sendJSON(res, 404, { error: 'Conversation non trouvée' }); return; }
      sendJSON(res, 200, { messages: db.getConversationMessages(convId) });
      return;
    }

    if (pathname.match(/^\/api\/conversations\/(\d+)$/) && method === 'PATCH') {
      const user = getAuthenticatedUser(req);
      if (!user) { sendJSON(res, 401, { error: 'Non connecté' }); return; }
      const convId = parseInt(pathname.split('/').pop());
      const conv = db.getConversation(convId);
      if (!conv || conv.user_id !== user.id) { sendJSON(res, 404, { error: 'Conversation non trouvée' }); return; }
      const body = await parseBody(req);
      db.updateConversationTitle(convId, body.title);
      sendJSON(res, 200, { success: true });
      return;
    }

    if (pathname.match(/^\/api\/conversations\/(\d+)$/) && method === 'DELETE') {
      const user = getAuthenticatedUser(req);
      if (!user) { sendJSON(res, 401, { error: 'Non connecté' }); return; }
      const convId = parseInt(pathname.split('/').pop());
      const conv = db.getConversation(convId);
      if (!conv || conv.user_id !== user.id) { sendJSON(res, 404, { error: 'Conversation non trouvée' }); return; }
      db.deleteConversation(convId);
      sendJSON(res, 200, { success: true });
      return;
    }

    // ─ IA & CHAT ──────────────────────────────────────
    
    if (pathname === '/api/chat' && method === 'POST') {
      const body = await parseBody(req);
      const user = getAuthenticatedUser(req);
      const userId = user ? user.id : null;
      
      const response = await vyrox.process(body.message, body.sessionId, userId);
      
      cerveau.recordInteraction(userId, body.message, response.response, {
        sessionId: body.sessionId,
        intent: response.type,
        type: response.type,
        model: response.stats?.currentModel
      });
      
      if (userId) {
        let convId = body.conversationId;
        if (!convId || isNaN(parseInt(convId))) {
          const title = body.message.substring(0, 50) + (body.message.length > 50 ? '...' : '');
          const conv = db.createConversation(userId, title);
          convId = conv.id;
        }
        db.addMessage(convId, 'user', body.message, 'text');
        db.addMessage(convId, 'assistant', response.response, response.type, response.data);
        response.conversationId = convId;
      }
      sendJSON(res, 200, response);
      return;
    }

    if (pathname === '/api/generate-image' && method === 'POST') {
      const body = await parseBody(req);
      sendJSON(res, 200, await vyrox.generateImage(body.prompt));
      return;
    }

    if (pathname === '/api/search' && method === 'GET') {
      const query = parsedUrl.searchParams.get('q') || '';
      sendJSON(res, 200, await vyrox.search(query));
      return;
    }

    // ── FEEDBACK & AMÉLIORATION ────────────────────────
    
    if (pathname === '/api/feedback' && method === 'POST') {
      const user = getAuthenticatedUser(req);
      if (!user) { sendJSON(res, 401, { error: 'Non connecté' }); return; }
      const body = await parseBody(req);
      db.saveFeedback(user.id, body.sentiment, body.message, body.aiResponse || '');
      cerveau.recordFeedback(body.interactionId || '', body.sentiment, body.comment || '');
      sendJSON(res, 200, { success: true, message: 'Feedback enregistré' });
      return;
    }

    if (pathname === '/api/improvement' && method === 'POST') {
      const user = getAuthenticatedUser(req);
      if (!user) { sendJSON(res, 401, { error: 'Non connecté' }); return; }
      const body = await parseBody(req);
      db.saveImprovement(user.id, body.suggestion, body.context || '');
      sendJSON(res, 200, { success: true, message: 'Suggestion enregistrée' });
      return;
    }

    // ─ CERVEAU COLLECTIF ──────────────────────────────
    
    if (pathname === '/api/cerveau/train' && method === 'POST') {
      cerveau.train();
      sendJSON(res, 200, { success: true, stats: cerveau.getStats() });
      return;
    }

    if (pathname === '/api/cerveau/stats' && method === 'GET') {
      sendJSON(res, 200, cerveau.getStats());
      return;
    }

    // ── STATISTIQUES GÉNÉRALES ─────────────────────────
    
    if (pathname === '/api/stats' && method === 'GET') {
      sendJSON(res, 200, { 
        ...vyrox.getStats(), 
        database: db.getGlobalStats(), 
        brain: cerveau.getStats() 
      });
      return;
    }

    if (pathname === '/api/stats/feedback' && method === 'GET') {
      sendJSON(res, 200, { 
        stats: db.getFeedbackStats(), 
        improvements: db.getRecentImprovements(5) 
      });
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // ── ADMINISTRATION (Réservé aux admins) ────────────────────
    // ═══════════════════════════════════════════════════════════

    // 1. Liste tous les utilisateurs
    if (pathname === '/api/users' && method === 'GET') {
      const user = getAuthenticatedUser(req);
      if (!user || user.role !== 'admin') { sendJSON(res, 403, { error: 'Accès refusé : Administrateurs uniquement' }); return; }
      
      const users = db.db.prepare('SELECT id, username, email, role, created_at, is_active, avatar FROM users ORDER BY created_at DESC').all();
      sendJSON(res, 200, users);
      return;
    }

    // 2. Promouvoir ou rétrograder un utilisateur
    if (pathname === '/api/admin/promote' && method === 'POST') {
      const user = getAuthenticatedUser(req);
      if (!user || user.role !== 'admin') { sendJSON(res, 403, { error: 'Accès refusé : Administrateurs uniquement' }); return; }
      
      const body = await parseBody(req);
      try {
        db.setUserRole(body.targetUserId, body.role);
        sendJSON(res, 200, { success: true, message: `Rôle mis à jour en ${body.role}` });
      } catch (e) {
        sendJSON(res, 500, { error: e.message });
      }
      return;
    }

    // 3. Réinitialiser le mot de passe d'un utilisateur
    if (pathname === '/api/admin/reset-password' && method === 'POST') {
      const user = getAuthenticatedUser(req);
      if (!user || user.role !== 'admin') { sendJSON(res, 403, { error: 'Accès refusé : Administrateurs uniquement' }); return; }
      
      const body = await parseBody(req);
      try {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(body.newPassword, salt);
        
        db.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, body.targetUserId);
        sendJSON(res, 200, { success: true, message: 'Mot de passe réinitialisé avec succès' });
      } catch (e) {
        sendJSON(res, 500, { error: e.message });
      }
      return;
    }

    // 4. Supprimer un utilisateur
    if (pathname.match(/^\/api\/users\/(\d+)$/) && method === 'DELETE') {
      const user = getAuthenticatedUser(req);
      if (!user || user.role !== 'admin') { sendJSON(res, 403, { error: 'Accès refusé : Administrateurs uniquement' }); return; }
      
      const userId = parseInt(pathname.split('/').pop());
      
      // Empêcher l'auto-suppression
      if (userId === user.id) { 
        sendJSON(res, 400, { error: 'Vous ne pouvez pas supprimer votre propre compte administrateur' }); 
        return; 
      }
      
      db.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      sendJSON(res, 200, { success: true, message: 'Utilisateur supprimé avec succès' });
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // ── GESTION DU PROFIL UTILISATEUR ──────────────────────────
    // ═══════════════════════════════════════════════════════════

    // 1. Upload de l'avatar
    if (pathname === '/api/profile/avatar' && method === 'POST') {
      const user = getAuthenticatedUser(req);
      if (!user) { sendJSON(res, 401, { error: 'Non connecté' }); return; }

      req.user = user; // Attachement pour que multer puisse générer le nom du fichier

      uploadAvatar(req, res, async (err) => {
        if (err) return sendJSON(res, 400, { error: err.message });
        if (!req.file) return sendJSON(res, 400, { error: 'Aucun fichier fourni' });

        try {
          const newAvatarPath = req.file.filename;
          db.db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(newAvatarPath, user.id);
          
          sendJSON(res, 200, { success: true, avatar: newAvatarPath });
        } catch (e) {
          console.error('Erreur DB avatar:', e);
          sendJSON(res, 500, { error: 'Erreur base de données' });
        }
      });
      return;
    }

    // 2. Changement de mot de passe
    if (pathname === '/api/profile/password' && method === 'POST') {
      const user = getAuthenticatedUser(req);
      if (!user) { sendJSON(res, 401, { error: 'Non connecté' }); return; }

      const body = await parseBody(req);
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return sendJSON(res, 400, { error: 'Tous les champs sont requis' });
      }

      if (newPassword.length < 6) {
        return sendJSON(res, 400, { error: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
      }

      try {
        const dbUser = db.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
        
        const isMatch = bcrypt.compareSync(currentPassword, dbUser.password_hash);
        if (!isMatch) {
          return sendJSON(res, 401, { error: 'Mot de passe actuel incorrect' });
        }

        const salt = bcrypt.genSaltSync(10);
        const newHash = bcrypt.hashSync(newPassword, salt);
        
        db.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
        
        sendJSON(res, 200, { success: true, message: 'Mot de passe mis à jour' });
      } catch (e) {
        console.error('Erreur changement MDP:', e);
        sendJSON(res, 500, { error: 'Erreur interne du serveur' });
      }
      return;
    }

    // ─ FICHIERS STATIQUES ─────────────────────────────
    
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Accès refusé');
      return;
    }

    // Gestion des routes spécifiques pour les pages HTML (SPA routing)
    // Ajout de /auth/admin et /clients/profile ici
    if (pathname === '/auth/login' || pathname === '/auth/register' || pathname === '/auth/admin' || pathname === '/clients/profile') {
      filePath = path.join(PUBLIC_DIR, pathname, 'index.html');
    }

    

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const data = await readFileSafe(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><title>404</title></head><body style="background:#0a0a1a;color:#00f0ff;font-family:monospace;text-align:center;padding:50px;"><h1> 404</h1><p>Page non trouvée dans la matrice</p><a href="/" style="color:#b44aff;">← Retour</a></body></html>`);
    }

  } catch (e) {
    console.error('Erreur serveur:', e);
    sendJSON(res, 500, { error: 'Erreur interne du serveur' });
  }
  if (ext === '.mp4') {
  try {
    const stat = await fs.promises.stat(filePath);
    const range = req.headers.range;
    if (range) {
      const [s, e] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(s, 10) || 0;
      const end = e ? Math.min(parseInt(e, 10), stat.size - 1) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch {
    res.writeHead(404);
    res.end('Vidéo introuvable');
  }
  return;
}
});

// ═══════════════════════════════════════════════════════════
// DÉMARRAGE
// ══════════════════════════════════════════════════════════

server.listen(activePort, () => {
  const protocol = sslReady ? 'https' : 'http';
  const lockIcon = sslReady ? '🔒' : '⚠️ ';
  const sslStatus = sslReady ? 'TLS 1.2+' : 'NON SÉCURISÉ';
  
  const portStr = String(activePort).padEnd(26, ' ');
  const sslStr = sslStatus.padEnd(21, ' ');
  
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   VYROX AI v5.0 (Orchestrateur Hybride)                ║
║   Orinstudio © 2026-2029                                ║
║   ${lockIcon} Serveur actif sur ${protocol}://localhost:${portStr}║
║   SQLite: ✅ | Auth: ✅ | SSL: ${sslStr}║
║   Cerveau Collectif: ✅ | Apprentissage Auto: ✅        ║
╚══════════════════════════════════════════════════════════╝
  `);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Le port ${activePort} est déjà utilisé.`);
  } else {
    console.error('❌ Erreur serveur:', err.message);
  }
});

if (sslReady) {
  server.on('clientError', (err, socket) => {
    console.error('Erreur client SSL:', err.message);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });
}

process.on('uncaughtException', (err) => {
  console.error('💥 Erreur non gérée:', err);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Fermeture propre du système VYROX...');
  cerveau.save();
  db.close();
  process.exit(0);
});