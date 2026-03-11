import React, { useEffect, useState } from 'react';
import { getDatosObd2, toggleMotor, escanearCodigos, borrarCodigos } from './services/obd2Service';
import Tacometro from './Tacometro';
import Velocimetro from './Velocimetro';
import './duoHome.css';

function Home() {
  const [datos, setDatos] = useState({});
  const [motor, setMotor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkEngine, setCheckEngine] = useState(null); // null = sin escanear
  const [escaneando, setEscaneando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    let activo = true;
    let timeoutId = null;

    const fetchDatos = async () => {
      try {
        const data = await getDatosObd2();
        if (!activo) return;
        setDatos(data);
        if (data.motor !== undefined) setMotor(data.motor === 'Encendido');
      } catch (_) {
        // silencia errores de red puntuales
      } finally {
        // Solo programa la siguiente petición DESPUÉS de que la anterior terminó
        if (activo) timeoutId = setTimeout(fetchDatos, 500);
      }
    };

    fetchDatos();
    return () => { activo = false; clearTimeout(timeoutId); };
  }, []);

  const handleToggleMotor = async () => {
    setLoading(true);
    const res = await toggleMotor();
    if (res.motor !== undefined) setMotor(res.motor === 'Encendido');
    const data = await getDatosObd2();
    setDatos(data);
    if (data.motor !== undefined) setMotor(data.motor === 'Encendido');
    setLoading(false);
  };

  const handleEscanear = async () => {
    setEscaneando(true);
    const res = await escanearCodigos();
    if (!res.error) setCheckEngine(res);
    setEscaneando(false);
  };

  const handleBorrar = async () => {
    setBorrando(true);
    const res = await borrarCodigos();
    if (!res.error) setCheckEngine(res);
    setBorrando(false);
  };

  return (
    <>
      {datos.vehiculo && getLogoPorMarca(datos.vehiculo.marca) && (
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

      {datos.error ? (
        <span className="duo-error">{datos.error}</span>
      ) : (
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
              <button
                onClick={handleToggleMotor}
                disabled={loading}
                className={`ignition-btn ${motor ? 'ignition-on' : 'ignition-off'}`}
                title={motor ? 'Apagar motor' : 'Encender motor'}
              >
                <svg viewBox="0 0 44 44" className="ignition-icon">
                  <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="2.5"/>
                  <path d="M22 8 L22 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  <path d="M13.5 12.5 A13 13 0 1 0 30.5 12.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
              <span className={`ignition-label ${motor ? 'ignition-label-on' : 'ignition-label-off'}`}>
                {motor ? 'Encendido' : 'Apagado'}
              </span>
            </div>
          </div>

          <div className="duo-stats-row">
            {datos["0105"] && (
              <div className="duo-stat-card">
                <span className="duo-stat-icon">🌡️</span>
                <span className="duo-stat-label">Temperatura</span>
                <span className="duo-stat-value">{datos["0105"].valor}</span>
                <span className="duo-stat-badge" style={{ color: colorTemperatura(datos["0105"].valor) }}>{estadoTemperatura(datos["0105"].valor)}</span>
              </div>
            )}
            {datos["015E"] && (
              <div className="duo-stat-card">
                <span className="duo-stat-icon">⛽</span>
                <span className="duo-stat-label">Consumo</span>
                <span className="duo-stat-value">{datos["015E"].valor}</span>
              </div>
            )}
            {datos["0101"] && (
              <div className="duo-stat-card">
                <span className="duo-stat-icon">⚠️</span>
                <span className="duo-stat-label">Check Engine</span>
                <span className="duo-stat-value" style={{
                  color: checkEngine === null ? '#aaa'
                       : checkEngine.mil ? '#ff1744'
                       : '#00e676'
                }}>
                  {checkEngine === null
                    ? 'Sin escanear'
                    : checkEngine.mil
                      ? `ENCENDIDO (${checkEngine.codigos.length})`
                      : 'APAGADO'}
                </span>
              </div>
            )}
            {datos["0142"] && (
              <div className="duo-stat-card">
                <span className="duo-stat-icon">🔋</span>
                <span className="duo-stat-label">Batería</span>
                <span className="duo-stat-value">{decodificarVoltaje(datos["0142"].valor)}</span>
                <span className="duo-stat-badge" style={{ color: colorBateria(datos["0142"].valor) }}>{estadoBateria(datos["0142"].valor)}</span>
              </div>
            )}
          </div>

          {/* ===== PANEL CHECK ENGINE ===== */}
          <div className="ce-panel">
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
                  : 'ce-badge-ok'
                }`}>
                  {checkEngine === null
                    ? 'Sin escanear'
                    : checkEngine.mil
                      ? `${checkEngine.codigos.length} código${checkEngine.codigos.length !== 1 ? 's' : ''} encontrado${checkEngine.codigos.length !== 1 ? 's' : ''}`
                      : 'Sin fallas detectadas'}
                </span>
              </div>
            </div>

            {checkEngine && checkEngine.codigos.length > 0 && (
              <div className="ce-codes-list">
                {checkEngine.codigos.map(c => (
                  <div key={c.code} className="ce-code-item">
                    <span className="ce-code-id">{c.code}</span>
                    <span className="ce-code-desc">{c.desc}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="ce-actions">
              <button className="ce-btn ce-btn-scan" onClick={handleEscanear} disabled={escaneando || borrando}>
                {escaneando ? 'Escaneando...' : 'Escanear'}
              </button>
              {checkEngine && checkEngine.mil && (
                <button className="ce-btn ce-btn-clear" onClick={handleBorrar} disabled={escaneando || borrando}>
                  {borrando ? 'Borrando...' : 'Borrar Códigos'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
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


// Decodifica voltaje batería
function decodificarVoltaje(valor) {
  const datos = valor.split(' ');

  let byte = null;

  if (datos.length >= 3) {
    byte = parseInt(datos[2], 16);
  } else if (datos.length >= 1) {
    byte = parseInt(datos[0], 16);
  }

  if (!isNaN(byte) && byte !== null) {
    const voltaje = (byte * 0.01).toFixed(2);
    return voltaje + ' V';
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

// Estado de batería según voltaje
function estadoBateria(valor) {
  const datos = valor.split(' ');
  let byte = null;
  if (datos.length >= 3) byte = parseInt(datos[2], 16);
  else if (datos.length >= 1) byte = parseInt(datos[0], 16);
  if (isNaN(byte) || byte === null) return "";
  const v = byte * 0.01;
  if (v < 11.8) return "Muerta";
  if (v < 12.2) return "Desgastada";
  if (v < 12.5) return "Normal";
  return "Buena";
}

// Color de batería según voltaje
function colorBateria(valor) {
  const datos = valor.split(' ');
  let byte = null;
  if (datos.length >= 3) byte = parseInt(datos[2], 16);
  else if (datos.length >= 1) byte = parseInt(datos[0], 16);
  if (isNaN(byte) || byte === null) return "#aaa";
  const v = byte * 0.01;
  if (v < 11.8) return "#ff1744";
  if (v < 12.2) return "#ff9100";
  if (v < 12.5) return "#fff176";
  return "#00e676";
}

export default Home;