/**
 * ═══════════════════════════════════════════════════════════
 * VYROX AI — AUTHENTICATION SYSTEM
 * Système de login/register avec JWT
 * Orinstudio © 2026-2029
 * ═══════════════════════════════════════════════════════════
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = '72h';
const SALT_ROUNDS = 12;

class AuthSystem {
  constructor(database) {
    this.db = database;
    this.JWT_SECRET = JWT_SECRET;
  }

  // ═══════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════
  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Nom d\'utilisateur requis' };
    }
    if (username.length < 3 || username.length > 30) {
      return { valid: false, error: 'Le nom doit faire entre 3 et 30 caractères' };
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(username)) {
      return { valid: false, error: 'Seuls les lettres, chiffres, _ et - sont autorisés' };
    }
    return { valid: true };
  }

  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email requis' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Format d\'email invalide' };
    }
    if (email.length > 100) {
      return { valid: false, error: 'Email trop long' };
    }
    return { valid: true };
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Mot de passe requis' };
    }
    if (password.length < 8) {
      return { valid: false, error: 'Le mot de passe doit faire au moins 8 caractères' };
    }
    if (password.length > 128) {
      return { valid: false, error: 'Mot de passe trop long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Au moins une majuscule requise' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Au moins une minuscule requise' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Au moins un chiffre requis' };
    }
    return { valid: true };
  }

  // ═══════════════════════════════════════════════════════
  // INSCRIPTION
  // ═══════════════════════════════════════════════════════
  async register(username, email, password) {
    // Validation
    const usernameCheck = this.validateUsername(username);
    if (!usernameCheck.valid) return { success: false, error: usernameCheck.error };
    
    const emailCheck = this.validateEmail(email);
    if (!emailCheck.valid) return { success: false, error: emailCheck.error };
    
    const passwordCheck = this.validatePassword(password);
    if (!passwordCheck.valid) return { success: false, error: passwordCheck.error };

    // Vérifier l'unicité
    const existingUser = this.db.getUserByUsername(username);
    if (existingUser) {
      return { success: false, error: 'Ce nom d\'utilisateur est déjà pris' };
    }

    const existingEmail = this.db.getUserByEmail(email);
    if (existingEmail) {
      return { success: false, error: 'Cet email est déjà utilisé' };
    }

    // Hashage du mot de passe
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Création de l'utilisateur
    const user = this.db.createUser(username, email, passwordHash);

    // Création de la session
    const token = this.generateToken(user.id);
    const session = this.db.createSession(user.id, token);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token: session.token,
      message: 'Inscription réussie ! Bienvenue sur Vyrox AI.'
    };
  }

  // ══════════════════════════════════════════════════════
  // CONNEXION
  // ═══════════════════════════════════════════════════════
  async login(identifier, password, ip = '', ua = '') {
    // Trouver l'utilisateur par username ou email
    let user = this.db.getUserByUsername(identifier);
    if (!user) {
      user = this.db.getUserByEmail(identifier);
    }

    if (!user) {
      return { success: false, error: 'Identifiants incorrects' };
    }

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return { success: false, error: 'Identifiants incorrects' };
    }

    // Mettre à jour la dernière connexion
    this.db.updateLastLogin(user.id);

    // Supprimer les anciennes sessions
    this.db.deleteUserSessions(user.id);

    // Créer une nouvelle session
    const token = this.generateToken(user.id);
    const session = this.db.createSession(user.id, token, 72, ip, ua);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      },
      token: session.token,
      message: `Content de vous revoir, ${user.username} !`
    };
  }

  // ══════════════════════════════════════════════════════
  // VÉRIFICATION DE SESSION
  // ═══════════════════════════════════════════════════════
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      const session = this.db.getSessionByToken(token);
      
      if (!session) {
        return { valid: false, error: 'Session invalide' };
      }

      // Mettre à jour l'activité
      this.db.updateSessionActivity(token);

      return {
        valid: true,
        user: {
          id: session.user_id,
          username: session.username,
          email: session.email
        }
      };
    } catch (err) {
      return { valid: false, error: 'Token expiré ou invalide' };
    }
  }

  logout(token) {
    this.db.deleteSession(token);
    return { success: true, message: 'Déconnexion réussie' };
  }

  // ═══════════════════════════════════════════════════════
  // TOKENS JWT
  // ═══════════════════════════════════════════════════════
  generateToken(userId) {
    return jwt.sign(
      { userId, iat: Date.now() },
      this.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  // ═══════════════════════════════════════════════════════
  // MIDDLEWARE
  // ═══════════════════════════════════════════════════════
  getAuthMiddleware() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : null;

      if (!token) {
        return { authenticated: false, error: 'Token manquant' };
      }

      const result = this.verifyToken(token);
      if (!result.valid) {
        return { authenticated: false, error: result.error };
      }

      return { authenticated: true, user: result.user };
    };
  }
}

module.exports = AuthSystem;