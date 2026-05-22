/**
 * Servicio de Licencias - OBD2 App
 * Gestiona comunicación con backend de licencias
 * 
 * Estados:
 * - FREE: Licencia no válida o no activada
 * - PRO: Licencia válida y es_pro=true
 * - INVALID: Error en validación
 * - LOADING: Validando...
 */

// Detectamos si la app corre desde archivos locales (Electron .exe) o desde la web (Vite dev)
const isDevFrontend = window.location.protocol === 'http:' || window.location.protocol === 'https:';
const API_BASE = isDevFrontend 
  ? (import.meta.env.VITE_LICENSE_API_URL || "http://localhost:8000")
  : 'http://127.0.0.1:8000'; // Backend de licencias en producción


export const licenseService = {
  /**
   * Activa una licencia en este dispositivo
   * @param {string} licenseKey - Clave de 32 caracteres
   * @param {string} deviceId - ID único del dispositivo
   * @returns {Promise<{success: boolean, message: string, requires_transfer: boolean}>}
   */
  async activate(licenseKey, deviceId) {
    try {
      const response = await fetch(`${API_BASE}/license/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: deviceId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al activar licencia");
      }

      return await response.json();
    } catch (error) {
      console.error("Error en activate:", error);
      return {
        success: false,
        message: error.message || "Error de conexión"
      };
    }
  },

  /**
   * Valida si una licencia es válida para este dispositivo
   * @param {string} licenseKey - Clave de licencia
   * @param {string} deviceId - ID del dispositivo
   * @returns {Promise<{valid: boolean, is_pro: boolean, message?: string}>}
   */
  async validate(licenseKey, deviceId) {
    try {
      const response = await fetch(`${API_BASE}/license/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: deviceId
        })
      });

      if (!response.ok) {
        throw new Error("Error al validar licencia");
      }

      return await response.json();
    } catch (error) {
      console.error("Error en validate:", error);
      return {
        valid: false,
        is_pro: false,
        message: error.message
      };
    }
  },

  /**
   * Transfiere una licencia a otro dispositivo
   * @param {string} licenseKey - Clave de licencia
   * @param {string} newDeviceId - Nuevo ID de dispositivo
   * @param {string} reason - Razón de transferencia (opcional)
   * @returns {Promise<{success: boolean, message: string, device_id_anterior?: string, device_id_nuevo?: string}>}
   */
  async transfer(licenseKey, newDeviceId, reason = "cambio_pc") {
    try {
      const response = await fetch(`${API_BASE}/license/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id_nuevo: newDeviceId,
          razon: reason
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al transferir licencia");
      }

      return await response.json();
    } catch (error) {
      console.error("Error en transfer:", error);
      return {
        success: false,
        message: error.message || "Error de conexión"
      };
    }
  },

  /**
   * Obtiene información de una licencia
   * @param {string} licenseKey - Clave de licencia
   * @returns {Promise<{license_key: string, is_pro: boolean, device_id_actual?: string, ...}>}
   */
  async getInfo(licenseKey) {
    try {
      const response = await fetch(`${API_BASE}/license/info/${licenseKey}`);

      if (!response.ok) {
        throw new Error("Licencia no encontrada");
      }

      return await response.json();
    } catch (error) {
      console.error("Error en getInfo:", error);
      return null;
    }
  },

  /**
   * Valida que una clave tenga el formato correcto
   * @param {string} licenseKey - Clave a validar
   * @returns {boolean}
   */
  isValidFormat(licenseKey) {
    // Formato: XXXXXX-XXXXXX-XXXXXX-XXXXXX (27 caracteres)
    // Caracteres: A-Z, 0-9
    return /^[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$/.test(licenseKey.toUpperCase());
  },

  /**
   * Health check del servidor de licencias
   * @returns {Promise<boolean>}
   */
  async isServerOnline() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
};

export default licenseService;
