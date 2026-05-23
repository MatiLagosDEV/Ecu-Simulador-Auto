import './styles/App.css';
import { useEffect, useState } from 'react';
import Home from './pages/Home';
import useLicense from './hooks/useLicense';
import LicenseActivation from './components/LicenseActivation';
import SuccessScreen from './components/SuccessScreen';

function App() {
  const license = useLicense();

  const [pantalla, setPantalla] = useState('HOME');  // 🆕 Siempre HOME
  // 'HOME' | 'SUCCESS' (solo cuando activa con éxito)
  

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
      {/* Botón de depuración "Server" eliminado */}

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