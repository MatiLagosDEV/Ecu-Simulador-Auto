import React, { useEffect, useState, useRef } from 'react';
import { getDatosObd2, escanearCodigos, borrarCodigos, getEstadoMotor } from './services/obd2Service';
import Tacometro from './Tacometro';
import Velocimetro from './Velocimetro';
import CheckEnginePage from './CheckEnginePage';
import SensoresAvanzadosPage from './SensoresAvanzadosPage';
import ConfirmBorrarModal from './ConfirmBorrarModal';
import './duoHome.css';

// Secuencia overlay primera conexión
const PASOS_CONTACTO = [
  { pct: 0,   msg: 'Buscando protocolo de comunicación...' },
  { pct: 20,  msg: 'Buscando protocolo de comunicación...' },
  { pct: 40,  msg: 'Protocolo CAN Bus detectado (ISO 15765-4).' },
  { pct: 70,  msg: 'Vinculando con ECU del motor...' },
  { pct: 100, msg: '¡Conexión Exitosa!' },
];

// Mensajes rotativos mientras el motor está en CONTACTO (arrancando)
const MSGS_CONTACTO = [
  'Comunicando con la ECU del vehículo...',
  'Leyendo parámetros del motor...',
  'Verificando sensores OBD-II...',
  'Esperando respuesta de la unidad de control...',
  'Sincronizando protocolo CAN Bus...',
];

// Estructura de datos vacíos por defecto — el dashboard siempre se renderiza
const DATOS_VACIOS = {
  '010C': { nombre: 'RPM',         valor: '0 rpm'  },
  '010D': { nombre: 'Velocidad',   valor: '0 km/h' },
  '0105': { nombre: 'Temperatura', valor: '0 °C'   },
  '015E': { nombre: 'Consumo',     valor: '0'      },
  '0101': { nombre: 'Check Engine',valor: 'APAGADO'},
  '0142': { nombre: 'Batería',     valor: '0'      },
  vehiculo: { vin: '-', marca: '-', pais: '-', año: '-', modelo: '-', motor: '-' },
  motor: 'Apagado',
};

// ── Helpers para tarjetas OBD2 ──────────────────────────────────────────── //
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
    else if (num >= 500 && num <= 599)
      severity = 'medium';
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
// ──────────────────────────────────────────────────────────────────────────── //

