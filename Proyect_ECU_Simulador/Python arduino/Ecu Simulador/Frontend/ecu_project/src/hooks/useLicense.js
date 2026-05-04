import { useState, useEffect, useCallback } from "react";
import licenseService from "../services/licenseService";

/**
 * Hook para gestionar el estado de licencia de la app
 * 
 * SISTEMA ANTI-PIRATERÍA:
 * - Offline permitido: 7 días desde última validación
 * - Fingerprint del PC: detecta cambios de dispositivo
 * - Validación periódica: backend controla multi-uso
 * 
 * Estados posibles:
 * - LOADING: Validando licencia
 * - FREE: Usuario sin PRO
 * - PRO: Usuario con PRO activo
 * - INVALID: Licencia inválida o expirada offline
 * - NO_LICENSE: Sin licencia ingresada aún
 * 
 * Uso:
 * const { status, isPro, deviceId, activateLicense, transferLicense, validateLicense } = useLicense();
 */

/**
 * Genera fingerprint único del PC actual
 * Combina: navigator data, screen resolution, navegador, idioma
 * NO es perfecto, pero detecta cambios obvios (cambio de máquina)
 */
function generatePCFingerprint() {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || "unknown"
  ].join("|");
  
  // Hash simple (no es criptográfico, solo para compresión)
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Verifica si puede usar la app en modo offline
 * (última validación correcta hace menos de 7 días)
 * Y que el fingerprint del PC sea el mismo
 */
function canUseOffline() {
  const lastValidation = localStorage.getItem("last_validation");
  const isPro = localStorage.getItem("is_pro_cached") === "true";
  const storedFingerprint = localStorage.getItem("pc_fingerprint");
  const currentFingerprint = generatePCFingerprint();
  
  if (!lastValidation || !isPro) return false;

  const now = Date.now();
  const lastValidationTime = parseInt(lastValidation, 10);
  const diffDays = (now - lastValidationTime) / (1000 * 60 * 60 * 24);

  // ✅ Verificar: < 7 días Y mismo PC
  const canUse = diffDays < 7 && storedFingerprint === currentFingerprint;
  
  if (!canUse) {
    if (diffDays >= 7) {
      console.warn(`⏰ Offline expirado: ${diffDays.toFixed(1)} días sin validar`);
    }
    if (storedFingerprint !== currentFingerprint) {
      console.warn(`🔧 PC cambió: ${storedFingerprint} → ${currentFingerprint}`);
    }
  }
  
  return canUse;
}

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
        // ✅ Validación exitosa
        setStatus(result.is_pro ? "PRO" : "FREE");
        setIsPro(result.is_pro);
        setError(null);
        
        // Guardar datos de validación (para modo offline)
        const nowTimestamp = Date.now().toString();
        const pcFingerprint = generatePCFingerprint();
        
        setLastValidated(new Date().toISOString());
        localStorage.setItem("last_validation", nowTimestamp);
        localStorage.setItem("is_pro_cached", result.is_pro ? "true" : "false");
        localStorage.setItem("device_id_cached", deviceId);
        localStorage.setItem("pc_fingerprint", pcFingerprint);
        
        console.log(`✅ Licencia validada exitosamente. PRO=${result.is_pro}, Fingerprint=${pcFingerprint.substring(0, 8)}`);
      } else {
        // 🔴 Licencia inválida o transferida
        setStatus("INVALID");
        setIsPro(false);
        setError(result.message || "Licencia no válida");
        console.warn("❌ Licencia inválida:", result.message);
      }
    } catch (err) {
      // 🌐 Error de conexión o servidor
      console.error("⚠️ Error al validar licencia:", err);
      
      // 🔥 MODO OFFLINE: usar valores en caché si están recientes
      if (canUseOffline()) {
        const cachedIsPro = localStorage.getItem("is_pro_cached") === "true";
        const cachedDeviceId = localStorage.getItem("device_id_cached");
        const lastValidationTime = parseInt(localStorage.getItem("last_validation"), 10);
        const diffDays = (Date.now() - lastValidationTime) / (1000 * 60 * 60 * 24);
        
        // Validar coherencia: device_id debe coincidir
        if (cachedDeviceId === deviceId) {
          setStatus(cachedIsPro ? "PRO" : "FREE");
          setIsPro(cachedIsPro);
          setError(null);
          console.log(`🌐 MODO OFFLINE: usando licencia validada hace ${diffDays.toFixed(1)} días`);
        } else {
          // Device cambió: no permitir offline
          setStatus("INVALID");
          setIsPro(false);
          setError("Device ID cambió. Se requiere conexión para revalidar.");
          console.warn("⚠️ Device ID no coincide con caché offline");
        }
      } else {
        // Sin internet Y (sin caché O > 7 días)
        setStatus("INVALID");
        setIsPro(false);
        setError("Offline expirado. Se requiere validación en línea.");
        console.warn("❌ OFFLINE EXPIRADO (> 7 días): requiere conexión a internet");
      }
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
        // NO validar aquí - dejar que se valide cuando se recargue la página
        // validateLicense() es llamada en useEffect al montar el componente
        return true;
      } else {
        // Guardar la clave aunque sea un requires_transfer (para poder hacer el transfer después)
        setLicenseKey(key);
        localStorage.setItem("license_key", key);
        setError(result.message);
        if (result.requires_transfer) {
          // Retornar el objeto para que LicenseActivation sepa que requiere transferencia
          return result;
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
  const transferLicense = useCallback(async (key, newDeviceId, reason = "cambio_pc") => {
    if (!key || !newDeviceId) {
      setError("Datos incompletos para transferir licencia");
      return false;
    }

    setIsValidating(true);
    try {
      const result = await licenseService.transfer(key, newDeviceId, reason);

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
  }, [validateLicense]);

  // Remover licencia (usuario elige desactivar)
  const removeLicense = useCallback(() => {
    setLicenseKey(null);
    setStatus("NO_LICENSE");
    setIsPro(false);
    localStorage.removeItem("license_key");
    localStorage.removeItem("last_validated");
    localStorage.removeItem("last_validation");
    localStorage.removeItem("is_pro_cached");
    localStorage.removeItem("device_id_cached");
    localStorage.removeItem("pc_fingerprint");
    console.log("🗑️ Licencia removida completamente");
  }, []);

  // Validar al iniciar y cada 24 horas
  useEffect(() => {
    // 🔥 Si es LOADING y tenemos licenseKey, intentar validar
    // (fallará si sin internet, pero fallback a offline si < 24h)
    if (status === "LOADING" && licenseKey) {
      validateLicense();
    }

    // Validar cada 24 horas si ya tiene licencia
    const interval = setInterval(() => {
      if (licenseKey) {
        validateLicense();
      }
    }, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

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
    transferLicense,   // (key, newDeviceId, reason?) => Promise<boolean>
    validateLicense,   // () => Promise<void>
    removeLicense      // () => void
    
    // 🌐 MODO OFFLINE + ANTI-PIRATERÍA:
    // - Offline permitido: 7 días desde última validación exitosa
    // - Fingerprint del PC: detecta cambios de hardware
    // - Si > 7 días O cambió PC → requiere internet
    // - Si se comparte key → el otro device fallará en validación
    // - Backend detecta multi-uso cuando intente validar desde otro device
  };
}

export default useLicense;
