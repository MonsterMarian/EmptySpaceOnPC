import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class JunkCleaner {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isScanning = false;
  }

  stop() {
    this.isScanning = false;
  }

  async start() {
    if (this.isScanning) return;
    this.isScanning = true;
    
    const homeDir = os.homedir();
    const junkPaths = [
      { type: 'Windows Temp', path: path.join(process.env.windir || 'C:\\Windows', 'Temp') },
      { type: 'Local Temp', path: path.join(os.tmpdir()) },
      { type: 'Chrome Cache', path: path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache', 'Cache_Data') },
      { type: 'Edge Cache', path: path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache', 'Cache_Data') },
      { type: 'NPM Cache', path: path.join(homeDir, 'AppData', 'Local', 'npm-cache') }
    ];

    const calculateDirectoryTotalSize = async (dirPath) => {
      let totalSize = 0;
      let statPromises = [];
      const STAT_CONCURRENCY = 20;

      const processEntry = async (fullPath, isDir) => {
        try {
          if (isDir) {
            totalSize += await calculateDirectoryTotalSize(fullPath);
          } else {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          }
        } catch (err) {
          // It's normal to get EPERM on temp files in use
        }
      };

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (!this.isScanning) return totalSize;
          const fullPath = path.join(dirPath, entry.name);
          
          const p = processEntry(fullPath, entry.isDirectory()).finally(() => {
             statPromises = statPromises.filter(prom => prom !== p);
          });
          statPromises.push(p);

          if (statPromises.length >= STAT_CONCURRENCY) {
            await Promise.race(statPromises);
          }
        }
        await Promise.all(statPromises);
      } catch (err) {
        console.error(`Error reading directory for junk ${dirPath}:`, err.message);
      }
      return totalSize;
    };

    try {
      let junkBatch = [];
      for (const target of junkPaths) {
        if (!this.isScanning) break;
        const size = await calculateDirectoryTotalSize(target.path);
        if (size > 0) {
          junkBatch.push({ type: target.type, path: target.path, size });
        }
      }
      
      if (junkBatch.length > 0 && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('scan:junkBatch', junkBatch);
      }
    } finally {
      this.isScanning = false;
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('scan:complete');
      }
    }
  }
}
