import React from "react";
import "../styles/LicenseActivation.css";

/**
 * Pantalla intermedia de éxito después de activar licencia
 * El usuario ve el mensaje de éxito y presiona OK para entrar al Home
 */
export default function SuccessScreen({ onEnterHome }) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div className="license-success-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="license-success-modal">
          <h2 className="license-success-modal-title">¡Éxito!</h2>
          <p className="license-success-modal-text">Tu licencia PRO se ha procesado correctamente.</p>
          <button 
            onClick={onEnterHome}
            className="license-success-modal-btn"
          >
            Ok, Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
