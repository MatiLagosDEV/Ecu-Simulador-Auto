/**
 * EJEMPLO: Cómo integrar el sistema de licencias en tu app
 * 
 * Este archivo muestra la estructura completa para:
 * 1. Validar licencia al iniciar
 * 2. Mostrar modal de activación si no tiene PRO
 * 3. Bloquear/desbloquear features según is_pro
 * 4. Actualizar UI según estado
 */

import React, { useState, useEffect } from "react";
import useLicense from "../hooks/useLicense";
import LicenseActivation from "../components/LicenseActivation";
import ProtectedFeature from "../components/ProtectedFeature";
import "../styles/ProtectedFeature.css";
import "../styles/LicenseActivation.css";

export default function ExampleIntegration() {
  const license = useLicense();
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  // Mostrar modal si no tiene licencia y no está en LOADING
  useEffect(() => {
    if (license.status === "NO_LICENSE" || license.status === "FREE") {
      // Opcionalmente mostrar modal después de un tiempo
      // setShowLicenseModal(true);
    }
  }, [license.status]);

  // Handler para activar
  const handleActivateLicense = async (key) => {
    const success = await license.activateLicense(key);
    if (success) {
      setShowLicenseModal(false);
    }
    return success;
  };

  // Handler para transferir
  const handleTransfer = async () => {
    const newDeviceId = prompt("Ingresa el nuevo device ID:");
    if (newDeviceId) {
      const success = await license.transferLicense(newDeviceId);
      if (success) {
        alert("Licencia transferida exitosamente");
      }
    }
  };

  return (
    <div className="example-integration">
      {/* ═══════════════════════════════════════════════════════════
          HEADER CON ESTADO DE LICENCIA
          ═══════════════════════════════════════════════════════════ */}
      <header className="license-header">
        <h1>OBD2 Diagnóstico</h1>

        {/* Estado visual de licencia */}
        <div className="license-status">
          {license.status === "LOADING" && (
            <span className="status-badge loading">⏳ Validando...</span>
          )}

          {license.status === "PRO" && (
            <span className="status-badge pro">👑 PRO ACTIVO</span>
          )}

          {license.status === "FREE" && (
            <span className="status-badge free">📋 Versión Gratuita</span>
          )}

          {license.status === "INVALID" && (
            <span className="status-badge invalid">❌ Error de Licencia</span>
          )}

          {license.status === "NO_LICENSE" && (
            <span className="status-badge no-license">📦 Sin Licencia</span>
          )}

          {/* Mostrar device ID (útil para debugging) */}
          {license.deviceId && (
            <small style={{ color: "#888", marginLeft: "1rem" }}>
              Device: {license.deviceId.substring(0, 15)}...
            </small>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          CONTENIDO PRINCIPAL
          ═══════════════════════════════════════════════════════════ */}
      <main className="app-main">
        {/* FEATURE 1: Escanear códigos (disponible para todos) */}
        <section className="feature-section">
          <h2>📊 Escanear Códigos</h2>
          <p>Lee los códigos de falla del motor.</p>
          <button className="btn btn-primary">
            ▶ Escanear OBD-II
          </button>
        </section>

        <hr />

        {/* FEATURE 2: Ver todos los códigos (PRO ONLY) */}
        <section className="feature-section">
          <h2>🔧 Ver Todos los Códigos</h2>
          <ProtectedFeature
            isPro={license.isPro}
            featureName="Ver todos los códigos"
            onUpgrade={() => setShowLicenseModal(true)}
            fallback="Versión gratuita: muestra solo 1 código"
          >
            <p>Muestra TODOS los códigos de error detectados.</p>
            <div className="codes-list-demo">
              <div className="code-item">P0300 - Cylinder misfire detected</div>
              <div className="code-item">P0171 - System too lean</div>
              <div className="code-item">P0420 - Catalyst system efficiency</div>
            </div>
          </ProtectedFeature>
        </section>

        <hr />

        {/* FEATURE 3: Borrar códigos (PRO ONLY) */}
        <section className="feature-section">
          <h2>🧹 Borrar Códigos</h2>
          <ProtectedFeature
            isPro={license.isPro}
            featureName="Borrar códigos del motor"
            onUpgrade={() => setShowLicenseModal(true)}
          >
            <button className="btn btn-danger">
              ⚠️ Limpiar Códigos de Error
            </button>
            <p style={{ fontSize: "0.85rem", color: "#999", marginTop: "1rem" }}>
              Solo disponible en versión PRO. Permite borrar el código de Check Engine.
            </p>
          </ProtectedFeature>
        </section>

        <hr />

        {/* FEATURE 4: Diagnóstico (PRO ONLY) */}
        <section className="feature-section">
          <h2>🔬 Diagnóstico Avanzado</h2>
          <ProtectedFeature
            isPro={license.isPro}
            featureName="Diagnóstico avanzado"
            onUpgrade={() => setShowLicenseModal(true)}
          >
            <p>Análisis detallado de cada falla con posibles causas y soluciones.</p>
            <button className="btn btn-secondary">
              Analizar Fallas
            </button>
          </ProtectedFeature>
        </section>

        <hr />

        {/* FEATURE 5: Historial (PRO ONLY) */}
        <section className="feature-section">
          <h2>📈 Historial de Diagnósticos</h2>
          <ProtectedFeature
            isPro={license.isPro}
            featureName="Historial completo"
            onUpgrade={() => setShowLicenseModal(true)}
          >
            <p>Acceso a todos los diagnósticos realizados.</p>
            <div className="history-demo">
              <div className="history-item">
                <span>Hoy 14:30</span> - Escaneo completado
              </div>
              <div className="history-item">
                <span>Ayer 10:15</span> - Borrar códigos exitoso
              </div>
            </div>
          </ProtectedFeature>
        </section>

        <hr />

        {/* CONTROLES DE LICENCIA */}
        <section className="license-controls">
          <h3>Gestión de Licencia</h3>

          {license.status === "NO_LICENSE" || license.status === "FREE" ? (
            <button
              className="btn btn-success"
              onClick={() => setShowLicenseModal(true)}
            >
              🔓 Activar Licencia PRO
            </button>
          ) : (
            <>
              <p>
                ✅ Licencia activa en: <code>{license.deviceId}</code>
              </p>
              <button className="btn btn-secondary" onClick={handleTransfer}>
                ↔️ Transferir a otro PC
              </button>
            </>
          )}

          {license.error && <p style={{ color: "#ff6b6b" }}>{license.error}</p>}
        </section>
      </main>

      {/* ═══════════════════════════════════════════════════════════
          MODAL DE ACTIVACIÓN
          ═══════════════════════════════════════════════════════════ */}
      {showLicenseModal && (
        <LicenseActivation
          onActivate={handleActivateLicense}
          isLoading={license.isValidating}
        />
      )}
    </div>
  );
}

/**
 * NOTAS DE IMPLEMENTACIÓN:
 * 
 * 1. IMPORTAR EN TU APP.JSX:
 *    import useLicense from "./hooks/useLicense";
 *    import LicenseActivation from "./components/LicenseActivation";
 *    import ProtectedFeature from "./components/ProtectedFeature";
 * 
 * 2. USAR EN CUALQUIER COMPONENTE:
 *    const license = useLicense();
 *    if (license.isPro) { /* mostrar features */ }
 * 
 * 3. BLOQUEAR FEATURES:
 *    <ProtectedFeature isPro={license.isPro} featureName="Mi Feature">
 *      <MiComponente />
 *    </ProtectedFeature>
 * 
 * 4. VALIDACIÓN AUTOMÁTICA:
 *    - Se valida cada 24 horas
 *    - Se valida al iniciar la app
 *    - Se persiste en localStorage
 * 
 * 5. STATES POSIBLES:
 *    - LOADING: Inicializando
 *    - PRO: Licencia válida PRO
 *    - FREE: Sin licencia o gratuita
 *    - INVALID: Error en BD
 *    - NO_LICENSE: Sin clave ingresada
 */
