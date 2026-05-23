const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Exponer URL de actualizaciones desde variables de entorno
  updateUrl: process.env.VITE_VERSION_URL || process.env.REACT_APP_VERSION_URL || null,
  // Verificar actualizaciones
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // Instalar actualización
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  
  // Eventos de actualización
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', callback);
    return () => ipcRenderer.removeListener('update-available', callback);
  },
  
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', callback);
    return () => ipcRenderer.removeListener('update-downloaded', callback);
  },
  
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, message) => callback(message));
    return () => ipcRenderer.removeListener('update-error', callback);
  }
  ,
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, progress) => callback(progress));
    return () => ipcRenderer.removeListener('update-progress', callback);
  },
  // Solicitar descarga (main process) — en producción autoUpdater maneja la descarga
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  // Abrir URL externa (por ejemplo para descargar manualmente)
  openUpdateUrl: (url) => ipcRenderer.send('open-update-url', url)
});
