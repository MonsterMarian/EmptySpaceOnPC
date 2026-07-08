import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // In development, load from Vite dev server. In production, load the built index.html.
  // For simplicity, we'll try to load the vite server, if not fallback.
  // We'll pass the URL as an environment variable or just use localhost:5173
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // We assume Vite runs on 5173
    mainWindow.loadURL('http://localhost:5173').catch(() => {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('dialog:selectFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('shell:openFolder', async (event, folderPath) => {
  shell.showItemInFolder(folderPath);
});

// Scanner state
let isScanning = false;

ipcMain.handle('scan:start', async (event, { folderPath, minSizeMB, minDaysUnused }) => {
  if (isScanning) return;
  isScanning = true;

  const minSizeBytes = minSizeMB * 1024 * 1024;
  const now = Date.now();
  const minDaysMs = minDaysUnused * 24 * 60 * 60 * 1000;

  async function scanDirectory(dir) {
    if (!isScanning) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!isScanning) return;
        const fullPath = path.join(dir, entry.name);
        try {
          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            const size = stats.size;
            if (size >= minSizeBytes) {
              const lastUsedMs = Math.max(stats.atimeMs, stats.mtimeMs);
              const daysUnused = (now - lastUsedMs) / (1000 * 60 * 60 * 24);
              
              if (daysUnused >= minDaysUnused) {
                // Send result to frontend
                mainWindow.webContents.send('scan:result', {
                  name: entry.name,
                  path: fullPath,
                  size: size,
                  lastUsedMs: lastUsedMs,
                  daysUnused: daysUnused
                });
              }
            }
          }
        } catch (err) {
          // Ignore EPERM and other access errors
        }
      }
    } catch (err) {
      // Ignore EPERM and other access errors for directory reading
    }
  }

  try {
    await scanDirectory(folderPath);
  } finally {
    isScanning = false;
    mainWindow.webContents.send('scan:complete');
  }
});

ipcMain.handle('scan:stop', () => {
  isScanning = false;
});
