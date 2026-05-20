import React, { useState, useEffect } from 'react';
import { updateService } from '../services/updateService';
import './SettingsModal.css';

export default function SettingsModal({ onClose }) {
  const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, latest
  const [updateInfo, setUpdateInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCheckUpdates = async () => {
    setLoading(true);
    setUpdateStatus('checking');

    try {
      const result = await updateService.checkForUpdates();

      if (!result.success) {
        setUpdateStatus('error');
        setUpdateInfo({ message: result.message });
      } else if (result.hasUpdate) {
        setUpdateStatus('available');
        setUpdateInfo(result);
      } else {
        setUpdateStatus('latest');
        setUpdateInfo({ currentVersion: result.currentVersion });
      }
    } catch (error) {
      setUpdateStatus('error');
      setUpdateInfo({ message: 'Error inesperado' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadUpdate = () => {
    if (updateInfo?.releaseUrl) {
      updateService.downloadUpdate(updateInfo.releaseUrl);
      setUpdateStatus('downloading');
    }
  };

  const currentVersion = updateService.getCurrentVersion();

  return (
    <>
      {/* Overlay (fondo oscuro) */}
      <div className="settings-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="settings-modal">
        {/* Header */}
        <div className="settings-header">
          <h2>Configuración</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* Sección de Versión */}
          <div className="settings-section">
            <h3>Información de la App</h3>
            <div className="version-info">
              <p>
                <strong>Versión actual:</strong>
                <span className="version-badge">{currentVersion}</span>
              </p>
            </div>
          </div>

          {/* Sección de Actualizaciones */}
          <div className="settings-section">
            <h3>Actualizaciones</h3>

            {/* Estado: Idle (Sin verificar) */}
            {updateStatus === 'idle' && (
              <button
                className="btn btn-primary"
                onClick={handleCheckUpdates}
                disabled={loading}
              >
                {loading ? 'Verificando...' : 'Verificar Actualizaciones'}
              </button>
            )}

            {/* Estado: Checking */}
            {updateStatus === 'checking' && (
              <div className="status-checking">
                <div className="spinner" />
                <p>Verificando actualizaciones...</p>
              </div>
            )}

            {/* Estado: Actualización disponible */}
            {updateStatus === 'available' && updateInfo && (
              <div className="status-available">
                <div className="alert alert-warning">
                  <p><strong>Nueva versión {updateInfo.latestVersion} disponible</strong></p>
                </div>

                {/* Changelog */}
                {updateInfo.changelog && (
                  <div className="changelog">
                    <h4>Cambios:</h4>
                    <div className="changelog-content">
                      {updateInfo.changelog.split('\n').map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="button-group">
                  <button className="btn btn-success" onClick={handleDownloadUpdate}>
                    Descargar Actualización
                  </button>
                  <button className="btn btn-secondary" onClick={() => setUpdateStatus('idle')}>
                    Después
                  </button>
                </div>
              </div>
            )}

            {/* Estado: Última versión */}
            {updateStatus === 'latest' && (
              <div className="status-latest">
                <div className="alert alert-success">
                  <p>Ya tienes la última versión ({updateInfo.currentVersion})</p>
                </div>
                <button className="btn btn-primary" onClick={() => setUpdateStatus('idle')}>
                  Verificar de Nuevo
                </button>
              </div>
            )}

            {/* Estado: Descargando */}
            {updateStatus === 'downloading' && (
              <div className="status-downloading">
                <div className="spinner" />
                <p>Descargando actualización...</p>
                <p className="small-text">Se abrirá el instalador cuando termine</p>
              </div>
            )}

            {/* Estado: Error */}
            {updateStatus === 'error' && updateInfo && (
              <div className="alert alert-error">
                <p>{updateInfo.message}</p>
                <button className="btn btn-secondary" onClick={() => setUpdateStatus('idle')}>
                  Intentar de Nuevo
                </button>
              </div>
            )}
          </div>

          {/* Información adicional */}
          <div className="settings-section settings-footer">
            <p className="text-muted">
              La app verificará actualizaciones de GitHub. Asegúrate de tener conexión a internet.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
