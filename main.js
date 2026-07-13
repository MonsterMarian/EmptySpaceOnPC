import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import os from 'os';
import { Scanner } from './backend/scanner.js';
import { DuplicateFinder } from './backend/duplicateFinder.js';
import { JunkCleaner } from './backend/junkCleaner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// Extracted modules
let scanner;
let duplicateFinder;
let junkCleaner;

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

  scanner = new Scanner(mainWindow);
  duplicateFinder = new DuplicateFinder(mainWindow);
  junkCleaner = new JunkCleaner(mainWindow);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
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

// Security: Simple path validation
const isValidPath = (p) => p && typeof p === 'string' && path.isAbsolute(p);

ipcMain.handle('shell:openFolder', async (event, folderPath) => {
  if (isValidPath(folderPath)) {
    shell.showItemInFolder(folderPath);
  }
});

ipcMain.handle('shell:openFile', async (event, filePath) => {
  if (isValidPath(filePath)) {
    shell.openPath(filePath);
  }
});

ipcMain.handle('file:trash', async (event, filePaths) => {
  const results = [];
  for (const p of filePaths) {
    if (!isValidPath(p)) {
      results.push({ path: p, success: false, error: 'Invalid path' });
      continue;
    }
    try {
      await shell.trashItem(p);
      results.push({ path: p, success: true });
    } catch (e) {
      console.error(`Error trashing ${p}:`, e.message);
      results.push({ path: p, success: false, error: e.message });
    }
  }
  return results;
});

// Scanner Handlers
ipcMain.handle('scan:start', async (event, options) => {
  duplicateFinder?.stop();
  junkCleaner?.stop();
  await scanner.start(options);
});

ipcMain.handle('scan:stop', () => {
  scanner?.stop();
  duplicateFinder?.stop();
  junkCleaner?.stop();
});

ipcMain.handle('scan:duplicates', async (event, folderPath) => {
  scanner?.stop();
  junkCleaner?.stop();
  await duplicateFinder.start(folderPath);
});

ipcMain.handle('scan:junk', async () => {
  scanner?.stop();
  duplicateFinder?.stop();
  await junkCleaner.start();
});

// File Metadata Reader (for AI context)
ipcMain.handle('file:getMetadata', async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const textExtensions = ['.txt', '.log', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.js', '.ts', '.py', '.bat', '.sh', '.ini', '.cfg', '.conf', '.yaml', '.yml'];
    
    let preview = null;
    if (textExtensions.includes(ext) && stats.size < 5 * 1024 * 1024) {
      try {
        const buffer = Buffer.alloc(Math.min(stats.size, 500));
        const fileHandle = await fs.open(filePath, 'r');
        await fileHandle.read(buffer, 0, buffer.length, 0);
        await fileHandle.close();
        preview = buffer.toString('utf8').replace(/\0/g, '');
      } catch (e) {
        preview = null;
      }
    }
    
    return {
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      accessed: stats.atime.toISOString(),
      extension: ext,
      isDirectory: stats.isDirectory(),
      preview
    };
  } catch (err) {
    return { error: err.message };
  }
});

// AI Assistant
ipcMain.handle('ai:ask', async (event, { apiKey, messages }) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': 'https://github.com/MonsterMarian/EmptySpaceOnPC',
        'X-Title': 'SpaceFinder Premium'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: messages,
        temperature: 0.2,
        top_p: 0.7
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (err) {
    return { error: err.message };
  }
});

