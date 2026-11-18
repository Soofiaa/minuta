const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let floatingWindow = null;

const recordingsDir = path.join(app.getPath('userData'), 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (floatingWindow) floatingWindow.close();
  });
}

function createFloatingWindow() {
  if (floatingWindow) return;

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  floatingWindow = new BrowserWindow({
    width: 280,
    height: 70,
    x: Math.round((screenWidth - 280) / 2),
    y: 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    floatingWindow.loadURL('http://localhost:3000/#/floating');
  } else {
    floatingWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'floating' });
  }

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
}

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], fetchWindowIcons: false });
  return sources.map(src => ({
    id: src.id,
    name: src.name,
    thumbnail: src.thumbnail ? src.thumbnail.toDataURL() : null
  }));
});

ipcMain.handle('save-recording', async (event, { arrayBuffer, metadata }) => {
  const timestamp = Date.now();
  const filenameBase = `minuta-${timestamp}`;
  const videoPath = path.join(recordingsDir, `${filenameBase}.webm`);
  const metaPath = path.join(recordingsDir, `${filenameBase}.json`);

  fs.writeFileSync(videoPath, Buffer.from(arrayBuffer));
  const fullMetadata = {
    id: filenameBase,
    createdAt: new Date().toISOString(),
    ...metadata,
    videoPath
  };
  fs.writeFileSync(metaPath, JSON.stringify(fullMetadata, null, 2));
  return fullMetadata;
});

ipcMain.handle('get-recordings', async () => {
  if (!fs.existsSync(recordingsDir)) return [];
  const files = fs.readdirSync(recordingsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const recordings = jsonFiles.map(f => {
    try {
      const content = fs.readFileSync(path.join(recordingsDir, f), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }).filter(Boolean);

  return recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

ipcMain.handle('get-recording-file', async (event, videoPath) => {
  if (fs.existsSync(videoPath)) {
    return fs.readFileSync(videoPath);
  }
  throw new Error('Archivo de grabación no encontrado.');
});

ipcMain.handle('start-floating', () => {
  createFloatingWindow();
});

ipcMain.handle('stop-floating', () => {
  if (floatingWindow) {
    floatingWindow.close();
    floatingWindow = null;
  }
});

// Broadcast recording status to floating window
ipcMain.on('recording-status', (event, status) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('recording-status', status);
  }
});

// Allow floating window to trigger pause/resume/stop in main window or send actions back
ipcMain.on('control-action', (event, action) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('control-action', action);
  }
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
