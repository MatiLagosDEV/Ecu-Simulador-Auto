import React from 'react';
import './Tacometro.css';

const CX = 250, CY = 250;
const R_ARC = 210;
const R_NUMS = 170;
const R_TICK_OUT = 210;
const R_TICK_IN_MIN = 196;
const R_TICK_IN_MAJ = 182;
const MIN_ANGLE = -135;
const MAX_ANGLE = 135;
const SWEEP = 270;

function polar(r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(r, a1, a2) {
  const s = polar(r, a1);
  const e = polar(r, a2);
  const large = (a2 - a1) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function Tacometro({ rpm = 0, maxRpm = 8000 }) {
  const angle = MIN_ANGLE + (Math.min(rpm, maxRpm) / maxRpm) * SWEEP;
  const labels = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  const ticks = [];
  for (let i = 0; i <= 40; i++) {
    const a = MIN_ANGLE + (i / 40) * SWEEP;
    const isMajor = i % 5 === 0;
    const outer = polar(R_TICK_OUT, a);
    const inner = polar(isMajor ? R_TICK_IN_MAJ : R_TICK_IN_MIN, a);
    const val = i * 200;
    const color = val >= 6000 ? '#ff1744' : val >= 4000 ? '#ff9100' : '#555';
    ticks.push(
      <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
        stroke={color} strokeWidth={isMajor ? 4 : 2} strokeLinecap="round" />
    );
  }

  const redStart = MIN_ANGLE + (6000 / maxRpm) * SWEEP;

  return (
    <div className="tacometro-container tacometro-pro">
      <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bgTacoGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2a2a2a" />
            <stop offset="100%" stopColor="#0d0d0d" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Fondo circular */}
        <circle cx={CX} cy={CY} r="248" fill="url(#bgTacoGrad)" />
        <circle cx={CX} cy={CY} r="248" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
        {/* Anillo exterior decorativo */}
        <circle cx={CX} cy={CY} r="240" fill="none" stroke="#333" strokeWidth="1.5" />
        {/* Arco base */}
        <path d={arcPath(R_ARC, MIN_ANGLE, MAX_ANGLE)} fill="none" stroke="#2a2a2a" strokeWidth="20" strokeLinecap="round" />
        <path d={arcPath(R_ARC, MIN_ANGLE, MAX_ANGLE)} fill="none" stroke="#3a3a3a" strokeWidth="18" strokeLinecap="round" />
        {/* Arco zona roja */}
        <path d={arcPath(R_ARC, redStart, MAX_ANGLE)} fill="none" stroke="#ff1744" strokeWidth="18" strokeLinecap="round" opacity="0.9" filter="url(#glow)" />
        {/* Ticks */}
        {ticks}
        {/* Números */}
        {labels.map((label, i) => {
          const a = MIN_ANGLE + (i / (labels.length - 1)) * SWEEP;
          const p = polar(R_NUMS, a);
          const color = label >= 6 ? '#ff1744' : label >= 4 ? '#ff9100' : label >= 2 ? '#00e676' : '#fff';
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fontSize="26" fill={color} fontWeight="700"
              fontFamily="'Montserrat', Arial, sans-serif"
              style={{ filter: 'drop-shadow(0 0 4px #000)' }}>
              {label}
            </text>
          );
        })}
        {/* Aguja */}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: 'transform 0.3s cubic-bezier(.4,2,.6,1)' }}>
          <line x1={CX} y1={CY + 35} x2={CX} y2={CY - 190}
            stroke="#ff1744" strokeWidth="4" strokeLinecap="round" />
        </g>
        {/* Centro */}
        <circle cx={CX} cy={CY} r="22" fill="#1a1a1a" stroke="#ff1744" strokeWidth="3" />
        <circle cx={CX} cy={CY} r="8" fill="#ff1744" />
        {/* Etiqueta */}
        <text x={CX} y={CY + 68} textAnchor="middle" fontSize="38" fill="#00e676"
          fontFamily="monospace" letterSpacing="2"
          style={{ filter: 'drop-shadow(0 0 8px #00e676)' }}>{rpm}</text>
        <text x={CX} y={CY + 98} textAnchor="middle" fontSize="16" fill="rgba(255,255,255,0.55)"
          fontFamily="'Montserrat', Arial, sans-serif" letterSpacing="5">RPM</text>
      </svg>
    </div>
  );
}

export default Tacometro;
