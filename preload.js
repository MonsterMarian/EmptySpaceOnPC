const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  openFolder: (path) => ipcRenderer.invoke('shell:openFolder', path),
  startScan: (options) => ipcRenderer.invoke('scan:start', options),
  stopScan: () => ipcRenderer.invoke('scan:stop'),
  startDuplicateScan: (folderPath) => ipcRenderer.invoke('scan:duplicates', folderPath),
  startJunkScan: () => ipcRenderer.invoke('scan:junk'),
  trashFiles: (paths) => ipcRenderer.invoke('file:trash', paths),
  openFile: (path) => ipcRenderer.invoke('shell:openFile', path),
  onScanResultsBatch: (callback) => ipcRenderer.on('scan:resultsBatch', (_event, value) => callback(value)),
  onDuplicateBatch: (callback) => ipcRenderer.on('scan:duplicateBatch', (_event, value) => callback(value)),
  onJunkBatch: (callback) => ipcRenderer.on('scan:junkBatch', (_event, value) => callback(value)),
  onScanComplete: (callback) => ipcRenderer.on('scan:complete', () => callback()),
  onScanProgress: (callback) => ipcRenderer.on('scan:progress', (_event, value) => callback(value)),
  askAI: (data) => ipcRenderer.invoke('ai:ask', data),
  getFileMetadata: (filePath) => ipcRenderer.invoke('file:getMetadata', filePath)
});
