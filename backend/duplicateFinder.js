import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

export class DuplicateFinder {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isScanning = false;
    this.filesScanned = 0;
    this.sizeMap = new Map();
    this.CONCURRENCY_LIMIT = 5; // Hashing is CPU/IO heavy, lower limit
  }

  stop() {
    this.isScanning = false;
  }

  calculateSha256Hash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fsSync.createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', err => reject(err));
    });
  }

  async start(folderPath) {
    if (this.isScanning) return;
    this.isScanning = true;
    this.filesScanned = 0;
    this.sizeMap.clear();

    let statPromises = [];
    const STAT_CONCURRENCY = 20;

    const groupFileBySize = async (fullPath, entryName) => {
      try {
        const stats = await fs.stat(fullPath);
        // Only look for duplicates larger than 10MB
        if (stats.size > 10 * 1024 * 1024) {
          if (!this.sizeMap.has(stats.size)) {
            this.sizeMap.set(stats.size, []);
          }
          this.sizeMap.get(stats.size).push({ path: fullPath, size: stats.size, name: entryName });
        }
      } catch (err) {
        console.error(`Error statting file for dupes ${fullPath}:`, err.message);
      }
    };

    const groupFiles = async (dir) => {
      if (!this.isScanning) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!this.isScanning) return;
          this.filesScanned++;
          
          if (this.filesScanned % 1000 === 0) {
            if (!this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('scan:progress', { scanned: this.filesScanned });
            }
          }
          
          const fullPath = path.join(dir, entry.name);
          try {
            if (entry.isDirectory()) {
              await groupFiles(fullPath);
            } else if (entry.isFile()) {
              const p = groupFileBySize(fullPath, entry.name).finally(() => {
                statPromises = statPromises.filter(prom => prom !== p);
              });
              statPromises.push(p);

              if (statPromises.length >= STAT_CONCURRENCY) {
                await Promise.race(statPromises);
              }
            }
          } catch (err) {
            console.error(`Error processing entry in dupes ${fullPath}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`Error reading directory for dupes ${dir}:`, err.message);
      }
    };

    try {
      await groupFiles(folderPath);
      await Promise.all(statPromises);
      
      // Only keep sizes with > 1 file
      const potentialDuplicates = Array.from(this.sizeMap.values()).filter(group => group.length > 1);
      
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('scan:progress', { scanned: `Found ${potentialDuplicates.length} potential duplicate groups. Analyzing content...` });
      }
      
      let groupsProcessed = 0;
      let duplicateBatch = [];
      
      const flushDuplicateBatch = () => {
        if (duplicateBatch.length > 0 && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('scan:duplicateBatch', duplicateBatch);
          duplicateBatch = [];
        }
      };

      for (const group of potentialDuplicates) {
        if (!this.isScanning) break;
        groupsProcessed++;
        
        if (groupsProcessed % 10 === 0 && !this.mainWindow.isDestroyed()) {
           this.mainWindow.webContents.send('scan:progress', { scanned: `Hashing group ${groupsProcessed} of ${potentialDuplicates.length}...` });
        }
        
        const hashMap = new Map();
        let hashPromises = [];

        // Concurrently hash files within the group (up to CONCURRENCY_LIMIT)
        for (const file of group) {
           if (!this.isScanning) break;
           const p = (async () => {
             try {
                const hash = await this.calculateSha256Hash(file.path);
                if (!hashMap.has(hash)) hashMap.set(hash, []);
                hashMap.get(hash).push(file);
             } catch (e) {
                console.error(`Error hashing ${file.path}:`, e.message);
             }
           })().finally(() => {
             hashPromises = hashPromises.filter(prom => prom !== p);
           });
           
           hashPromises.push(p);
           if (hashPromises.length >= this.CONCURRENCY_LIMIT) {
             await Promise.race(hashPromises);
           }
        }
        await Promise.all(hashPromises);
        
        // Push actual duplicates to batch
        for (const [hash, identicalFiles] of hashMap.entries()) {
          if (identicalFiles.length > 1) {
            duplicateBatch.push({ hash, files: identicalFiles });
          }
        }
        
        if (duplicateBatch.length >= 5) {
          flushDuplicateBatch();
        }
      }
      
      flushDuplicateBatch();

    } finally {
      this.isScanning = false;
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('scan:complete');
      }
    }
  }
}
