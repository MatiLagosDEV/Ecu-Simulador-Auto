/**
 * EJEMPLO: Cómo integrar ServerStatus en tu aplicación
 * 
 * El componente ServerStatus muestra el estado del servidor Flask en tiempo real.
 * Puedes agregarlo en varios lugares:
 * 1. En la página Home (recomendado para debug)
 * 2. En un modal de configuración
 * 3. En la barra de estado de la app
 */

// ============================================
// OPCIÓN 1: En App.jsx (barra superior)
// ============================================

import './styles/App.css';
import { useEffect, useState } from 'react';
import Home from './pages/Home';
import useLicense from './hooks/useLicense';
import LicenseActivation from './components/LicenseActivation';
import SuccessScreen from './components/SuccessScreen';
import { ServerStatus } from './components/ServerStatus'; // ← IMPORTAR

function App() {
  const license = useLicense();
  const [pantalla, setPantalla] = useState('HOME');
  const [showServerStatus, setShowServerStatus] = useState(false); // Toggle para debug

  useEffect(() => {
    if (pantalla === 'SUCCESS') return;
    if (license.status === 'PRO' || license.status === 'FREE') {
      setPantalla('HOME');
    } else if (license.status === 'INVALID') {
      setPantalla('HOME');
    }
  }, [license.status, pantalla]);

  if (pantalla === 'SUCCESS') {
    return (
      <SuccessScreen 
        onEnterHome={async () => {
          await license.validateLicense();
          setPantalla('HOME');
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {/* NUEVO: Mostrar estado del servidor (opcional) */}
      <div className="server-status-container">
        <button 
          className="debug-toggle"
          onClick={() => setShowServerStatus(!showServerStatus)}
          title="Toggle Server Status (F12 para DevTools)"
        >
          {showServerStatus ? '✓' : '•'} Server
        </button>
        {showServerStatus && (
          <div className="server-status-panel">
            <ServerStatus />
          </div>
        )}
      </div>

      <Home license={license} />
    </div>
  );
}

export default App;


// ============================================
// OPCIÓN 2: En un componente SettingsModal
// ============================================

// En SettingsModal.jsx:
import { ServerStatus } from './ServerStatus';

function SettingsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Configuración</h2>
        
        {/* Tab: Estado del Servidor */}
        <div className="modal-section">
          <h3>Estado del Servidor Flask</h3>
          <ServerStatus />
        </div>

        {/* Otros ajustes... */}
        
        <button onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

export default SettingsModal;


// ============================================
// OPCIÓN 3: En Home.jsx (lado derecho)
// ============================================

// En pages/Home.jsx:
import { ServerStatus } from '../components/ServerStatus';

function Home({ license }) {
  return (
    <div className="home-layout">
      <div className="main-content">
        {/* Tu contenido principal aquí */}
      </div>

      <aside className="sidebar">
        <h3>Sistema</h3>
        <ServerStatus />
      </aside>
    </div>
  );
}

export default Home;


// ============================================
// OPCIÓN 4: En una página de Debug
// ============================================

// En pages/Debug.jsx:
import { ServerStatus } from '../components/ServerStatus';

function DebugPage() {
  return (
    <div className="debug-page">
      <h1>Panel de Debug</h1>
      
      <section>
        <h2>Servidor Python (Flask)</h2>
        <ServerStatus />
      </section>

      <section>
        <h2>Información del Sistema</h2>
        {/* Otros controles de debug */}
      </section>
    </div>
  );
}

export default DebugPage;


// ============================================
// ESTILOS ADICIONALES (agregar a App.css)
// ============================================

/*
.server-status-container {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 1000;
}

.debug-toggle {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.debug-toggle:hover {
  background: rgba(0, 0, 0, 0.9);
}

.server-status-panel {
  position: fixed;
  top: 40px;
  right: 10px;
  width: 320px;
  max-height: 80vh;
  overflow-y: auto;
  z-index: 1000;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
*/
