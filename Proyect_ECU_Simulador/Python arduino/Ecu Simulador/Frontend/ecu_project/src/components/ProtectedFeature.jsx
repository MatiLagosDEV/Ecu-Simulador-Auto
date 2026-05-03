import React from "react";

/**
 * Componente para bloquear/desbloquear features según nivel de licencia
 * 
 * Uso:
 * <ProtectedFeature isPro={isPro} featureName="Borrar Códigos">
 *   <button onClick={handleClear}>Limpiar</button>
 * </ProtectedFeature>
 */
export default function ProtectedFeature({
  isPro,
  featureName,
  children,
  onUpgrade,
  fallback
}) {
  if (isPro) {
    return children;
  }

  // Si es un string, mostrar fallback con botón de upgrade
  if (fallback) {
    return (
      <div className="protected-feature-locked">
        <div className="lock-overlay">
          <div className="lock-content">
            <span className="lock-icon">🔒</span>
            <p className="lock-text">{featureName} es una función PRO</p>
            <button
              className="upgrade-btn"
              onClick={onUpgrade}
            >
              Desbloquear PRO
            </button>
          </div>
        </div>
        <div className="feature-disabled">{fallback}</div>
      </div>
    );
  }

  // Si es un elemento, envolver con overlay
  return (
    <div className="protected-feature-locked">
      <div className="lock-overlay">
        <div className="lock-content">
          <span className="lock-icon">🔒</span>
          <p className="lock-text">{featureName}</p>
          <p className="lock-subtext">Función disponible en PRO</p>
          <button
            className="upgrade-btn"
            onClick={onUpgrade}
          >
            Desbloquear PRO
          </button>
        </div>
      </div>
      <div className="feature-disabled" style={{ pointerEvents: "none", opacity: 0.5 }}>
        {children}
      </div>
    </div>
  );
}
