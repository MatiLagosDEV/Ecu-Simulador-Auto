import React, { useState, useEffect } from 'react';
import '../styles/ConfirmBorrarModal.css';

export default function ConfirmBorrarModal({ onConfirmar, onCancelar }) {
  const [fase, setFase] = useState('confirm'); // 'confirm' | 'borrando' | 'exito'
  const [progreso, setProgreso] = useState(0);

  const iniciarBorrado = async () => {
    setFase('borrando');
    setProgreso(0);

    // Animación de progreso en ~4 segundos
    const pasos = [
      { pct: 12, delay: 300  },
      { pct: 30, delay: 700  },
      { pct: 48, delay: 600  },
      { pct: 65, delay: 800  },
      { pct: 80, delay: 600  },
      { pct: 93, delay: 700  },
      { pct: 100, delay: 600 },
    ];

    // Lanzar petición real al mismo tiempo que la animación
    const borradoPromise = onConfirmar();

    let acumulado = 0;
    for (const paso of pasos) {
      await new Promise(r => setTimeout(r, paso.delay));
      setProgreso(paso.pct);
      acumulado += paso.delay;
    }

    await borradoPromise;
    setFase('exito');
  };

  const msgPorProgreso = (p) => {
    if (p < 20) return 'Iniciando comunicación con la ECU...';
    if (p < 45) return 'Enviando comando Mode 04 (borrado DTC)...';
    if (p < 65) return 'Limpiando códigos confirmados...';
    if (p < 85) return 'Borrando datos de Freeze Frame...';
    if (p < 100) return 'Verificando resultado...';
    return 'Completado.';
  };

  return (
    <div className="cbm-overlay">
      <div className={`cbm-box cbm-box-progress${fase === 'exito' ? ' cbm-box-exito' : ''}`}>

        {/* ── FASE: Confirmación ── */}
        {fase === 'confirm' && (
          <>
            {/* Círculo igual al de progreso pero con “?” */}
            <div className="cbm-progress-icon">
              <svg viewBox="0 0 52 52" fill="none">
                <circle cx="26" cy="26" r="22" stroke="rgba(255,255,255,0.08)" strokeWidth="3"/>
                <circle cx="26" cy="26" r="22"
                  stroke="#2196f3" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray="138.2" strokeDashoffset="34.5"
                />
                {/* Ícono OBD2 conector */}
                <rect x="14" y="19" width="24" height="15" rx="2.5"
                  stroke="#2196f3" strokeWidth="1.6" fill="rgba(33,150,243,0.1)"/>
                {/* pins fila superior */}
                <circle cx="19" cy="24" r="1.4" fill="#2196f3"/>
                <circle cx="26" cy="24" r="1.4" fill="#2196f3"/>
                <circle cx="33" cy="24" r="1.4" fill="#2196f3"/>
                {/* pins fila inferior */}
                <circle cx="19" cy="29" r="1.4" fill="#2196f3" opacity="0.6"/>
                <circle cx="33" cy="29" r="1.4" fill="#2196f3" opacity="0.6"/>
                {/* pin central grande */}
                <rect x="23.5" y="27" width="5" height="3" rx="1" fill="#2196f3" opacity="0.85"/>
              </svg>
            </div>
            <h2 className="cbm-title cbm-title-progress">¿Borrar códigos de diagnóstico?</h2>
            <div className="cbm-body">
              <div className="cbm-warn-row">
                <span className="cbm-warn-dot cbm-dot-red" />
                <p><strong>Advertencia:</strong> Se borrarán los códigos DTC y los datos de Freeze Frame.</p>
              </div>
              <div className="cbm-warn-row">
                <span className="cbm-warn-dot cbm-dot-amber" />
                <p><strong>Condición:</strong> Motor <span className="cbm-highlight">APAGADO</span>, contacto en posición <span className="cbm-highlight">ON</span>.</p>
              </div>
                <div className="cbm-warn-row">
                  <span className="cbm-warn-dot cbm-dot-blue" />
                  <p><strong>Aviso:</strong> El borrado de códigos apaga la luz del tablero, pero si no reparaste la falla mecánica, la luz volverá a encenderse tras un par de kilómetros. Se recomienda usar esta función después de realizar la reparación.</p>
                </div>
            </div>
            <div className="cbm-actions">
              <button className="cbm-btn cbm-btn-cancel" onClick={onCancelar}>
                Cancelar
              </button>
              <button className="cbm-btn cbm-btn-confirm" onClick={iniciarBorrado}>
                Sí, Borrar ahora
              </button>
            </div>
          </>
        )}

        {/* ── FASE: Borrando (progreso) ── */}
        {fase === 'borrando' && (
          <>
            <div className="cbm-progress-icon">
              <svg viewBox="0 0 52 52" fill="none">
                <circle cx="26" cy="26" r="22" stroke="rgba(255,255,255,0.08)" strokeWidth="3"/>
                <circle cx="26" cy="26" r="22"
                  stroke="#2196f3" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray="138.2" strokeDashoffset={138.2 - (138.2 * progreso / 100)}
                  style={{ transition: 'stroke-dashoffset 0.5s ease', transformOrigin: 'center', transform: 'rotate(-90deg)' }}
                />
                <text x="26" y="31" textAnchor="middle" fill="#2196f3"
                  fontSize="12" fontWeight="700" fontFamily="'Montserrat', Arial">
                  {progreso}%
                </text>
              </svg>
            </div>
            <h2 className="cbm-title cbm-title-progress">Comunicando con la ECU</h2>
            <div className="cbm-bar-track">
              <div className="cbm-bar-fill" style={{ width: `${progreso}%` }} />
            </div>
            <p className="cbm-progress-msg">{msgPorProgreso(progreso)}</p>
          </>
        )}

        {/* ── FASE: Éxito ── */}
        {fase === 'exito' && (
          <>
            <div className="cbm-exito-icon">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
                style={{ filter: 'drop-shadow(0 0 14px rgba(41,182,246,0.7))' }}>
                {/* Llave inglesa/mecánica */}
                <path d="M44 8 C37 8 32 13 32 20 C32 22.2 32.6 24.2 33.6 26L14 45.5 C12.3 47.2 12.3 50 14 51.7 C15.7 53.4 18.5 53.4 20.2 51.7L39.8 32.2 C41.8 33.3 44 34 46 34 C53 34 58 29 58 22 C58 20.2 57.6 18.5 57 17L50 24 L44 24 L40 20 L40 14 L47 7 C46 7.3 45 8 44 8Z"
                  fill="rgba(41,182,246,0.15)" stroke="#29b6f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                <circle cx="16.5" cy="48.5" r="2.5" fill="#29b6f6"/>
              </svg>
            </div>
            <h2 className="cbm-title cbm-title-exito">¡Borrado Exitoso!</h2>
            <p className="cbm-exito-msg">
              Los códigos DTC y el Freeze Frame han sido eliminados.<br/>
            </p>
            <button className="cbm-btn cbm-btn-close" onClick={onCancelar}>
              Volver al Check Engine
            </button>
          </>
        )}

      </div>
    </div>
  );
}
