/**
 * ═══════════════════════════════════════════════════════════
 * VYROX AI — ELECTRON MAIN PROCESS
 * Application Desktop par Orinstudio © 2026-2029
 * ═══════════════════════════════════════════════════════════
 */

const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
const APP_URL = 'https://vyrox.deepstone.fr';

// ═══════════════════════════════════════════════════════════
// CRÉATION DE LA FENÊTRE
// ═══════════════════════════════════════════════════════════

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Vyrox AI — Orinstudio',
    icon: path.join(__dirname, '/icon.png'),
    backgroundColor: '#0a0a1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Nécessaire pour les iframes/API externes parfois
      webSecurity: true
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true
  });

  // Charger l'URL distante au lieu du localhost
  mainWindow.loadURL(APP_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      if (tray) {
        tray.displayBalloon({
          title: 'Vyrox AI',
          content: 'Vyrox continue de fonctionner en arrière-plan.'
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Sécurité : Ouvrir les liens externes dans le navigateur par défaut
  // Empêche l'app de naviguer hors de vyrox.deepstone.fr ou d'ouvrir des fenêtres natives
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Navigation interne : Bloquer la navigation vers d'autres domaines dans la même fenêtre
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== new URL(APP_URL).origin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// ══════════════════════════════════════════════════════════
// MENU APPLICATION
// ═══════════════════════════════════════════════════════════

function createMenu() {
  const template = [
    {
      label: 'Vyrox',
      submenu: [
        { label: 'À propos de Vyrox', click: () => showAbout() },
        { type: 'separator' },
        { 
          label: 'Quitter', 
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Outils',
      submenu: [
        { 
          label: 'Nouvelle conversation',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('new-conversation')
        },
        { 
          label: 'Exporter la conversation',
          accelerator: 'CmdOrCtrl+E',
          click: () => exportConversation()
        },
        { type: 'separator' },
        { 
          label: 'Statistiques',
          click: () => mainWindow?.webContents.send('show-stats')
        }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        { label: 'Version 5.0.0', enabled: false },
        { label: '© 2026-2029 Orinstudio', enabled: false }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ═══════════════════════════════════════════════════════════
// SYSTÈME TRAY (BARRE DES TÂCHES)
// ═══════════════════════════════════════════════════════════

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ouvrir Vyrox', click: () => mainWindow?.show() },
    { label: 'Nouvelle conversation', click: () => mainWindow?.webContents.send('new-conversation') },
    { type: 'separator' },
    { label: 'Statistiques', click: () => mainWindow?.webContents.send('show-stats') },
    { type: 'separator' },
    { 
      label: 'Quitter', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Vyrox AI — Orinstudio');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow) mainWindow.show();
  });
}

// ═══════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES & IPC
// ═══════════════════════════════════════════════════════════

async function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'À propos de Vyrox AI',
    message: 'Vyrox AI v5.0.0',
    detail: 'Intelligence Artificielle 100% faite maison\nDéveloppée par Orinstudio\n\n© 2026-2029 Orinstudio\nTous droits réservés.',
    buttons: ['OK']
  });
}

async function exportConversation() {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter la conversation',
    defaultPath: `vyrox-conversation-${Date.now()}.json`,
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'Texte', extensions: ['txt'] }
    ]
  });

  if (filePath) {
    mainWindow?.webContents.send('export-conversation', filePath);
  }
}

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-platform', () => ({
  platform: process.platform,
  arch: process.arch,
  node: process.versions.node,
  electron: process.versions.electron
}));

ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});

ipcMain.on('close-window', () => {
  mainWindow?.close();
});

// ═══════════════════════════════════════════════════════════
// CYCLE DE VIE APPLICATION
// ═══════════════════════════════════════════════════════════

app.whenReady().then(() => {
  console.log(`🚀 Démarrage de Vyrox AI Desktop (${APP_URL})...`);
  
  createWindow();
  createMenu();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

process.on('uncaughtException', (err) => {
  console.error('💥 Erreur non gérée:', err);
});