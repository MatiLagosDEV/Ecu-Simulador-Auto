import React from 'react';
import './CheckEnginePage.css';

const CAT_META = {
  P: { icon: '🔧', label: 'Motor' },
  B: { icon: '🚗', label: 'Carrocería' },
  C: { icon: '⚙️',  label: 'Chasis' },
  U: { icon: '📡', label: 'Red/Cables' },
};

function getCodeMeta(code) {
  const letter = (code[0] || 'P').toUpperCase();
  const num    = parseInt(code.slice(1), 10) || 0;
  const cat    = CAT_META[letter] || { icon: '❓', label: 'Otro' };

  let severity = 'medium';
  if (letter === 'P') {
    if ((num >= 300 && num <= 312) || num === 217 || num === 524 || num === 525)
      severity = 'critical';
    else if ((num >= 600 && num <= 699) || (num >= 100 && num <= 109) || num === 335)
      severity = 'high';
    else if (num >= 200 && num <= 299)
      severity = 'high';
    else
      severity = 'medium';
  } else if (letter === 'C') {
    severity = 'high';
  } else if (letter === 'B') {
    severity = 'low';
  } else if (letter === 'U') {
    severity = 'medium';
  }

  const sevLabels = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Info' };
  return { ...cat, severity, sevLabel: sevLabels[severity] };
}

