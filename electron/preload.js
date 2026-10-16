/**
 * ══════════════════════════════════════════════════════════
 * VYROX AI — PRELOAD SCRIPT
 * Pont sécurisé entre Electron et le renderer
 * Orinstudio © 2026-2029
 * ═══════════════════════════════════════════════════════════
 */

const { contextBridge, ipcRenderer } = require('electron');

// Exposition sécurisée des API Electron vers le monde web
contextBridge.exposeInMainWorld('vyroxElectron', {
  // --- Informations système ---
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // --- Contrôle fenêtre ---
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  
  // --- Écouteurs d'événements (avec nettoyage automatique) ---
  onNewConversation: (callback) => {
    const listener = (_, ...args) => callback(...args);
    ipcRenderer.on('new-conversation', listener);
    return () => ipcRenderer.removeListener('new-conversation', listener);
  },
  onShowStats: (callback) => {
    const listener = (_, ...args) => callback(...args);
    ipcRenderer.on('show-stats', listener);
    return () => ipcRenderer.removeListener('show-stats', listener);
  },
  onOpenPreferences: (callback) => {
    const listener = (_, ...args) => callback(...args);
    ipcRenderer.on('open-preferences', listener);
    return () => ipcRenderer.removeListener('open-preferences', listener);
  },
  onExportConversation: (callback) => {
    const listener = (_, filePath) => callback(filePath);
    ipcRenderer.on('export-conversation', listener);
    return () => ipcRenderer.removeListener('export-conversation', listener);
  },
  
  // --- Notifications natives ---
  notify: (title, body) => {
    new Notification(title, { body });
  },
  
  // --- Indicateurs ---
  isElectron: true,
  platform: process.platform
});

console.log('✅ Preload Vyrox chargé');