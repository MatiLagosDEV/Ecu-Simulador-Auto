import './styles/App.css';
import { useEffect, useState } from 'react';
import Home from './pages/Home';
import useLicense from './hooks/useLicense';
import LicenseActivation from './components/LicenseActivation';
import SuccessScreen from './components/SuccessScreen';
import { ServerStatus } from './components/ServerStatus';

function App() {
  const license = useLicense();

  const [pantalla, setPantalla] = useState('HOME');  // 🆕 Siempre HOME
  // 'HOME' | 'SUCCESS' (solo cuando activa con éxito)
  const [showServerStatus, setShowServerStatus] = useState(false); // 🆕 Toggle ServerStatus

  // 🔥 CONTROL CENTRAL DE NAVEGACIÓN - 🆕 Simplificado para FREEMIUM
  useEffect(() => {
    // 🚨 NO pisar SUCCESS
    if (pantalla === 'SUCCESS') return;

    // 🆕 Siempre mostrar HOME (con FREE o PRO según licencia)
    if (license.status === 'PRO' || license.status === 'FREE') {
      setPantalla('HOME');
    }
    // Si licencia es inválida, seguir en HOME pero sin PRO
    else if (license.status === 'INVALID') {
      setPantalla('HOME');
    }

  }, [license.status, pantalla]);

  // =========================
  // 🔹 PANTALLA SUCCESS
  // =========================
  if (pantalla === 'SUCCESS') {
    return (
      <SuccessScreen 
        onEnterHome={async () => {
          // 🔥 Validar licencia antes de entrar
          await license.validateLicense();

          // 🔥 Forzar entrada al HOME
          setPantalla('HOME');
        }}
      />
    );
  }

  // =========================
  // 🔹 PANTALLA HOME (ÚNICA PANTALLA - FREEMIUM)
  // =========================
  return (
    <div>
      {/* 🆕 DEBUG BUTTON - Mostrar/Ocultar ServerStatus */}
      <button 
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          padding: '8px 12px',
          background: showServerStatus ? '#22c55e' : '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 1000,
          fontSize: '12px',
          fontWeight: '600',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '1'}
        onMouseLeave={(e) => e.target.style.opacity = '0.8'}
        onClick={() => setShowServerStatus(!showServerStatus)}
        title="Toggle Server Status Panel"
      >
        {showServerStatus ? '✓' : '•'} Server
      </button>

      {/* 🆕 PANEL FLOTANTE - ServerStatus */}
      {showServerStatus && (
        <div style={{
          position: 'fixed',
          top: 50,
          right: 10,
          width: '320px',
          maxHeight: '80vh',
          overflow: 'auto',
          zIndex: 999,
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          padding: '0',
          border: '1px solid #e5e7eb'
        }}>
          <ServerStatus />
        </div>
      )}

      <Home 
        licensePro={license.isPro} 
        licenseKey={license.licenseKey}
        deviceId={license.deviceId}
        onActivateLicense={license.activateLicense}
        onTransferLicense={license.transferLicense}
        onSuccessActivation={() => setPantalla('SUCCESS')}
      />
    </div>
  );
}

export default App;