export default function CheckEnginePage({
  checkEngine,
  escaneando,
  borrando,
  expandedCodes,
  toggleCode,
  handleEscanear,
  handleBorrar,
  onVolver,
}) {
  const codigos   = checkEngine?.codigos   ?? [];
  const pendientes = checkEngine?.pendientes ?? [];
  const totalCodes = codigos.length + pendientes.length;

  return (
    <div className="ce-page-bg">
      {/* ── Top bar ── */}
      <div className="ce-page-topbar">
        <button className="ce-page-back" onClick={onVolver}>
          ← Volver
        </button>
        <div className="ce-page-topbar-center">
          <svg className={`ce-page-mil-icon ${
            checkEngine === null ? 'ce-unknown'
            : checkEngine.mil ? 'ce-on'
            : pendientes.length > 0 ? 'ce-pending'
            : 'ce-ok'
          }`} viewBox="0 0 40 28" fill="none">
            <path d="M13 4 L13 9 L4 9 L4 21 L36 21 L36 9 L27 9 L27 4 Z"
              stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>
            <line x1="1" y1="13" x2="4" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="1" y1="17" x2="4" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="36" y1="13" x2="39" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="36" y1="17" x2="39" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="20" cy="15" r="3" fill="currentColor"/>
          </svg>
          <h1 className="ce-page-title">Check Engine — Diagnóstico OBD-II</h1>
        </div>
        <div className="ce-page-topbar-right">
          {checkEngine !== null && (
            <span className={`ce-page-status-pill ${checkEngine.mil ? 'pill-on' : pendientes.length > 0 ? 'pill-pending' : 'pill-ok'}`}>
              {checkEngine.mil
                ? `MIL ENCENDIDO · ${totalCodes} código${totalCodes !== 1 ? 's' : ''}`
                : pendientes.length > 0
                  ? `${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}`
                  : 'Sin fallas activas'}
            </span>
          )}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="ce-page-content">
        {checkEngine === null ? (
          <div className="ce-page-empty">
            <span className="ce-page-empty-icon">
              {/* Símbolo abstracto red CAN: bus central + nodos ECU */}
              <svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg"
                style={{ width: '4.5rem', height: '3.4rem' }}>
                {/* Bus CAN — línea horizontal central */}
                <line x1="10" y1="30" x2="70" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                {/* Terminadores de bus */}
                <rect x="5" y="26" width="5" height="8" rx="1.5" fill="currentColor" opacity="0.6"/>
                <rect x="70" y="26" width="5" height="8" rx="1.5" fill="currentColor" opacity="0.6"/>
                {/* Stub nodo 1 — arriba izq */}
                <line x1="20" y1="30" x2="20" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <rect x="13" y="7" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                <text x="20" y="14.5" textAnchor="middle" fontSize="4.5" fill="currentColor" fontFamily="monospace" fontWeight="700">ECU</text>
                {/* Stub nodo 2 — arriba centro */}
                <line x1="40" y1="30" x2="40" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <rect x="33" y="7" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                <text x="40" y="14.5" textAnchor="middle" fontSize="4.5" fill="currentColor" fontFamily="monospace" fontWeight="700">ABS</text>
                {/* Stub nodo 3 — arriba der */}
                <line x1="60" y1="30" x2="60" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <rect x="53" y="7" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                <text x="60" y="14.5" textAnchor="middle" fontSize="4.5" fill="currentColor" fontFamily="monospace" fontWeight="700">BCM</text>
                {/* Stub nodo 4 — abajo centro */}
                <line x1="40" y1="30" x2="40" y2="46" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <rect x="33" y="43" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                <text x="40" y="50.5" textAnchor="middle" fontSize="4.5" fill="currentColor" fontFamily="monospace" fontWeight="700">OBD</text>
                {/* Puntos de unión al bus */}
                <circle cx="20" cy="30" r="2.2" fill="currentColor"/>
                <circle cx="40" cy="30" r="2.2" fill="currentColor"/>
                <circle cx="60" cy="30" r="2.2" fill="currentColor"/>
              </svg>
            </span>
            <p>Sin datos de escaneo. Presiona <strong>Escanear</strong> para comenzar.</p>
          </div>
        ) : totalCodes === 0 ? (
          <div className="ce-page-empty">
            <span className="ce-page-empty-icon">🔧</span>
            <p>El motor está en orden.</p>
          </div>
        ) : (
          <div className="ce-page-columns">
            {/* Confirmados */}
            {codigos.length > 0 && (
              <div className="ce-page-col">
                <div className="ce-page-col-header ce-col-confirmed">
                  ⚠️ Confirmados (Mode 03) — {codigos.length} código{codigos.length !== 1 ? 's' : ''}
                </div>
                <div className="ce-page-cards">
                  {[...codigos].sort((a, b) => {
                    const order = { critical: 0, high: 1, medium: 2, low: 3 };
                    return (order[getCodeMeta(a.code).severity] ?? 4) - (order[getCodeMeta(b.code).severity] ?? 4);
                  }).map(c => {
                    const meta   = getCodeMeta(c.code);
                    const isOpen = expandedCodes.has(c.code);
                    return (
                      <div key={c.code}
                        className={`ce-page-card ce-card-v2 ce-card-v2-${meta.severity}${isOpen ? ' is-open' : ''}`}
                        onClick={() => toggleCode(c.code)}
                      >
                        <div className="ce-v2-top">
                          <div className="ce-v2-left">
                            <span className="ce-v2-code">{c.code}</span>
                            <span className={`ce-v2-sev ce-v2-sev-${meta.severity}`}>{meta.sevLabel}</span>
                          </div>
                          <div className="ce-v2-center">
                            <span className="ce-v2-desc">{c.desc}</span>
                          </div>
                          <span className="ce-v2-arrow">{isOpen ? '▲' : '▼'}</span>
                        </div>
                        {isOpen && (
                          <div className="ce-v2-detail">
                            {c.rec && <div className="ce-v2-rec">{c.rec}</div>}
                            <div className={`ce-v2-meta ce-v2-meta-${meta.severity}`}>
                              {meta.icon} {meta.label}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pendientes */}
            {pendientes.length > 0 && (
              <div className="ce-page-col">
                <div className="ce-page-col-header ce-col-pending">
                  ⏳ Pendientes (Mode 07) — {pendientes.length} código{pendientes.length !== 1 ? 's' : ''}
                </div>
                <div className="ce-page-cards">
                  {[...pendientes].sort((a, b) => {
                    const order = { critical: 0, high: 1, medium: 2, low: 3 };
                    return (order[getCodeMeta(a.code).severity] ?? 4) - (order[getCodeMeta(b.code).severity] ?? 4);
                  }).map(c => {
                    const meta   = getCodeMeta(c.code);
                    const isOpen = expandedCodes.has(c.code + '_p');
                    return (
                      <div key={c.code}
                        className={`ce-page-card ce-card-v2 ce-card-v2-pending${isOpen ? ' is-open' : ''}`}
                        onClick={() => toggleCode(c.code + '_p')}
                      >
                        <div className="ce-v2-top">
                          <div className="ce-v2-left">
                            <span className="ce-v2-code">{c.code}</span>
                            <span className="ce-v2-sev ce-v2-sev-pending">Pendiente</span>
                          </div>
                          <div className="ce-v2-center">
                            <span className="ce-v2-desc">{c.desc}</span>
                          </div>
                          <span className="ce-v2-arrow">{isOpen ? '▲' : '▼'}</span>
                        </div>
                        {isOpen && (
                          <div className="ce-v2-detail">
                            {c.rec && <div className="ce-v2-rec ce-v2-rec-pending">{c.rec}</div>}
                            <div className="ce-v2-meta ce-v2-meta-pending">
                              {meta.icon} {meta.label} — No confirmado
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Acciones fijas abajo ── */}
      <div className="ce-page-footer">
        <button className="ce-page-btn ce-page-btn-scan" onClick={handleEscanear} disabled={escaneando || borrando}>
          {escaneando ? 'Escaneando...' : checkEngine === null ? 'Escanear' : 'Re-escanear'}
        </button>
        {checkEngine && (checkEngine.mil || pendientes.length > 0) && (
          <button className="ce-page-btn ce-page-btn-clear" onClick={handleBorrar} disabled={escaneando || borrando}>
            {borrando ? 'Borrando...' : 'Borrar Códigos'}
          </button>
        )}
      </div>
    </div>
  );
}
