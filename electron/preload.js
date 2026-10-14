/**
 * ═══════════════════════════════════════════════════════════
 * VYROX AI — PRELOAD SCRIPT
 * Pont sécurisé entre Electron et le renderer
 * Orinstudio © 2026-2029
 * ═══════════════════════════════════════════════════════════
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vyroxElectron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  
  onNewConversation: (callback) => ipcRenderer.on('new-conversation', callback),
  onShowStats: (callback) => ipcRenderer.on('show-stats', callback),
  onOpenPreferences: (callback) => ipcRenderer.on('open-preferences', callback),
  onExportConversation: (callback) => ipcRenderer.on('export-conversation', (event, filePath) => callback(filePath)),
  
  notify: (title, body) => {
    new Notification(title, { body });
  },
  
  isElectron: true,
  platform: process.platform
});

console.log('✅ Preload Vyrox chargé');