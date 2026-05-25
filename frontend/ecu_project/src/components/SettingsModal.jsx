import React, { useState, useEffect } from 'react';
import { updateService } from '../services/updateService';
import './SettingsModal.css';

export default function SettingsModal({ onClose }) {
  const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, latest
  const [updateInfo, setUpdateInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [puertosDisponibles, setPuertosDisponibles] = useState([]);
  const [puertoSeleccionado, setPuertoSeleccionado] = useState('');
  const [puertosLoading, setPuertosLoading] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [conexionMensaje, setConexionMensaje] = useState('');
  
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
        }
      } catch (error) {
        console.error('Error obteniendo configuración:', error);
      }
    };

    const obtenerPuertos = async () => {
      try {
        setPuertosLoading(true);
        const API_BASE = window.location.protocol === 'http:' || window.location.protocol === 'https:' 
          ? '/api' 
          : 'http://127.0.0.1:5000/api';

        const response = await fetch(`${API_BASE}/puertos-disponibles`);
        if (response.ok && isMounted) {
          const data = await response.json();
          const lista = Array.isArray(data.puertos) ? data.puertos : [];
          setPuertosDisponibles(lista);

          setPuertoSeleccionado((actual) => {
            if (actual && lista.some((puerto) => puerto.device === actual)) {
              return actual;
            }
            if (elm327Status.puerto && lista.some((puerto) => puerto.device === elm327Status.puerto)) {
              return elm327Status.puerto;
            }
            return lista[0]?.device || '';
          });
        }
      } catch (error) {
        console.error('Error obteniendo puertos:', error);
      } finally {
        if (isMounted) {
          setPuertosLoading(false);
        }
      }
    };
    
    // Primera llamada inmediata
    obtenerConfig();
    obtenerPuertos();
    
    // Actualizar estado cada 2 segundos
    interval = setInterval(obtenerConfig, 2000);
    
    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!window?.electron?.onUpdateProgress) {
      return undefined;
    }

    const unsubscribe = window.electron.onUpdateProgress((progress) => {
      const percent = Math.max(0, Math.min(100, Math.round(progress?.percent || 0)));
      setDownloadProgress(percent);
      setDownloadSpeed(progress?.bytesPerSecond || 0);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
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
        setConexionMensaje('');
        if (nuevoModo === 'diagnosticar') {
          setElm327Status({ buscando: false, conectado: false, puerto: null });
        } else {
          setElm327Status({ buscando: false, conectado: false, puerto: null });
        }
      }
    } catch (error) {
      console.error('Error cambiando modo:', error);
    }
  };

  const handleConectarElm327 = async () => {
    try {
      setConectando(true);
      setConexionMensaje('');

      const API_BASE = window.location.protocol === 'http:' || window.location.protocol === 'https:' 
        ? '/api' 
        : 'http://127.0.0.1:5000/api';

      const response = await fetch(`${API_BASE}/elm327/conectar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puerto: puertoSeleccionado || null })
      });

      const data = await response.json();
      setElm327Status({
        buscando: Boolean(data.buscando_elm327),
        conectado: Boolean(data.elm327_conectado),
        puerto: data.puerto_elm327 || null
      });

      if (data.puerto_elm327) {
        setPuertoSeleccionado(data.puerto_elm327);
      }

      setConexionMensaje(data.message || data.error || '');
    } catch (error) {
      console.error('Error conectando ELM327:', error);
      setConexionMensaje('No se pudo conectar al puerto seleccionado');
    } finally {
      setConectando(false);
    }
  };

  const handleDesconectarElm327 = async () => {
    try {
      setConectando(true);
      const API_BASE = window.location.protocol === 'http:' || window.location.protocol === 'https:' 
        ? '/api' 
        : 'http://127.0.0.1:5000/api';

      await fetch(`${API_BASE}/elm327/desconectar`, { method: 'POST' });
      setElm327Status({ buscando: false, conectado: false, puerto: null });
      setConexionMensaje('Conexión cerrada');
    } catch (error) {
      console.error('Error desconectando ELM327:', error);
    } finally {
      setConectando(false);
    }
  };

  const handleRefrescarPuertos = async () => {
    try {
      setPuertosLoading(true);
      const API_BASE = window.location.protocol === 'http:' || window.location.protocol === 'https:' 
        ? '/api' 
        : 'http://127.0.0.1:5000/api';

      const response = await fetch(`${API_BASE}/puertos-disponibles`);
      if (response.ok) {
        const data = await response.json();
        const lista = Array.isArray(data.puertos) ? data.puertos : [];
        setPuertosDisponibles(lista);
        setPuertoSeleccionado((actual) => {
          if (actual && lista.some((puerto) => puerto.device === actual)) {
            return actual;
          }
          return lista[0]?.device || '';
        });
      }
    } catch (error) {
      console.error('Error refrescando puertos:', error);
    } finally {
      setPuertosLoading(false);
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
    setDownloadProgress(0);
    setDownloadSpeed(0);
    if (updateService.downloadUpdate(updateInfo?.releaseUrl)) {
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
                <div className="port-selector">
                  <div className="port-selector-header">
                    <label htmlFor="elm327-port">Puerto COM</label>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={handleRefrescarPuertos}
                      disabled={puertosLoading}
                      type="button"
                    >
                      {puertosLoading ? 'Actualizando...' : 'Actualizar puertos'}
                    </button>
                  </div>

                  <select
                    id="elm327-port"
                    className="port-select"
                    value={puertoSeleccionado}
                    onChange={(event) => setPuertoSeleccionado(event.target.value)}
                  >
                    <option value="">Detectar automáticamente</option>
                    {puertosDisponibles.map((puerto) => (
                      <option key={puerto.device} value={puerto.device}>
                        {puerto.device} - {puerto.description || 'Sin descripción'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="button-group">
                  <button
                    className="btn btn-primary"
                    onClick={handleConectarElm327}
                    disabled={conectando}
                    type="button"
                  >
                    {conectando ? 'Conectando...' : 'Conectar ELM327'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleDesconectarElm327}
                    disabled={conectando || !elm327Status.conectado}
                    type="button"
                  >
                    Desconectar
                  </button>
                </div>

                <p className="port-hint">
                  Si Windows muestra dos puertos Bluetooth, prueba el de salida. El de entrada suele no responder.
                </p>

                {conexionMensaje && (
                  <div className="status-message">
                    <p>{conexionMensaje}</p>
                  </div>
                )}

                {elm327Status.conectado && elm327Status.puerto && (
                  <div className="status-connected">
                    <p>Conectado en <strong>{elm327Status.puerto}</strong></p>
                  </div>
                )}

                {!elm327Status.conectado && (
                  <div className="status-offline">
                    <p>Selecciona un puerto y pulsa Conectar.</p>
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
                <div className="update-progress-wrap">
                  <div className="update-progress-bar">
                    <div
                      className="update-progress-fill"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <div className="update-progress-meta">
                    <span>{downloadProgress}%</span>
                    <span>
                      {downloadSpeed > 0
                        ? `${(downloadSpeed / 1024 / 1024).toFixed(2)} MB/s`
                        : 'Preparando...'}
                    </span>
                  </div>
                </div>
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
