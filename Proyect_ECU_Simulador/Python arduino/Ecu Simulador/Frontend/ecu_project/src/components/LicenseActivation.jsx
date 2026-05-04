import React, { useState } from "react";
import "../styles/LicenseActivation.css";

/**
 * Componente de Activación de Licencia
 * Muestra un modal/pantalla para que el usuario ingrese su clave PRO
 */
export default function LicenseActivation({ onActivate, onTransfer, deviceId, licenseKey: initialLicenseKey, isLoading, onActivationSuccess, onClose }) {
  const [licenseKey, setLicenseKey] = useState(initialLicenseKey || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [requiresTransfer, setRequiresTransfer] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleActivate = async () => {
    // Validar formato: XXXXXX-XXXXXX-XXXXXX-XXXXXX (27 caracteres)
    if (licenseKey.length < 25 || licenseKey.length > 40) {
      setError("Clave inválida (formato: XXXXXX-XXXXXX-XXXXXX-XXXXXX)");
      setSuccess(false);
      setRequiresTransfer(false);
      return;
    }

    setError("");
    setSuccess(false);
    setRequiresTransfer(false);
    const result = await onActivate(licenseKey);
    
    // Si result es un objeto con requires_transfer (no true/false)
    if (result && typeof result === 'object' && result.requires_transfer) {
      setRequiresTransfer(true);
      setError("");
    } else if (!result) {
      setError("Error al activar licencia. Verifica la clave e intenta de nuevo.");
      setSuccess(false);
    } else if (result === true) {
      setSuccess(true);
      setError("");
      // Llamar callback para cambiar a pantalla SUCCESS
      if (onActivationSuccess) {
        setTimeout(() => onActivationSuccess(), 300);
      }
    }
  };

  const handleTransfer = async () => {
    if (!onTransfer || !licenseKey || !deviceId) return;
    
    setError("");
    const result = await onTransfer(licenseKey, deviceId, "Cambio de dispositivo");
    if (result) {
      setSuccess(true);
      setRequiresTransfer(false);
      setError("");
      setTimeout(() => window.location.reload(), 2000);
    } else {
      setError("Error al transferir licencia. Intenta de nuevo.");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isLoading) {
      handleActivate();
    }
  };

  const handleSuccessOk = () => {
    // Este método ya no se usa, pero lo dejo para compatibilidad
    window.location.reload();
  };

  return (
    <>
      {/* Modal de éxito REMOVIDO - ahora se muestra en pantalla SUCCESS separada */}
      
      {/* Modal principal de activación */}
    <div className={`license-activation ${success ? 'license-activation-success' : ''}`}>
      <div className="license-activation-card">
        <div className="license-activation-header">
          <h2>Desbloquear PRO</h2>
          <p>Ingresa tu clave de licencia para acceder a todas las funciones</p>
        </div>

        <div className="license-activation-body">
          <input
            type="text"
            placeholder="Clave de licencia (XXXXXX-XXXXXX-XXXXXX-XXXXXX)"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            maxLength="40"
            className="license-key-input"
          />

          {error && <div className="license-error">{error}</div>}
          {success && <div className="license-success">¡Activado con éxito!</div>}
          {requiresTransfer && (
            <div className="license-warning">
              Esta licencia está activada en otro dispositivo.
              <br />
              <strong>¿Deseas transferirla a este PC?</strong>
            </div>
          )}

          {!success && !requiresTransfer && (
            <button
              onClick={handleActivate}
              disabled={isLoading || licenseKey.length === 0}
              className="license-activate-btn"
            >
              Activar Licencia
            </button>
          )}
          {!success && requiresTransfer && (
            <div className="license-button-group">
              <button
                onClick={handleTransfer}
                disabled={isLoading}
                className="license-activate-btn"
              >
                Sí, Transferir
              </button>
              <button
                onClick={() => setRequiresTransfer(false)}
                disabled={isLoading}
                className="license-cancel-btn"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="license-help">
            <p>
              ¿No tienes clave? <a href="https://obd2diag.com/comprar">Compra una aquí</a>
            </p>
          </div>
        </div>

        <div className="license-features">
          <h3>Características PRO:</h3>
          <ul>
            <li>Ver todos los códigos de error</li>
            <li>Borrar códigos del motor</li>
            <li>Diagnóstico detallado de fallas</li>
            <li>Notificaciones en tiempo real</li>
            <li>Historial completo</li>
          </ul>
        </div>
      </div>
    </div>
    </>
  );
}
