import fs from 'fs/promises';
import path from 'path';

export class Scanner {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isScanning = false;
    this.filesScanned = 0;
    this.batch = [];
    this.BATCH_SIZE = 50;
    this.CONCURRENCY_LIMIT = 20; // Number of concurrent stats
  }

  stop() {
    this.isScanning = false;
  }

  async flushBatch() {
    if (this.batch.length > 0) {
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('scan:resultsBatch', this.batch);
      }
      this.batch = [];
    }
  }

  async start({ folderPath, minSizeMB, minDaysUnused }) {
    if (this.isScanning) return;
    this.isScanning = true;
    this.filesScanned = 0;
    this.batch = [];

    const minSizeBytes = minSizeMB * 1024 * 1024;
    const now = Date.now();
    const minDaysMs = minDaysUnused * 24 * 60 * 60 * 1000;

    let runningPromises = [];

    const processFile = async (fullPath, entryName) => {
      try {
        const stats = await fs.stat(fullPath);
        const size = stats.size;
        if (size >= minSizeBytes) {
          const lastUsedMs = Math.max(stats.atimeMs, stats.mtimeMs);
          const daysUnused = (now - lastUsedMs) / (1000 * 60 * 60 * 24);
          
          if (daysUnused >= minDaysUnused) {
            this.batch.push({
              name: entryName,
              path: fullPath,
              size: size,
              lastUsedMs: lastUsedMs,
              daysUnused: daysUnused
            });

            if (this.batch.length >= this.BATCH_SIZE) {
              await this.flushBatch();
            }
          }
        }
      } catch (err) {
        console.error(`Error statting file ${fullPath}:`, err.message);
      }
    };

    const scanDirectory = async (dir) => {
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
              // Note: Recursing sequentially for directories prevents too many open file handles
              // but we could parallelize this too. Sequential traversal is usually fast enough 
              // for dir reading, the stat is the slow part.
              await scanDirectory(fullPath);
            } else if (entry.isFile()) {
              // Add to running promises for concurrency
              const p = processFile(fullPath, entry.name).finally(() => {
                runningPromises = runningPromises.filter(prom => prom !== p);
              });
              runningPromises.push(p);

              if (runningPromises.length >= this.CONCURRENCY_LIMIT) {
                await Promise.race(runningPromises);
              }
            }
          } catch (err) {
            console.error(`Error processing entry ${fullPath}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`Error reading directory ${dir}:`, err.message);
      }
    };

    try {
      await scanDirectory(folderPath);
      // Wait for any remaining file stats
      await Promise.all(runningPromises);
      await this.flushBatch();
    } finally {
      this.isScanning = false;
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('scan:complete');
      }
    }
  }
}
