import React, { useState } from 'react';
import '../styles/SensoresAvanzadosPage.css';

/* ─────────────────────────────────────────────────
   Helpers para interpolar color según valor/rango
───────────────────────────────────────────────── */
function rangeColor(val, ok, warn, crit) {
  if (val === null || val === undefined) return '#90a4ae';
  if (val >= crit) return '#ef5350';
  if (val >= warn) return '#ffa726';
  return ok;
}

/* Extrae número de un string como "45.3 kPa" → 45.3 */
function parseVal(str) {
  if (!str || str === 'N/A') return null;
  const m = String(str).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

/* ─────────────────────────────────────────────────
   Definición de sensores a mostrar
   pid       → clave en `datos` ó null si viene de consumo_inteligente
   label     → nombre legible
   icon      → emoji
   unit      → unidad (solo informativo)
   categoria → grupo lógico para ordenar en la UI
   desc      → descripción breve del sensor
   badge     → función(valor_num) → {text, color}  (opcional)
───────────────────────────────────────────────── */
const SENSORES = [
  {
    pid: '0110',
    label: 'Flujo de aire (MAF)',
    icon: '💨',
    unit: 'g/s',
    categoria: 'Mezcla y Combustible',
    desc: 'Masa de aire que entra al motor',
    badge: (v) => ({
      text: v === null ? '—' : v < 5 ? 'Ralentí' : v < 20 ? 'Normal' : 'Alta carga',
      color: v === null ? '#90a4ae' : v < 5 ? '#42a5f5' : v < 20 ? '#66bb6a' : '#ffa726',
    }),
  },
  {
    pid: '010B',
    label: 'Presión colector (MAP)',
    icon: '🌬️',
    unit: 'kPa',
    categoria: 'Mezcla y Combustible',
    desc: 'Presión del múltiple de admisión',
    badge: (v) => ({
      text: v === null ? '—' : v < 35 ? 'Vacío alto' : v < 60 ? 'Ralentí' : v < 100 ? 'Normal' : 'Plena carga',
      color: v === null ? '#90a4ae' : v < 35 ? '#42a5f5' : v < 100 ? '#66bb6a' : '#ffa726',
    }),
  },
  {
    pid: '0111',
    label: 'Posición acelerador (TPS)',
    icon: '🦶',
    unit: '%',
    categoria: 'Rendimiento del Motor',
    desc: 'Apertura de la mariposa de aceleración',
    badge: (v) => ({
      text: v === null ? '—' : v < 5 ? 'Cerrado' : v < 50 ? 'Parcial' : v < 90 ? 'Alto' : 'Pleno gas',
      color: v === null ? '#90a4ae' : v < 5 ? '#42a5f5' : v < 90 ? '#66bb6a' : '#ef5350',
    }),
  },
  {
    pid: '0104',
    label: 'Carga calculada motor',
    icon: '⚙️',
    unit: '%',
    categoria: 'Rendimiento del Motor',
    desc: 'Porcentaje de la carga actual del motor',
    badge: (v) => ({
      text: v === null ? '—' : v < 30 ? 'Baja' : v < 70 ? 'Media' : v < 90 ? 'Alta' : 'Máxima',
      color: v === null ? '#90a4ae' : v < 30 ? '#42a5f5' : v < 70 ? '#66bb6a' : v < 90 ? '#ffa726' : '#ef5350',
    }),
  },
  {
    pid: '010F',
    label: 'Temperatura aire entrada (IAT)',
    icon: '🌡️',
    unit: '°C',
    categoria: 'Salud y Temperaturas',
    desc: 'Temperatura del aire en el múltiple',
    badge: (v) => ({
      text: v === null ? '—' : v < 0 ? 'Bajo cero' : v < 40 ? 'Normal' : v < 60 ? 'Elevada' : 'Alta',
      color: rangeColor(v, '#66bb6a', 40, 60),
    }),
  },
  {
    pid: '010E',
    label: 'Avance de encendido',
    icon: '⚡',
    unit: '°',
    categoria: 'Rendimiento del Motor',
    desc: 'Ángulo de avance de la chispa respecto al PMS',
    badge: (v) => ({
      text: v === null ? '—' : v < 0 ? 'Retardo' : v < 15 ? 'Normal' : v < 30 ? 'Avanzado' : 'Máximo',
      color: v === null ? '#90a4ae' : v < 0 ? '#ef5350' : '#66bb6a',
    }),
  },
  {
    pid: '0106',
    label: 'Corrección combustible corto',
    icon: '🔩',
    unit: '%',
    categoria: 'Mezcla y Combustible',
    desc: 'Ajuste a corto plazo de la mezcla aire/combustible',
    badge: (v) => ({
      text: v === null ? '—' : Math.abs(v) <= 5 ? 'En punto' : Math.abs(v) <= 15 ? 'Ajustando' : 'Fuera de rango',
      color: v === null ? '#90a4ae' : Math.abs(v) <= 5 ? '#66bb6a' : Math.abs(v) <= 15 ? '#ffa726' : '#ef5350',
    }),
  },
  {
    pid: '0107',
    label: 'Corrección combustible largo',
    icon: '🔧',
    unit: '%',
    categoria: 'Mezcla y Combustible',
    desc: 'Ajuste a largo plazo de la mezcla aire/combustible',
    badge: (v) => ({
      text: v === null ? '—' : Math.abs(v) <= 5 ? 'En punto' : Math.abs(v) <= 15 ? 'Ajustando' : 'Fuera de rango',
      color: v === null ? '#90a4ae' : Math.abs(v) <= 5 ? '#66bb6a' : Math.abs(v) <= 15 ? '#ffa726' : '#ef5350',
    }),
  },
  {
    pid: '010A',
    label: 'Presión combustible',
    icon: '🛢️',
    unit: 'kPa',
    categoria: 'Mezcla y Combustible',
    desc: 'Presión en la línea de combustible (relativa)',
    badge: (v) => ({
      text: v === null ? '—' : v < 200 ? 'Baja' : v < 400 ? 'Normal' : 'Alta',
      color: v === null ? '#90a4ae' : v < 200 ? '#ef5350' : v < 400 ? '#66bb6a' : '#ffa726',
    }),
  },
  {
    pid: '0123',
    label: 'Presión riel combustible',
    icon: '⛽',
    unit: 'kPa',
    categoria: 'Mezcla y Combustible',
    desc: 'Presión del riel de inyectores (combustible directo/GDI)',
    badge: (v) => ({
      text: v === null ? '—' : v < 3000 ? 'Baja' : v < 15000 ? 'Normal' : 'Alta',
      color: v === null ? '#90a4ae' : v < 3000 ? '#ef5350' : v < 15000 ? '#66bb6a' : '#ffa726',
    }),
  },
  {
    pid: '0114',
    label: 'Sensor O₂ banco 1 S1',
    icon: '🔬',
    unit: 'V',
    categoria: 'Mezcla y Combustible',
    desc: 'Tensión del sensor de oxígeno (sonda lambda)',
    badge: (v) => ({
      text: v === null ? '—' : v < 0.1 ? 'Lean/Pobre' : v < 0.45 ? 'Zona lean' : v < 0.55 ? 'Estequiométrico' : v < 0.9 ? 'Zona rich' : 'Rich/Rico',
      color: v === null ? '#90a4ae' : (v >= 0.4 && v <= 0.6) ? '#66bb6a' : '#ffa726',
    }),
  },
  {
    pid: '0131',
    label: 'Distancia con MIL encendido',
    icon: '📏',
    unit: 'km',
    categoria: 'Diagnóstico MIL',
    desc: 'Kilómetros recorridos desde que se encendió el Check Engine',
    badge: (v) => ({
      text: v === null ? '—' : v === 0 ? 'Sin fallas recientes' : v < 50 ? 'Reciente' : v < 200 ? 'Varios días' : 'Prolongado',
      color: v === null ? '#90a4ae' : v === 0 ? '#66bb6a' : v < 50 ? '#ffa726' : '#ef5350',
    }),
  },
];

// Categorías lógicas de sensores (vista principal tipo "cuadrados")
const CATEGORIAS = [
  {
    id: 'Rendimiento del Motor',
    icon: '🚗',
    desc: 'Carga del motor, TPS y avance de encendido.',
  },
  {
    id: 'Salud y Temperaturas',
    icon: '🌡️',
    desc: 'Temperaturas de admisión y estado general.',
  },
  {
    id: 'Mezcla y Combustible',
    icon: '⛽',
    desc: 'Mezcla aire/combustible, trims y presiones.',
  },
  {
    id: 'Diagnóstico MIL',
    icon: '⚠️',
    desc: 'Parámetros ligados al encendido del Check Engine.',
  },
];

/* ─────────────────────────────────────────────────
   Componente tarjeta individual de sensor
───────────────────────────────────────────────── */
function SensorCard({ sensor, datos }) {
  const raw = datos[sensor.pid];
  const valorStr = raw?.valor ?? null;
  const valNum = parseVal(valorStr);
  const badge = sensor.badge(valNum);
  const disponible = valorStr !== null && valorStr !== undefined;

  return (
    <div className={`sa-sensor-card${!disponible ? ' sa-sensor-nd' : ''}`}>
      <div className="sa-sensor-header">
        <span className="sa-sensor-icon">{sensor.icon}</span>
        <span className="sa-sensor-label">{sensor.label}</span>
        {disponible && (
          <span className="sa-sensor-badge" style={{ color: badge.color }}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="sa-sensor-value">
        {disponible ? valorStr : <span className="sa-sensor-nd-text">No disponible</span>}
      </div>
      <div className="sa-sensor-desc">{sensor.desc}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Componente principal
───────────────────────────────────────────────── */
export default function SensoresAvanzadosPage({ datos, onVolver }) {
  const [categoriaActiva, setCategoriaActiva] = useState(CATEGORIAS[0].id);
  const [vista, setVista] = useState('categorias'); // 'categorias' | 'detalle'
  const disponibles = SENSORES.filter(s => datos[s.pid]?.valor != null);
  const noDisponibles = SENSORES.filter(s => datos[s.pid]?.valor == null);

  // Categorías disponibles según los sensores definidos
  const categoriasDisponibles = CATEGORIAS.filter(cat =>
    SENSORES.some(s => s.categoria === cat.id)
  );

  return (
    <div className="sa-page-bg">
      {/* Top bar */}
      <div className="sa-page-topbar">
        <button
          className="sa-page-back"
          onClick={() => {
            if (vista === 'detalle') {
              setVista('categorias');
            } else {
              onVolver();
            }
          }}
        >
          ← Volver
        </button>
        <div className="sa-page-topbar-center">
          <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ width: '1.8rem', height: '2.1rem', color: '#ffd740', flexShrink: 0 }}>
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
          <h1 className="sa-page-title">Sensores Avanzados</h1>
        </div>
        <div className="sa-page-topbar-right">
          <span className="sa-pill sa-pill-ok">
            {disponibles.length} activos · {noDisponibles.length} no disponibles
          </span>
        </div>
      </div>

      <div className="sa-page-body">
        {disponibles.length === 0 && noDisponibles.length === 0 ? (
          <p className="sa-empty">Sin datos de sensores. Asegúrate de que el motor está en marcha.</p>
        ) : (
          <>
            {vista === 'categorias' ? (
              <>
                <h2 className="sa-section-title">Selecciona una categoría</h2>
                <div className="sa-cat-grid">
                  {categoriasDisponibles.map(cat => {
                    const totalCat = SENSORES.filter(s => s.categoria === cat.id).length;
                    const activosCat = SENSORES.filter(
                      s => s.categoria === cat.id && datos[s.pid]?.valor != null
                    ).length;
                    return (
                      <button
                        key={cat.id}
                        className="sa-cat-card"
                        onClick={() => {
                          setCategoriaActiva(cat.id);
                          setVista('detalle');
                        }}
                      >
                        <div className="sa-cat-header">
                          <span className="sa-cat-icon">{cat.icon}</span>
                          <span className="sa-cat-title">{cat.id}</span>
                        </div>
                        <div className="sa-cat-count">
                          {activosCat}/{totalCat} sensores activos
                        </div>
                        <div className="sa-cat-desc">{cat.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <section className="sa-section">
                  <h2 className="sa-section-title">{categoriaActiva}</h2>
                  <div className="sa-grid">
                    {SENSORES.filter(s => s.categoria === categoriaActiva).map(s => (
                      <SensorCard key={s.pid} sensor={s} datos={datos} />
                    ))}
                  </div>
                </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
