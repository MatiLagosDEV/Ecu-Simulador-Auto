/**
 * Servicio de Actualizaciones
 * Verifica y gestiona actualizaciones de la aplicación
 */

// La URL puede venir inyectada por Vite o por Electron.
const getWindowUpdateUrl = () => {
  try {
    if (typeof window === 'undefined') return null;
    if (window.__UPDATE_URL__) return window.__UPDATE_URL__;
    if (window.electron && window.electron.updateUrl) return window.electron.updateUrl;
    return null;
  } catch {
    return null;
  }
};

const VERSION_URL = import.meta.env.VITE_VERSION_URL || getWindowUpdateUrl();

export const updateService = {
  /**
   * Obtiene la versión actual de la app
   */
  getCurrentVersion() {
    // En desarrollo, leer de package.json importado
    // En producción, Electron lo proporciona
    try {
      return window.__APP_VERSION__ || "1.0.0";
    } catch {
      return "1.0.0";
    }
  },

  /**
   * Obtiene información de actualización desde GitHub
   */
  async checkForUpdates() {
    try {
      if (!VERSION_URL) {
        return {
          success: false,
          message: 'No se configuró la URL de actualizaciones'
        };
      }

      const response = await fetch(VERSION_URL, {
        cache: "no-store" // Asegurar que siempre obtiene la versión más reciente
      });

      if (!response.ok) {
        return {
          success: false,
          message: `No se pudo conectar con el servidor de actualizaciones (HTTP ${response.status})`
        };
      }

      const updateData = await response.json();
      const currentVersion = this.getCurrentVersion();
      const latestVersion = updateData.version;

      // Comparar versiones
      const hasUpdate = this.compareVersions(currentVersion, latestVersion);

      return {
        success: true,
        hasUpdate,
        currentVersion,
        latestVersion,
        ...updateData
      };
    } catch (error) {
      console.error("Error al verificar actualizaciones:", error);
      return {
        success: false,
        message: "Error al verificar actualizaciones: " + error.message
      };
    }
  },

  /**
   * Compara dos versiones (ej: 1.2.3 vs 1.2.4)
   * Retorna true si latestVersion > currentVersion
   */
  compareVersions(current, latest) {
    try {
      const currentParts = current.split(".").map(Number);
      const latestParts = latest.split(".").map(Number);

      for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const curr = currentParts[i] || 0;
        const lat = latestParts[i] || 0;

        if (lat > curr) return true;
        if (lat < curr) return false;
      }

      return false; // Son iguales
    } catch {
      return false;
    }
  },

  /**
   * Descarga la actualización (abre el enlace)
   * En Electron, esto se maneja con electron-updater
   */
  downloadUpdate(releaseUrl) {
    if (!releaseUrl) {
      console.error("URL de descarga no disponible");
      return false;
    }

    // En desarrollo: abrir navegador
    if (typeof window !== "undefined" && !window.__ELECTRON__) {
      window.open(releaseUrl, "_blank");
      return true;
    }

    // En Electron: usar IPC para comunicar con main process
    if (window.__ELECTRON__) {
      const { ipcRenderer } = window.require("electron");
      ipcRenderer.send("download-update", releaseUrl);
      return true;
    }

    return false;
  }
};
