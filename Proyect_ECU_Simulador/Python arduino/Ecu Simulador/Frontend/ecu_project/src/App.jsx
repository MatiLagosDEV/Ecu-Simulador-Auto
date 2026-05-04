import './styles/App.css';
import { useEffect, useState } from 'react';
import Home from './pages/Home';
import useLicense from './hooks/useLicense';
import LicenseActivation from './components/LicenseActivation';
import SuccessScreen from './components/SuccessScreen';

function App() {
  const license = useLicense();

  const [pantalla, setPantalla] = useState('ACTIVACION'); 
  // 'ACTIVACION' | 'SUCCESS' | 'HOME'

  // 🔥 CONTROL CENTRAL DE NAVEGACIÓN
  useEffect(() => {
    // 🚨 NO pisar SUCCESS
    if (pantalla === 'SUCCESS') return;

    if (license.status === 'PRO' || license.status === 'FREE') {
      setPantalla('HOME');
    } 
    else if (license.status === 'INVALID') {
      setPantalla('ACTIVACION');
    } 
    else if (license.status === 'NO_LICENSE') {
      setPantalla('ACTIVACION');
    } 
    else if (license.status === 'LOADING') {
      const licenseKey = localStorage.getItem('license_key');

      if (licenseKey) {
        setPantalla('HOME');
      } else {
        setPantalla('ACTIVACION');
      }
    }

  }, [license.status, pantalla]);

  // =========================
  // 🔹 PANTALLA ACTIVACIÓN
  // =========================
  if (pantalla === 'ACTIVACION') {
    return (
      <LicenseActivation 
        onActivate={license.activateLicense}
        onTransfer={license.transferLicense}
        deviceId={license.deviceId}
        licenseKey={license.licenseKey}
        isLoading={license.isValidating}
        onActivationSuccess={() => setPantalla('SUCCESS')}
      />
    );
  }

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
  // 🔹 PANTALLA HOME
  // =========================
  if (pantalla === 'HOME') {

    // 🔄 Mientras valida no mostramos nada
    if (license.status === 'LOADING') {
      return null;
    }

    return (
      <div>
        {license.status === 'INVALID' && (
          <div style={{
            backgroundColor: '#ff6b6b',
            color: 'white',
            padding: '10px',
            textAlign: 'center'
          }}>
            ⚠️ Licencia inválida. Algunas funciones están bloqueadas.
          </div>
        )}

        <Home 
          licensePro={license.isPro} 
          licenseKey={license.licenseKey}
          deviceId={license.deviceId}
          onUnauthorized={() => setPantalla('ACTIVACION')}
        />
      </div>
    );
  }

  return null;
}

export default App;