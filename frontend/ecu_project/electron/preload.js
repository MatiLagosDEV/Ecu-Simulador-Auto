const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
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
});
