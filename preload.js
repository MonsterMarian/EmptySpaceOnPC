const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  openFolder: (path) => ipcRenderer.invoke('shell:openFolder', path),
  startScan: (options) => ipcRenderer.invoke('scan:start', options),
  stopScan: () => ipcRenderer.invoke('scan:stop'),
  onScanResult: (callback) => ipcRenderer.on('scan:result', (_event, value) => callback(value)),
  onScanComplete: (callback) => ipcRenderer.on('scan:complete', () => callback())
});