function Home() {
  const [datos, setDatos] = useState(DATOS_VACIOS);
  const [estadoMotor, setEstadoMotor] = useState('APAGADO'); // 'APAGADO' | 'CONTACTO' | 'ENCENDIDO'
  const [tipoConexion, setTipoConexion] = useState(null); // 'USB' | 'Bluetooth' | 'Serial'
  const [servidorOnline, setServidorOnline] = useState(false);
  const [checkEngine, setCheckEngine] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [modalBorrar, setModalBorrar] = useState(false);
  const [expandedCodes, setExpandedCodes] = useState(new Set());
  const [paginaCE, setPaginaCE] = useState(false);
  const [paginaSensores, setPaginaSensores] = useState(false);

  const toggleCode = (code) => setExpandedCodes(prev => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  // Overlay primera conexión (APAGADO → CONTACTO)
  const [overlayConexionVisible, setOverlayConexionVisible] = useState(false);
  const [overlayPct, setOverlayPct] = useState(0);
  const [overlayMsg, setOverlayMsg] = useState('');
  const overlayConexionDoneRef = useRef(false);

  // Overlay ciclo de arranque (ENCENDIDO → CONTACTO)
  const [overlayArranqueVisible, setOverlayArranqueVisible] = useState(false);
  const [overlayMsgIdx, setOverlayMsgIdx] = useState(0);
  const overlayMsgRef = useRef(null);

  // Overlay escaneo Check Engine
  const [overlayEscaneoVisible, setOverlayEscaneoVisible] = useState(false);
  const [overlayEscaneoPct, setOverlayEscaneoPct] = useState(0);
  const [overlayEscaneoMsg, setOverlayEscaneoMsg] = useState('');

  // Referencia al estado anterior
  const prevEstadoRef = useRef('APAGADO');

  // Animación barra de progreso primera conexión
  const lanzarOverlayConexion = () => {
    overlayConexionDoneRef.current = false;
    setOverlayPct(0);
    setOverlayMsg(PASOS_CONTACTO[0].msg);
    setOverlayConexionVisible(true);
    let i = 0;
    const avanzar = () => {
      if (i >= PASOS_CONTACTO.length) {
        setTimeout(() => {
          setOverlayConexionVisible(false);
          overlayConexionDoneRef.current = true;
        }, 1200);
        return;
      }
      const paso = PASOS_CONTACTO[i];
      setOverlayPct(paso.pct);
      setOverlayMsg(paso.msg);
      i++;
      setTimeout(avanzar, paso.pct === 100 ? 0 : 700);
    };
    avanzar();
  };

  // Mensajes rotativos overlay ciclo arranque
  useEffect(() => {
    if (overlayArranqueVisible) {
      setOverlayMsgIdx(0);
      overlayMsgRef.current = setInterval(() => {
        setOverlayMsgIdx(i => (i + 1) % MSGS_CONTACTO.length);
      }, 2200);
    } else {
      clearInterval(overlayMsgRef.current);
    }
    return () => clearInterval(overlayMsgRef.current);
  }, [overlayArranqueVisible]);

  // ─── Polling de datos OBD-II con backoff exponencial ───
  useEffect(() => {
    let activo = true;
    let timeoutId = null;
    let intervalo = 500;          // ms base cuando hay conexión
    const INTERVALO_MIN  =  500;  // ms cuando el servidor responde
    const INTERVALO_MAX  = 8000;  // ms máximo cuando está caído

    const fetchDatos = async () => {
      try {
        const [data, estadoData] = await Promise.all([getDatosObd2(), getEstadoMotor()]);
        if (!activo) return;

        // Solo actualizar datos si el servidor respondió correctamente
        if (!data.error) {
          setDatos(data);
          setServidorOnline(true);
          intervalo = INTERVALO_MIN; // volver al ritmo rápido
        } else {
          setServidorOnline(false);
          intervalo = Math.min(intervalo * 2, INTERVALO_MAX); // backoff
        }

        const nuevoEstado = estadoData.estado ?? 'APAGADO';
        const estadoAnterior = prevEstadoRef.current;

        // Primera conexión: APAGADO/CONECTANDO → CONTACTO
        if (
          (estadoAnterior === 'APAGADO' || estadoAnterior === 'CONECTANDO') &&
          (nuevoEstado === 'CONTACTO' || nuevoEstado === 'ENCENDIDO') &&
          !overlayConexionDoneRef.current
        ) {
          lanzarOverlayConexion();
        }

        // Ciclo arranque: CONTACTO → ENCENDIDO (se detectan las RPM)
        if (estadoAnterior === 'CONTACTO' && nuevoEstado === 'ENCENDIDO' && overlayConexionDoneRef.current) {
          setOverlayArranqueVisible(true);
          setTimeout(() => setOverlayArranqueVisible(false), 3000);
        }
        // Reset bandera primera conexión cuando vuelve a APAGADO
        if (nuevoEstado === 'APAGADO') {
          overlayConexionDoneRef.current = false;
          setOverlayArranqueVisible(false);
        }

        prevEstadoRef.current = nuevoEstado;
        setEstadoMotor(nuevoEstado);
        if (estadoData.conexion) setTipoConexion(estadoData.conexion);
      } catch (_) {
        // ERR_CONNECTION_REFUSED u otro error de red: aplicar backoff
        if (!activo) return;
        setServidorOnline(false);
        intervalo = Math.min(intervalo * 2, INTERVALO_MAX);
      } finally {
        if (activo) timeoutId = setTimeout(fetchDatos, intervalo);
      }
    };

    fetchDatos();
    return () => { activo = false; clearTimeout(timeoutId); };
  }, []);

  const PASOS_ESCANEO = [
    { pct: 0,   msg: 'Iniciando diagnóstico OBD-II...' },
    { pct: 15,  msg: 'Solicitando códigos de falla almacenados (Mode 03)...' },
    { pct: 40,  msg: 'Leyendo Freeze Frame data (estado de sensores al momento del fallo)...' },
    { pct: 65,  msg: 'Verificando estado de monitores (Catalizador, Evap, O2)...' },
    { pct: 85,  msg: 'Comprobando códigos pendientes (Mode 07)...' },
    { pct: 100, msg: 'Escaneo completado.' },
  ];

  const handleEscanear = async () => {
    setEscaneando(true);
    setOverlayEscaneoPct(0);
    setOverlayEscaneoMsg(PASOS_ESCANEO[0].msg);
    setOverlayEscaneoVisible(true);

    // Animar pasos intermedios antes de lanzar la petición real
    const animarPasos = (pasos, idx, cb) => {
      if (idx >= pasos.length) { cb(); return; }
      setOverlayEscaneoPct(pasos[idx].pct);
      setOverlayEscaneoMsg(pasos[idx].msg);
      setTimeout(() => animarPasos(pasos, idx + 1, cb), 900);
    };

    // Lanzar petición real en paralelo con la animación
    const resPromise = escanearCodigos();

    await new Promise(resolve => animarPasos(PASOS_ESCANEO, 1, resolve));

    const res = await resPromise;
    if (!res.error) setCheckEngine(res);

    setTimeout(() => {
      setOverlayEscaneoVisible(false);
      setEscaneando(false);
    }, 900);
  };

  const handleEscanearYAbrir = async () => {
    setEscaneando(true);
    setOverlayEscaneoPct(0);
    setOverlayEscaneoMsg(PASOS_ESCANEO[0].msg);
    setOverlayEscaneoVisible(true);

    const animarPasos = (pasos, idx, cb) => {
      if (idx >= pasos.length) { cb(); return; }
      setOverlayEscaneoPct(pasos[idx].pct);
      setOverlayEscaneoMsg(pasos[idx].msg);
      setTimeout(() => animarPasos(pasos, idx + 1, cb), 900);
    };

    const resPromise = escanearCodigos();
    await new Promise(resolve => animarPasos(PASOS_ESCANEO, 1, resolve));
    const res = await resPromise;
    if (!res.error) setCheckEngine(res);

    setTimeout(() => {
      setOverlayEscaneoVisible(false);
      setEscaneando(false);
      setPaginaCE(true);
    }, 900);
  };

  // Lógica real de borrado — invocada desde el modal
  const executeBorrado = async () => {
    const res = await borrarCodigos();
    if (!res.error) setCheckEngine({ mil: false, codigos: [], pendientes: [], freeze_frame: null });
  };

  // Abre el modal de confirmación en lugar de borrar directamente
  const handleBorrar = () => setModalBorrar(true);

  return (
    <>
      {/* ===== OVERLAY PRIMERA CONEXIÓN (APAGADO → CONTACTO) ===== */}
      {overlayConexionVisible && (
        <div className="contacto-overlay">
          <div className="contacto-box">
            <div className="contacto-logo-ring">
              <svg viewBox="0 0 80 80" className="contacto-spinner-svg">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(33,150,243,0.18)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#2196f3" strokeWidth="6"
                  strokeDasharray={`${overlayPct * 2.136} 213.6`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.6s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <span className="contacto-pct">{overlayPct}%</span>
            </div>
            <p className="contacto-title">Estableciendo conexión OBD-II</p>
            <p className="contacto-msg">{overlayMsg}</p>
            <div className="contacto-bar-track">
              <div className="contacto-bar-fill" style={{ width: `${overlayPct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ===== OVERLAY ESCANEO CHECK ENGINE ===== */}
      {overlayEscaneoVisible && (
        <div className="contacto-overlay">
          <div className="contacto-box scan-box">
            <div className="contacto-logo-ring">
              <svg viewBox="0 0 80 80" className="contacto-spinner-svg">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,167,38,0.18)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#ffa726" strokeWidth="6"
                  strokeDasharray={`${overlayEscaneoPct * 2.136} 213.6`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.7s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <span className="contacto-pct scan-pct">{overlayEscaneoPct}%</span>
            </div>
            <p className="contacto-title scan-title">Diagnóstico OBD-II</p>
            <p className="contacto-msg">{overlayEscaneoMsg}</p>
            <div className="contacto-bar-track">
              <div className="contacto-bar-fill scan-bar-fill" style={{ width: `${overlayEscaneoPct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ===== OVERLAY CICLO ARRANQUE (ENCENDIDO → CONTACTO) ===== */}
      {overlayArranqueVisible && (
        <div className="contacto-overlay">
          <div className="contacto-box">
            <div className="contacto-logo-ring">
              <svg viewBox="0 0 80 80" className="contacto-spinner-svg">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(33,150,243,0.18)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#2196f3" strokeWidth="6"
                  strokeDasharray="80 213.6"
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', animation: 'obd-spin 1.4s linear infinite' }}
                />
              </svg>
              <svg viewBox="0 0 36 32" className="contacto-obd-icon" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="keyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#42a5f5"/>
                    <stop offset="100%" stopColor="#0d47a1"/>
                  </linearGradient>
                  <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#90caf9"/>
                    <stop offset="100%" stopColor="#1565c0" stopOpacity="0.4"/>
                  </linearGradient>
                </defs>
                {/* fob body */}
                <rect x="1" y="9" width="15" height="14" rx="4" fill="url(#keyGrad)" opacity="0.85"/>
                <rect x="1" y="9" width="15" height="14" rx="4" stroke="#64b5f6" strokeWidth="1.2" fill="none"/>
                {/* logo circle center */}
                <circle cx="8.5" cy="16" r="3.5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                <circle cx="8.5" cy="16" r="1.5" fill="rgba(255,255,255,0.6)"/>
                {/* lock/unlock dots */}
                <circle cx="3.8" cy="21" r="0.9" fill="rgba(255,255,255,0.5)"/>
                <circle cx="6.2" cy="21" r="0.9" fill="rgba(255,255,255,0.35)"/>
                {/* blade */}
                <path d="M16 16 L32 16" stroke="url(#bladeGrad)" strokeWidth="2.6"/>
                {/* cuts */}
                <line x1="20" y1="16" x2="20" y2="13.2" stroke="#64b5f6" strokeWidth="1.5"/>
                <line x1="23.5" y1="16" x2="23.5" y2="13.8" stroke="#64b5f6" strokeWidth="1.5"/>
                <line x1="26.5" y1="16" x2="26.5" y2="13.2" stroke="#64b5f6" strokeWidth="1.5"/>
                <line x1="29.5" y1="16" x2="29.5" y2="13.8" stroke="#64b5f6" strokeWidth="1.5"/>
                {/* tip redondeada */}
                <path d="M31.5 14 Q34 16 31.5 18" fill="rgba(33,150,243,0.2)" stroke="#90caf9" strokeWidth="1.4"/>
              </svg>
            </div>
            <p className="contacto-title">Arrancando</p>
            <p className="contacto-msg">{MSGS_CONTACTO[overlayMsgIdx]}</p>
            <div className="contacto-bar-track">
              <div className="contacto-bar-fill contacto-bar-indeterminate" />
            </div>
          </div>
        </div>
      )}

      {servidorOnline && datos.vehiculo && getLogoPorMarca(datos.vehiculo.marca) && (
        <div className="duo-corner-logo-wrap">
          <img
            src={getLogoPorMarca(datos.vehiculo.marca)}
            alt={datos.vehiculo.marca}
            className="duo-corner-logo"
            onError={e => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}
      <div className="duo-bg">
      <h1 className="duo-title">Simulador OBD-II Engine</h1>

      <>
          {datos.vehiculo && (
            <div className="duo-pill-row">
              <div className="duo-pill">
                <span className="duo-pill-label">VIN</span> <span className="duo-pill-value">{datos.vehiculo.vin}</span>
                <span className="duo-pill-sep" />
                <span className="duo-pill-label">{datos.vehiculo.marca}</span>
                <span className="duo-pill-sep" />
                <span className="duo-pill-label">{datos.vehiculo.modelo}</span>
                <span className="duo-pill-sep" />
                <span className="duo-pill-label">{datos.vehiculo.año}</span>
                <span className="duo-pill-sep" />
                <span className="duo-pill-label">{datos.vehiculo.pais}</span>
              </div>
              {datos.vehiculo.motor && datos.vehiculo.motor !== '-' && (
                <div className="duo-pill duo-pill-motor">
                  <span className="duo-pill-motor-icon">⚙️</span>
                  <span className="duo-pill-label duo-pill-motor-label">Motor</span>
                  <span className="duo-pill-sep" />
                  <span className="duo-pill-value">{datos.vehiculo.motor}</span>
                </div>
              )}
            </div>
          )}

          {/* ===== SENSORES AVANZADOS PAGE (pantalla completa) ===== */}
          {paginaSensores && (
            <SensoresAvanzadosPage
              datos={datos}
              onVolver={() => setPaginaSensores(false)}
            />
          )}

          {/* ===== CHECK ENGINE PAGE (pantalla completa) ===== */}
          {paginaCE && (
            <CheckEnginePage
              checkEngine={checkEngine}
              escaneando={escaneando}
              borrando={borrando}
              expandedCodes={expandedCodes}
              toggleCode={toggleCode}
              handleEscanear={handleEscanear}
              handleBorrar={handleBorrar}
              onVolver={() => setPaginaCE(false)}
            />
          )}

          {/* ===== CHECK ENGINE PANEL (oculto — movido a página propia) ===== */}
          {false && servidorOnline && (
            <div className="ce-panel ce-panel-side">
                <div className="ce-header">
                  <svg
                    className={`ce-light ${checkEngine === null ? 'ce-unknown' : checkEngine.mil ? 'ce-on' : 'ce-ok'}`}
                    viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M13 4 L13 9 L4 9 L4 21 L36 21 L36 9 L27 9 L27 4 Z"
                      stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>
                    <line x1="1" y1="13" x2="4" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="1" y1="17" x2="4" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="36" y1="13" x2="39" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="36" y1="17" x2="39" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="20" cy="15" r="3" fill="currentColor"/>
                  </svg>
                  <div className="ce-title-group">
                    <span className="ce-title">Check Engine</span>
                    <span className={`ce-badge ${
                      checkEngine === null ? 'ce-badge-unknown'
                      : checkEngine.mil ? 'ce-badge-on'
                      : (checkEngine.pendientes?.length ?? 0) > 0 ? 'ce-badge-pending'
                      : 'ce-badge-ok'
                    }`}>
                      {checkEngine === null
                        ? 'Sin escanear'
                        : checkEngine.mil
                          ? `${checkEngine.codigos.length} confirm.${(checkEngine.pendientes?.length ?? 0) > 0 ? ` · ${checkEngine.pendientes.length} pend.` : ''}`
                          : (checkEngine.pendientes?.length ?? 0) > 0
                            ? `${checkEngine.pendientes.length} pendiente${checkEngine.pendientes.length !== 1 ? 's' : ''}`
                            : 'Sin fallas'}
                    </span>
                  </div>
                </div>

                {checkEngine && checkEngine.codigos.length > 0 ? (
                  <div className="ce-codes-list">
                    <div className="ce-section-label ce-section-confirmed">
                      ⚠️ Confirmados (Mode 03)
                    </div>
                    {checkEngine.codigos.map(c => {
                      const meta   = getCodeMeta(c.code);
                      const isOpen = expandedCodes.has(c.code);
                      return (
                        <div key={c.code}
                          className={`ce-card ce-sev-${meta.severity}${isOpen ? ' is-open' : ''}`}
                          onClick={() => toggleCode(c.code)}
                        >
                          <div className="ce-card-top">
                            <span className="ce-cat-icon" title={meta.label}>{meta.icon}</span>
                            <div className="ce-card-info">
                              <div className="ce-card-row1">
                                <span className={`ce-code-pill ce-pill-${meta.severity}`}>{c.code}</span>
                                <span className={`ce-sev-chip ce-sev-chip-${meta.severity}`}>{meta.sevLabel}</span>
                              </div>
                              <span className="ce-short-desc">{c.desc}</span>
                            </div>
                            <span className="ce-expand-arrow">{isOpen ? '▲' : '▼'}</span>
                          </div>
                          {isOpen && (
                            <div className="ce-card-detail">
                              {c.rec && <div className="ce-rec-block">🔧 {c.rec}</div>}
                              <div className={`ce-sev-label-full ce-sev-full-${meta.severity}`}>
                                Gravedad: {meta.sevLabel} · {meta.label}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="ce-no-codes">
                    {checkEngine === null ? 'Sin escanear' : 'Sin fallas detectadas'}
                  </div>
                )}

                {checkEngine && checkEngine.pendientes && checkEngine.pendientes.length > 0 && (
                  <div className="ce-codes-list">
                    <div className="ce-section-label ce-section-pending">
                      ⏳ Pendientes (Mode 07)
                    </div>
                    {checkEngine.pendientes.map(c => {
                      const meta   = getCodeMeta(c.code);
                      const isOpen = expandedCodes.has(c.code + '_p');
                      return (
                        <div key={c.code}
                          className={`ce-card ce-card-pending${isOpen ? ' is-open' : ''}`}
                          onClick={() => toggleCode(c.code + '_p')}
                        >
                          <div className="ce-card-top">
                            <span className="ce-cat-icon" title={meta.label}>{meta.icon}</span>
                            <div className="ce-card-info">
                              <div className="ce-card-row1">
                                <span className="ce-code-pill ce-pill-pending">{c.code}</span>
                                <span className="ce-sev-chip ce-sev-chip-pending">Pendiente</span>
                              </div>
                              <span className="ce-short-desc">{c.desc}</span>
                            </div>
                            <span className="ce-expand-arrow">{isOpen ? '▲' : '▼'}</span>
                          </div>
                          {isOpen && (
                            <div className="ce-card-detail">
                              {c.rec && <div className="ce-rec-block ce-rec-pending">🔧 {c.rec}</div>}
                              <div className="ce-sev-label-full ce-sev-full-pending">
                                Estado: No confirmado · {meta.label}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="ce-actions">
                  <button className="ce-btn ce-btn-scan" onClick={handleEscanear} disabled={escaneando || borrando}>
                    {escaneando ? 'Escaneando...' : 'Escanear'}
                  </button>
                  {checkEngine && (checkEngine.mil || (checkEngine.pendientes?.length ?? 0) > 0) && (
                    <button className="ce-btn ce-btn-clear" onClick={handleBorrar} disabled={escaneando || borrando}>
                      {borrando ? 'Borrando...' : 'Borrar Códigos'}
                    </button>
                  )}
                </div>
            </div>
          )}

          <div className="duo-gauges-wrapper">
            <div className="duo-gauges-row">
              {datos["010C"] && (
                <Tacometro rpm={parseInt(decodificarRpm(datos["010C"].valor)) || 0} />
              )}
              {datos["010D"] && (
                <Velocimetro velocidad={parseInt(datos["010D"].valor) || 0} />
              )}
            </div>

            <div className="duo-ignition-area">
              <div
                className={`ignition-btn ${
                  estadoMotor === 'ENCENDIDO' ? 'ignition-on'
                  : estadoMotor === 'CONTACTO' ? 'ignition-contact'
                  : estadoMotor === 'CONECTANDO' ? 'ignition-contact'
                  : 'ignition-off'
                }`}
              >
                <svg viewBox="0 0 44 44" className="ignition-icon">
                  <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="2.5"/>
                  <path d="M22 8 L22 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  <path d="M13.5 12.5 A13 13 0 1 0 30.5 12.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className={`ignition-label ${
                estadoMotor === 'ENCENDIDO' ? 'ignition-label-on'
                : estadoMotor === 'CONTACTO' ? 'ignition-label-contact'
                : estadoMotor === 'CONECTANDO' ? 'ignition-label-contact'
                : 'ignition-label-off'
              }`}>
                {estadoMotor === 'ENCENDIDO' ? 'Encendido'
                 : estadoMotor === 'CONTACTO' ? 'Contacto'
                 : estadoMotor === 'CONECTANDO' ? 'Buscando...'
                 : 'Apagado'}
              </span>
              {servidorOnline && tipoConexion && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600,
                  color: tipoConexion === 'Bluetooth' ? '#ce93d8' : '#81d4fa',
                  marginTop: '0.2rem', letterSpacing: '0.04em',
                }}>
                  {tipoConexion}
                </span>
              )}

            </div>
          </div>

          <div className="duo-stats-row">
            {/* ── Mini-tarjeta Check Engine ── */}
            {servidorOnline && (
              <div
                className={`ce-stat-card${checkEngine?.mil ? ' ce-mil-activo' : ''}`}
                onClick={() => setPaginaCE(true)}
              >
                <span className="ce-stat-icon">
                  <svg viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg"
                    style={{
                      width: '3.8rem', height: '2.7rem',
                      color: checkEngine?.mil ? '#ff5252'
                           : (checkEngine?.pendientes?.length ?? 0) > 0 ? '#ffc107'
                           : '#42a5f5',
                      filter: checkEngine?.mil
                        ? 'drop-shadow(0 0 6px rgba(255,82,82,0.8))'
                        : (checkEngine?.pendientes?.length ?? 0) > 0
                          ? 'drop-shadow(0 0 6px rgba(255,193,7,0.7))'
                          : 'drop-shadow(0 0 6px rgba(66,165,245,0.6))',
                      transition: 'color 0.3s, filter 0.3s',
                    }}
                  >
                    <path d="M13 4 L13 9 L4 9 L4 21 L36 21 L36 9 L27 9 L27 4 Z"
                      stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
                    <line x1="1" y1="13" x2="4" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="1" y1="17" x2="4" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="36" y1="13" x2="39" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="36" y1="17" x2="39" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="20" cy="15" r="3" fill="currentColor"/>
                  </svg>
                </span>
                <span className="ce-stat-label">Check Engine</span>
                {checkEngine === null ? (
                  <span className="ce-stat-count-ok">Sin escanear</span>
                ) : checkEngine.mil ? (
                  <span className="ce-stat-count">{checkEngine.codigos.length} código{checkEngine.codigos.length !== 1 ? 's' : ''}</span>
                ) : (checkEngine.pendientes?.length ?? 0) > 0 ? (
                  <span className="ce-stat-count" style={{color:'#ffa726'}}>{checkEngine.pendientes.length} pendiente{checkEngine.pendientes.length !== 1 ? 's' : ''}</span>
                ) : (
                  <span className="ce-stat-count-ok">Sin fallas</span>
                )}
                <button
                  className="ce-stat-scan-btn ce-stat-scan-btn-blue"
                  onClick={e => { e.stopPropagation(); handleEscanearYAbrir(); }}
                  disabled={escaneando || borrando}
                >
                  {escaneando ? 'Escaneando...' : checkEngine === null ? 'Escanear' : 'Re-escanear'}
                </button>
              </div>
            )}

            {/* ── Mini-tarjeta Sensores Avanzados ── */}
            {servidorOnline && (
              <div
                className="ce-stat-card"
                onClick={() => setPaginaSensores(true)}
              >
                <span className="ce-stat-icon">
                  <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg"
                    style={{ width: '2.6rem', height: '3.1rem', color: '#ffd740',
                      filter: 'drop-shadow(0 0 6px rgba(255,215,64,0.7))' }}>
                    <rect x="4" y="10" width="32" height="34" rx="4" stroke="currentColor" strokeWidth="2.2" fill="none"/>
                    <rect x="8" y="14" width="24" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" fill="rgba(255,215,64,0.1)"/>
                    <text x="20" y="23.5" textAnchor="middle" fontSize="7" fontWeight="700"
                      fill="currentColor" fontFamily="monospace">12.6V</text>
                    <circle cx="20" cy="35" r="5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                    <line x1="20" y1="30" x2="20" y2="32.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="13" y1="44" x2="15" y2="38" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    <line x1="27" y1="44" x2="25" y2="38" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    <line x1="14" y1="10" x2="14" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="26" y1="10" x2="26" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
                <span className="ce-stat-label">Sensores Avanzados</span>
                <span className="ce-stat-count-ok" style={{ color: '#ffd740' }}>12 sensores</span>
                <button
                  className="ce-stat-scan-btn ce-stat-scan-btn-blue"
                  onClick={e => { e.stopPropagation(); setPaginaSensores(true); }}
                >
                  Ver sensores
                </button>
              </div>
            )}

            {datos["0105"] && (
              <div className="duo-stat-card">
                <span className="duo-stat-icon">🌡️</span>
                <span className="duo-stat-label">Temperatura</span>
                <span className="duo-stat-value">{soloTemperatura(datos["0105"].valor)}</span>
                <span className="duo-stat-badge" style={{ color: colorTemperatura(datos["0105"].valor) }}>{estadoTemperatura(datos["0105"].valor)}</span>
              </div>
            )}
            {(datos["consumo_inteligente"] || datos["015E"]) && (() => {
              const ci = datos["consumo_inteligente"];
              const valor = ci ? ci.valor : datos["015E"].valor;
              const metodo = ci ? ci.metodo : null;
              const colorMetodo = metodo === 'MAF' ? '#42a5f5' : metodo === 'MAP' ? '#ffa726' : '#888';
              return (
                <div className="duo-stat-card">
                  <span className="duo-stat-icon">⛽</span>
                  <span className="duo-stat-label">Consumo</span>
                  <span className="duo-stat-value">{valor}</span>
                  {metodo && metodo !== 'N/A' && (
                    <span className="duo-stat-badge" style={{ color: colorMetodo }}>
                      vía {metodo}
                    </span>
                  )}
                </div>
              );
            })()}
            {datos["0142"] && (
              <div className="duo-stat-card">
                <span className="duo-stat-icon">🔋</span>
                <span className="duo-stat-label">Batería</span>
                <span className="duo-stat-value">{datos["0142"].valor}</span>
                <span className="duo-stat-badge" style={{ color: colorBateria(datos["0142"].valor) }}>{estadoBateria(datos["0142"].valor)}</span>
              </div>
            )}
          </div>

        </>    </div>

      {/* ===== MODAL CONFIRMAR BORRADO ===== */}
      {modalBorrar && (
        <ConfirmBorrarModal
          onConfirmar={executeBorrado}
          onCancelar={() => setModalBorrar(false)}
        />
      )}

    </>
  );
}


// Logo de marca por nombre
function getLogoPorMarca(marca) {
  const slugs = {
    'Toyota':      'toyota',
    'Honda':       'honda',
    'Ford':        'ford',
    'Chevrolet':   'chevrolet',
    'Volkswagen':  'volkswagen',
    'BMW':         'bmw',
    'Mercedes':    'mercedes-benz',
    'Mercedes-Benz': 'mercedes-benz',
    'Audi':        'audi',
    'Nissan':      'nissan',
    'Hyundai':     'hyundai',
    'Kia':         'kia',
    'Mazda':       'mazda',
    'Subaru':      'subaru',
    'Jeep':        'jeep',
    'Dodge':       'dodge',
    'Ram':         'ram',
    'Renault':     'renault',
    'Peugeot':     'peugeot',
    'Fiat':        'fiat',
    'Volvo':       'volvo',
    'Porsche':     'porsche',
    'Ferrari':     'ferrari',
    'Lamborghini': 'lamborghini',
    'Mitsubishi':  'mitsubishi',
    'Suzuki':      'suzuki',
    'Lexus':       'lexus',
    'Infiniti':    'infiniti',
    'Acura':       'acura',
    'Cadillac':    'cadillac',
    'Buick':       'buick',
    'Lincoln':     'lincoln',
    'Alfa Romeo':  'alfa-romeo',
    'Seat':        'seat',
    'Skoda':       'skoda',
    'Chery':       'chery',
    'Leapmotor':   'leapmotor',
    'BYD':         'byd',
    'Geely':       'geely',
  };
  const slug = slugs[marca];
  if (!slug) return '';
  return `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${slug}.png`;
}

// Decodifica RPM tipo "41 0C XX YY"
function decodificarRpm(valor) {
  const datos = valor.split(' ');

  if (datos.length >= 4) {
    const A = parseInt(datos[2], 16);
    const B = parseInt(datos[3], 16);

    if (!isNaN(A) && !isNaN(B)) {
      const rpm = ((A * 256) + B) / 4;
      return rpm + ' rpm';
    }
  }

  return valor;
}


// Devuelve estado de temperatura
function estadoTemperatura(valor) {
  if (typeof valor !== 'string') return "";

  const match = valor.match(/(-?\d+)\s*°C/);
  if (!match) return "";

  const temp = parseInt(match[1], 10);

  if (temp < 60) return "Frío";
  if (temp < 105) return "Normal";
  return "Caliente";
}


// Color según temperatura
function colorTemperatura(valor) {
  if (typeof valor !== 'string') return "black";

  const match = valor.match(/(-?\d+)\s*°C/);
  if (!match) return "black";

  const temp = parseInt(match[1], 10);

  if (temp < 60) return "blue";
  if (temp < 105) return "#00e676";
  return "red";
}

// Extrae solo la parte "XX°C" sin el estado entre paréntesis
function soloTemperatura(valor) {
  if (typeof valor !== 'string') return valor;
  const match = valor.match(/-?\d+\s*°C/);
  return match ? match[0] : valor;
}

// Estado de batería según voltaje (valor ya viene como "14.1 V")
function estadoBateria(valor) {
  if (typeof valor !== 'string') return "";
  const m = valor.match(/([\d.]+)/);
  if (!m) return "";
  const v = parseFloat(m[1]);
  if (v < 12.0) return "Muerta";        // muy baja
  if (v < 12.2) return "Desgastada";    // algo descargada
  if (v < 12.6) return "Normal";        // rango típico en contacto
  return "Buena";
}

// Color de batería según voltaje (valor ya viene como "14.1 V")
function colorBateria(valor) {
  if (typeof valor !== 'string') return "#aaa";
  const m = valor.match(/([\d.]+)/);
  if (!m) return "#aaa";
  const v = parseFloat(m[1]);
  if (v < 12.0) return "#ff1744";   // rojo: muy baja
  if (v < 12.2) return "#ff9100";   // naranja: desgastada
  if (v < 12.6) return "#fff176";   // amarillo: normal en reposo
  return "#00e676";
}

export default Home;