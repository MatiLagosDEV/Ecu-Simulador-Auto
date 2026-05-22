import { useEffect, useState } from 'react';
import '../styles/ServerStatus.css';

/**
 * Componente que muestra el estado del servidor Python (Flask)
 * Utiliza IPC para comunicarse con el proceso principal de Electron
 */
export function ServerStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Obtener estado del servidor
  const fetchServerStatus = async () => {
    try {
      setError(null);
      const response = await window.electron?.invoke?.('get-python-server-status');
      
      if (response) {
        setStatus(response);
      } else {
        setError('No se pudo obtener el estado del servidor');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error('Error obteniendo estado del servidor:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar estado inicial
  useEffect(() => {
    fetchServerStatus();
  }, []);

  // Auto-refresh cada 5 segundos (opcional)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchServerStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="server-status loading">
        <div className="status-spinner"></div>
        <p>Verificando servidor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="server-status error">
        <div className="status-icon">⚠️</div>
        <div className="status-content">
          <p className="status-title">Error del Servidor</p>
          <p className="status-message">{error}</p>
          <button onClick={fetchServerStatus} className="retry-button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const isRunning = status?.running;
  const isHealthy = status?.healthy;
  const pid = status?.pid;
  const port = status?.port;
  const host = status?.host;

  return (
    <div className={`server-status ${isRunning ? 'running' : 'stopped'}`}>
      <div className="status-header">
        <div className="status-indicator">
          <div className={`status-dot ${isRunning ? 'active' : 'inactive'}`}></div>
          <span className="status-label">
            {isRunning ? '🟢 Servidor Activo' : '🔴 Servidor Inactivo'}
          </span>
        </div>
        
        <button
          className="refresh-button"
          onClick={fetchServerStatus}
          title="Actualizar estado"
        >
          🔄
        </button>
      </div>

      {isRunning && (
        <div className="status-details">
          <div className="detail-item">
            <span className="detail-label">PID:</span>
            <span className="detail-value">{pid}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Puerto:</span>
            <span className="detail-value">{port}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Host:</span>
            <span className="detail-value">{host}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">URL:</span>
            <span className="detail-value url">
              <a 
                href={`http://${host}:${port}`} 
                target="_blank" 
                rel="noreferrer"
              >
                http://{host}:{port}
              </a>
            </span>
          </div>
        </div>
      )}

      <div className="status-footer">
        <label className="auto-refresh-toggle">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span>Auto-actualizar cada 5s</span>
        </label>
      </div>
    </div>
  );
}
