/**
 * ═══════════════════════════════════════════════════════════
 * VYROX AI — AUTHENTICATION SYSTEM
 * Système de login/register avec JWT et gestion des rôles
 * Orinstudio © 2026-2029
 * ═══════════════════════════════════════════════════════════
 */

const bcrypt = require('bcrypt'); // ← Remplacement de bcryptjs par bcrypt (plus rapide)
const jwt = require('jsonwebtoken');

// Sécurité : Ne jamais générer de secret aléatoire en production, 
 // car cela invaliderait toutes les sessions au redémarrage du serveur.
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  ATTENTION : JWT_SECRET non défini dans le fichier .env ! Les sessions ne survivront pas au redémarrage.');
}

const JWT_SECRET = process.env.JWT_SECRET || '8160e0c17341524fb08430bba70be4d3844cfae99912456b6dd704b04427c793';
const JWT_EXPIRY = '72h';
const SALT_ROUNDS = 10; // 10 est un excellent compromis sécurité/performance avec bcrypt natif

class AuthSystem {
  constructor(database) {
    this.db = database;
    this.JWT_SECRET = JWT_SECRET;
  }

  // ═══════════════════════════════════════════════════════
  // VALIDATION DES DONNÉES
  // ═══════════════════════════════════════════════════════
  validateUsername(username) {
    if (!username || typeof username !== 'string') return { valid: false, error: 'Nom d\'utilisateur requis' };
    if (username.length < 3 || username.length > 30) return { valid: false, error: 'Le nom doit faire entre 3 et 30 caractères' };
    if (!/^[a-zA-Z0-9_\-]+$/.test(username)) return { valid: false, error: 'Seuls les lettres, chiffres, _ et - sont autorisés' };
    return { valid: true };
  }

  validateEmail(email) {
    if (!email || typeof email !== 'string') return { valid: false, error: 'Email requis' };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return { valid: false, error: 'Format d\'email invalide' };
    if (email.length > 100) return { valid: false, error: 'Email trop long' };
    return { valid: true };
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') return { valid: false, error: 'Mot de passe requis' };
    if (password.length < 8) return { valid: false, error: 'Le mot de passe doit faire au moins 8 caractères' };
    if (password.length > 128) return { valid: false, error: 'Mot de passe trop long' };
    // On assouplit légèrement les règles pour l'UX, mais on garde une bonne sécurité
    if (!/(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
      return { valid: false, error: 'Le mot de passe doit contenir au moins une majuscule et un chiffre' };
    }
    return { valid: true };
  }

  // ═══════════════════════════════════════════════════════
  // INSCRIPTION
  // ═══════════════════════════════════════════════════════
  async register(username, email, password) {
    const usernameCheck = this.validateUsername(username);
    if (!usernameCheck.valid) return { success: false, error: usernameCheck.error };
    
    const emailCheck = this.validateEmail(email);
    if (!emailCheck.valid) return { success: false, error: emailCheck.error };
    
    const passwordCheck = this.validatePassword(password);
    if (!passwordCheck.valid) return { success: false, error: passwordCheck.error };

    if (this.db.getUserByUsername(username)) {
      return { success: false, error: 'Ce nom d\'utilisateur est déjà pris' };
    }

    if (this.db.getUserByEmail(email)) {
      return { success: false, error: 'Cet email est déjà utilisé' };
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = this.db.createUser(username, email, passwordHash);
    const token = this.generateToken(user.id);
    
    // On récupère l'utilisateur complet pour s'assurer d'avoir le rôle et l'avatar
    const fullUser = this.db.getUserById(user.id);

    return {
      success: true,
      user: {
        id: fullUser.id,
        username: fullUser.username,
        email: fullUser.email,
        role: fullUser.role || 'free',
        avatar: fullUser.avatar || ''
      },
      token: token,
      message: 'Inscription réussie ! Bienvenue sur Vyrox AI.'
    };
    // Note: La session est créée côté serveur via setCookie dans server.js
  }

  // ═══════════════════════════════════════════════════════
  // CONNEXION
  // ═══════════════════════════════════════════════════════
  async login(identifier, password, ip = '', ua = '') {
    let user = this.db.getUserByUsername(identifier) || this.db.getUserByEmail(identifier);

    if (!user) {
      // Petit délai pour éviter les attaques par énumération d'utilisateurs (timing attack)
      await new Promise(resolve => setTimeout(resolve, 300));
      return { success: false, error: 'Identifiants incorrects' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { success: false, error: 'Identifiants incorrects' };
    }

    this.db.updateLastLogin(user.id);
    
    // Sécurité : On invalide les anciennes sessions de cet utilisateur (connexion unique ou nettoyage)
    this.db.deleteUserSessions(user.id);

    const token = this.generateToken(user.id);
    this.db.createSession(user.id, token, 72, ip, ua);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'free',
        avatar: user.avatar || ''
      },
      token: token,
      message: `Content de vous revoir, ${user.username} !`
    };
  }

  // ═══════════════════════════════════════════════════════
  // VÉRIFICATION DE SESSION (Utilisé par getAuthenticatedUser)
  // ═══════════════════════════════════════════════════════
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      const session = this.db.getSessionByToken(token);
      
      if (!session) {
        return { valid: false, error: 'Session révoquée ou invalide' };
      }

      // Mise à jour silencieuse de l'activité pour garder la session vivante
      this.db.updateSessionActivity(token);

      return {
        valid: true,
        user: {
          id: session.user_id,
          username: session.username,
          email: session.email,
          role: session.role || 'free', // ← CRUCIAL : Le rôle doit être ici pour les vérifications admin
          avatar: session.avatar || ''
        }
      };
    } catch (err) {
      return { valid: false, error: 'Token expiré ou invalide' };
    }
  }

  logout(token) {
    if (token) {
      this.db.deleteSession(token);
    }
    return { success: true, message: 'Déconnexion réussie' };
  }

  // ═══════════════════════════════════════════════════════
  // GÉNÉRATION DE TOKEN
  // ═══════════════════════════════════════════════════════
  generateToken(userId) {
    return jwt.sign(
      { userId, iat: Math.floor(Date.now() / 1000) },
      this.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  // ═══════════════════════════════════════════════════════
  // HELPER D'AUTORISATION (Pour usage manuel dans server.js)
  // ═══════════════════════════════════════════════════════
  requireAdmin(token) {
    const result = this.verifyToken(token);
    if (!result.valid) {
      return { authorized: false, error: result.error };
    }
    if (result.user.role !== 'admin') {
      return { authorized: false, error: 'Accès réservé aux administrateurs' };
    }
    return { authorized: true, user: result.user };
  }
}

module.exports = AuthSystem;