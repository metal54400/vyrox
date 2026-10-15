# Vyrox AI (PHP)

IA conversationnelle d'Orinstudio, réécrite en **PHP + MySQL**.

## Pages
- `index.php` — présentation de l'IA et tarifs
- `register.php` / `login.php` / `logout.php` — comptes
- `chat.php` — poser des questions (mode **Normal** et mode **Code**), conversations sauvegardées
- `admin.php` — gestion des utilisateurs, rôles (`user`/`admin`), plan (`free`/`pro`) et crédits
- `install.php` — crée les tables et le premier admin (**à supprimer après**)

## Fonctionnement
- **Rôles** : `user` par défaut, `admin` pour accéder au panneau d'administration.
- **Plans** : `free` par défaut (limité à `FREE_DAILY_CREDITS` messages/jour, réinitialisés chaque jour),
  `pro` = messages illimités + modèle plus performant (`GROQ_MODEL_PRO`).
- **Modes** : *Normal* (conversation) et *Code* (assistant programmation spécialisé).
- Conversations et messages stockés dans **MySQL**.

## Installation
1. Crée une base MySQL, puis copie `.env.exemple` → `.env` et remplis-le.
2. Sers le dossier avec PHP : `php -S localhost:8000`
3. Ouvre `http://localhost:8000/install.php`, crée l'admin, **supprime `install.php`**.
4. Connecte-toi et commence à discuter.

## Prérequis
PHP 8.1+ avec `pdo_mysql` et `curl`, un serveur MySQL, une clé API Groq (ou compatible OpenAI).
