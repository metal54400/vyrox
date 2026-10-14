/**
 * ═══════════════════════════════════════════════════════════
 * VYROX AI — ELECTRON MAIN PROCESS
 * Application Desktop par Orinstudio © 2026-2029
 * ═══════════════════════════════════════════════════════════
 */

const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let tray = null;
let serverProcess = null;
const SERVER_PORT = 3000;

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    
    serverProcess = spawn(process.execPath, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PORT: SERVER_PORT }
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[Server] ${data.toString()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString()}`);
    });

    const checkServer = setInterval(() => {
      http.get(`http://localhost:${SERVER_PORT}`, (res) => {
        clearInterval(checkServer);
        resolve();
      }).on('error', () => {});
    }, 500);

    setTimeout(() => {
      clearInterval(checkServer);
      resolve();
    }, 10000);

    serverProcess.on('error', (err) => {
      console.error('Erreur serveur:', err);
      reject(err);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Vyrox AI — Orinstudio',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0a0a1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true
  });

  const appUrl = `http://localhost:${SERVER_PORT}`;
  mainWindow.loadURL(appUrl);

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

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
          click: () => mainWindow.webContents.send('new-conversation')
        },
        { 
          label: 'Exporter la conversation',
          accelerator: 'CmdOrCtrl+E',
          click: () => exportConversation()
        },
        { type: 'separator' },
        { 
          label: 'Statistiques',
          click: () => mainWindow.webContents.send('show-stats')
        }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        { label: 'Version 1.0.0', enabled: false },
        { label: '© 2026-2029 Orinstudio', enabled: false }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ouvrir Vyrox', click: () => mainWindow.show() },
    { label: 'Nouvelle conversation', click: () => mainWindow.webContents.send('new-conversation') },
    { type: 'separator' },
    { label: 'Statistiques', click: () => mainWindow.webContents.send('show-stats') },
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

async function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'À propos de Vyrox AI',
    message: 'Vyrox AI v1.0.0',
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
    mainWindow.webContents.send('export-conversation', filePath);
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
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(async () => {
  console.log('🚀 Démarrage de Vyrox AI Desktop...');
  
  try {
    await startServer();
    console.log('✅ Serveur Vyrox démarré');
  } catch (err) {
    console.error('⚠️ Erreur serveur:', err);
  }

  createWindow();
  createMenu();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess) serverProcess.kill();
});

process.on('uncaughtException', (err) => {
  console.error('💥 Erreur non gérée:', err);
});