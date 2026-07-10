import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import os from 'os';

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

ipcMain.handle('shell:openFile', async (event, filePath) => {
  shell.openPath(filePath);
});

ipcMain.handle('file:trash', async (event, filePaths) => {
  const results = [];
  for (const p of filePaths) {
    try {
      await shell.trashItem(p);
      results.push({ path: p, success: true });
    } catch (e) {
      results.push({ path: p, success: false, error: e.message });
    }
  }
  return results;
});

// Scanner state
let isScanning = false;

ipcMain.handle('scan:start', async (event, { folderPath, minSizeMB, minDaysUnused }) => {
  if (isScanning) return;
  isScanning = true;

  const minSizeBytes = minSizeMB * 1024 * 1024;
  const now = Date.now();
  const minDaysMs = minDaysUnused * 24 * 60 * 60 * 1000;
  
  let filesScanned = 0;

  async function scanDirectory(dir) {
    if (!isScanning) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!isScanning) return;
        filesScanned++;
        if (filesScanned % 1000 === 0) {
          mainWindow.webContents.send('scan:progress', { scanned: filesScanned });
        }
        
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

// Duplicates Scanner
ipcMain.handle('scan:duplicates', async (event, folderPath) => {
  if (isScanning) return;
  isScanning = true;
  let filesScanned = 0;
  const sizeMap = new Map();

  async function groupFilesByByteSize(dir) {
    if (!isScanning) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!isScanning) return;
        filesScanned++;
        if (filesScanned % 1000 === 0) {
          mainWindow.webContents.send('scan:progress', { scanned: filesScanned });
        }
        
        const fullPath = path.join(dir, entry.name);
        try {
          if (entry.isDirectory()) {
            await groupFilesByByteSize(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            if (stats.size > 0) {
              if (!sizeMap.has(stats.size)) {
                sizeMap.set(stats.size, []);
              }
              sizeMap.get(stats.size).push({ path: fullPath, size: stats.size, name: entry.name });
            }
          }
        } catch (err) {}
      }
    } catch (err) {}
  }

  try {
    await groupFilesByByteSize(folderPath);
    
    // Only keep sizes with > 1 file
    const potentialDuplicates = Array.from(sizeMap.values()).filter(group => group.length > 1);
    
    // Hash them to confirm
    for (const group of potentialDuplicates) {
      if (!isScanning) break;
      const hashMap = new Map();
      for (const file of group) {
        if (!isScanning) break;
        try {
          const hash = await calculateSha256Hash(file.path);
          if (!hashMap.has(hash)) hashMap.set(hash, []);
          hashMap.get(hash).push(file);
        } catch (e) {}
      }
      
      // Send actual duplicates to frontend
      for (const [hash, identicalFiles] of hashMap.entries()) {
        if (identicalFiles.length > 1) {
          mainWindow.webContents.send('scan:duplicateResult', { hash, files: identicalFiles });
        }
      }
    }
  } finally {
    isScanning = false;
    mainWindow.webContents.send('scan:complete');
  }
});

function calculateSha256Hash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

// Junk Scanner
ipcMain.handle('scan:junk', async () => {
  if (isScanning) return;
  isScanning = true;
  
  const homeDir = os.homedir();
  const junkPaths = [
    { type: 'Windows Temp', path: path.join(process.env.windir || 'C:\\Windows', 'Temp') },
    { type: 'Local Temp', path: path.join(os.tmpdir()) },
    { type: 'Chrome Cache', path: path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache', 'Cache_Data') },
    { type: 'Edge Cache', path: path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache', 'Cache_Data') },
    { type: 'NPM Cache', path: path.join(homeDir, 'AppData', 'Local', 'npm-cache') }
  ];

  async function calculateDirectoryTotalSize(dirPath) {
    let totalSize = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!isScanning) return totalSize;
        const fullPath = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            totalSize += await calculateDirectoryTotalSize(fullPath);
          } else {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          }
        } catch (err) {}
      }
    } catch (err) {}
    return totalSize;
  }

  try {
    for (const target of junkPaths) {
      if (!isScanning) break;
      const size = await calculateDirectoryTotalSize(target.path);
      if (size > 0) {
        mainWindow.webContents.send('scan:junkResult', { type: target.type, path: target.path, size });
      }
    }
  } finally {
    isScanning = false;
    mainWindow.webContents.send('scan:complete');
  }
});

