import { useState, useEffect, useCallback } from "react";
import licenseService from "./licenseService";

/**
 * Hook para gestionar el estado de licencia de la app
 * 
 * Estados posibles:
 * - LOADING: Validando licencia
 * - FREE: Usuario sin PRO
 * - PRO: Usuario con PRO activo
 * - INVALID: Licencia inválida o error
 * - NO_LICENSE: Sin licencia ingresada aún
 * 
 * Uso:
 * const { status, isPro, deviceId, activateLicense, transferLicense, validateLicense } = useLicense();
 */
export function useLicense() {
  const [status, setStatus] = useState("LOADING");  // LOADING | FREE | PRO | INVALID | NO_LICENSE
  const [isPro, setIsPro] = useState(false);
  const [licenseKey, setLicenseKey] = useState(localStorage.getItem("license_key") || null);
  const [deviceId, setDeviceId] = useState(localStorage.getItem("device_id") || generateDeviceId());
  const [lastValidated, setLastValidated] = useState(localStorage.getItem("last_validated") || null);
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  // Generar device_id único si no existe
  function generateDeviceId() {
    const stored = localStorage.getItem("device_id");
    if (stored) return stored;

    const newId = `DEVICE_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    localStorage.setItem("device_id", newId);
    return newId;
  }

  // Validar licencia (llamada periódicamente)
  const validateLicense = useCallback(async () => {
    if (!licenseKey) {
      setStatus("NO_LICENSE");
      setIsPro(false);
      return;
    }

    setIsValidating(true);
    try {
      const result = await licenseService.validate(licenseKey, deviceId);

      if (result.valid) {
        setStatus(result.is_pro ? "PRO" : "FREE");
        setIsPro(result.is_pro);
        setError(null);
        setLastValidated(new Date().toISOString());
        localStorage.setItem("last_validated", new Date().toISOString());
      } else {
        setStatus("FREE");
        setIsPro(false);
        setError(result.message || "Licencia inválida");
      }
    } catch (err) {
      console.error("Error validando licencia:", err);
      setStatus("INVALID");
      setIsPro(false);
      setError("Error al validar licencia");
    } finally {
      setIsValidating(false);
    }
  }, [licenseKey, deviceId]);

  // Activar licencia
  const activateLicense = useCallback(async (key) => {
    if (!licenseService.isValidFormat(key)) {
      setError("Clave de licencia inválida");
      return false;
    }

    setIsValidating(true);
    try {
      const result = await licenseService.activate(key, deviceId);

      if (result.success) {
        setLicenseKey(key);
        localStorage.setItem("license_key", key);
        // Validar inmediatamente después
        await validateLicense();
        return true;
      } else {
        setError(result.message);
        if (result.requires_transfer) {
          setStatus("FREE"); // Requiere transferencia
        }
        return false;
      }
    } catch (err) {
      console.error("Error activando licencia:", err);
      setError("Error al activar licencia");
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [deviceId, validateLicense]);

  // Transferir licencia a otro device
  const transferLicense = useCallback(async (newDeviceId, reason = "cambio_pc") => {
    if (!licenseKey) {
      setError("No hay licencia para transferir");
      return false;
    }

    setIsValidating(true);
    try {
      const result = await licenseService.transfer(licenseKey, newDeviceId, reason);

      if (result.success) {
        setDeviceId(newDeviceId);
        localStorage.setItem("device_id", newDeviceId);
        // Validar después de transferencia
        await validateLicense();
        return true;
      } else {
        setError(result.message);
        return false;
      }
    } catch (err) {
      console.error("Error transfiriendo licencia:", err);
      setError("Error al transferir licencia");
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [licenseKey, validateLicense]);

  // Remover licencia (usuario elige desactivar)
  const removeLicense = useCallback(() => {
    setLicenseKey(null);
    setStatus("NO_LICENSE");
    setIsPro(false);
    localStorage.removeItem("license_key");
    localStorage.removeItem("last_validated");
  }, []);

  // Validar al iniciar y cada 24 horas
  useEffect(() => {
    validateLicense();

    // Validar cada 24 horas
    const interval = setInterval(() => {
      validateLicense();
    }, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [validateLicense]);

  return {
    // Estados
    status,            // LOADING | FREE | PRO | INVALID | NO_LICENSE
    isPro,             // true si es PRO
    licenseKey,        // Clave actual
    deviceId,          // Device ID único
    lastValidated,     // Timestamp última validación
    error,             // Mensaje de error si hay
    isValidating,      // true si está validando

    // Funciones
    activateLicense,   // (key) => Promise<boolean>
    transferLicense,   // (newDeviceId, reason?) => Promise<boolean>
    validateLicense,   // () => Promise<void>
    removeLicense      // () => void
  };
}

export default useLicense;
