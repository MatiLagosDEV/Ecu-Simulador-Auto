import React, { useState, useEffect } from 'react';
import { updateService } from '../services/updateService';
import './SettingsModal.css';

export default function SettingsModal({ onClose }) {
  const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, latest
  const [updateInfo, setUpdateInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Estado del modo y conexión
  const [modoActual, setModoActual] = useState('diagnosticar');
  const [elm327Status, setElm327Status] = useState({
    buscando: false,
    conectado: false,
    puerto: null
  });

  // Obtener configuración actual al montar el componente
  useEffect(() => {
    let isMounted = true;
    let interval = null;
    let timeoutHandle = null;
    let busquedaIniciada = false;

    const obtenerConfig = async () => {
      try {
        const API_BASE = window.location.protocol === 'http:' || window.location.protocol === 'https:' 
          ? '/api' 
          : 'http://127.0.0.1:5000/api';
        
        const response = await fetch(`${API_BASE}/config`);
        if (response.ok && isMounted) {
          const config = await response.json();
          setModoActual(config.modo);
          setElm327Status({
            buscando: config.buscando_elm327,
            conectado: config.elm327_conectado,
            puerto: config.puerto_elm327
          });
          
          // Si acaba de empezar la búsqueda, iniciar timeout de 1 minuto
          if (config.buscando_elm327 && !busquedaIniciada) {
            busquedaIniciada = true;
            timeoutHandle = setTimeout(() => {
              if (isMounted) {
                setElm327Status(prev => ({
                  ...prev,
                  buscando: false
                }));
                busquedaIniciada = false;
              }
            }, 60000); // 60 segundos
          }
          
          // Si se detuvo la búsqueda, resetear flag
          if (!config.buscando_elm327 && busquedaIniciada) {
            busquedaIniciada = false;
          }
        }
      } catch (error) {
        console.error('Error obteniendo configuración:', error);
      }
    };
    
    // Primera llamada inmediata
    obtenerConfig();
    
    // Actualizar estado cada 2 segundos
    interval = setInterval(obtenerConfig, 2000);
    
    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, []);

  const handleChangeModo = async (nuevoModo) => {
    try {
      const API_BASE = window.location.protocol === 'http:' || window.location.protocol === 'https:' 
        ? '/api' 
        : 'http://127.0.0.1:5000/api';
      
      const response = await fetch(`${API_BASE}/config-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nuevoModo })
      });
      
      if (response.ok) {
        const data = await response.json();
        setModoActual(data.modo);
        if (nuevoModo === 'diagnosticar') {
          setElm327Status({ buscando: true, conectado: false, puerto: null });
        }
      }
    } catch (error) {
      console.error('Error cambiando modo:', error);
    }
  };

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
          {/* Sección de Modo de Operación */}
          <div className="settings-section">
            <h3>Modo de Operación</h3>
            <div className="modo-selector">
              <label>Seleccionar modo:</label>
              <div className="modo-buttons">
                <button
                  className={`btn ${modoActual === 'diagnosticar' ? 'btn-active' : 'btn-secondary'}`}
                  onClick={() => handleChangeModo('diagnosticar')}
                >
                  Diagnóstico (ELM327)
                </button>
                <button
                  className={`btn ${modoActual === 'simulador' ? 'btn-active' : 'btn-secondary'}`}
                  onClick={() => handleChangeModo('simulador')}
                >
                  Simulador
                </button>
              </div>
            </div>

            {/* Indicador de estado ELM327 */}
            {modoActual === 'diagnosticar' && (
              <div className="elm327-status">
                {elm327Status.buscando && (
                  <div className="status-searching">
                    <p>Buscando interfaz ELM327 automáticamente...</p>
                  </div>
                )}
                {elm327Status.conectado && elm327Status.puerto && (
                  <div className="status-connected">
                    <p>Conectado en <strong>{elm327Status.puerto}</strong></p>
                  </div>
                )}
                {!elm327Status.buscando && !elm327Status.conectado && (
                  <div className="status-offline">
                    <p>No hay conexión con ELM327</p>
                  </div>
                )}
              </div>
            )}
          </div>

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
