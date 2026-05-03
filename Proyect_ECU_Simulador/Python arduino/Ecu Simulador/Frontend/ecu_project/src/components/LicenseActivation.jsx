import React, { useState } from "react";
import "../styles/LicenseActivation.css";

/**
 * Componente de Activación de Licencia
 * Muestra un modal/pantalla para que el usuario ingrese su clave PRO
 */
export default function LicenseActivation({ onActivate, isLoading }) {
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");

  const handleActivate = async () => {
    // Validar formato
    if (licenseKey.length !== 32 || !/^[a-zA-Z0-9]{32}$/.test(licenseKey)) {
      setError("Clave inválida (debe ser 32 caracteres alfanuméricos)");
      return;
    }

    setError("");
    const success = await onActivate(licenseKey);
    if (!success) {
      setError("Error al activar licencia. Verifica la clave e intenta de nuevo.");
    } else {
      setLicenseKey("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isLoading) {
      handleActivate();
    }
  };

  return (
    <div className="license-activation">
      <div className="license-activation-card">
        <div className="license-activation-header">
          <h2>🔓 Desbloquear PRO</h2>
          <p>Ingresa tu clave de licencia para acceder a todas las funciones</p>
        </div>

        <div className="license-activation-body">
          <input
            type="text"
            placeholder="Clave de licencia (32 caracteres)"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            maxLength="32"
            className="license-key-input"
          />

          {error && <div className="license-error">{error}</div>}

          <button
            onClick={handleActivate}
            disabled={isLoading || licenseKey.length === 0}
            className="license-activate-btn"
          >
            {isLoading ? "Validando..." : "Activar Licencia"}
          </button>

          <div className="license-help">
            <p>
              ¿No tienes clave? <a href="https://obd2diag.com/comprar">Compra una aquí</a>
            </p>
          </div>
        </div>

        <div className="license-features">
          <h3>✨ Características PRO:</h3>
          <ul>
            <li>✅ Ver todos los códigos de error</li>
            <li>✅ Borrar códigos del motor</li>
            <li>✅ Diagnóstico detallado de fallas</li>
            <li>✅ Notificaciones en tiempo real</li>
            <li>✅ Historial completo</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
