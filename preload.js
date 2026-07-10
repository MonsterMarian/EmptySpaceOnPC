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
  onScanResult: (callback) => ipcRenderer.on('scan:result', (_event, value) => callback(value)),
  onDuplicateResult: (callback) => ipcRenderer.on('scan:duplicateResult', (_event, value) => callback(value)),
  onJunkResult: (callback) => ipcRenderer.on('scan:junkResult', (_event, value) => callback(value)),
  onScanComplete: (callback) => ipcRenderer.on('scan:complete', () => callback()),
  onScanProgress: (callback) => ipcRenderer.on('scan:progress', (_event, value) => callback(value)),
  askAI: (data) => ipcRenderer.invoke('ai:ask', data)
});
