import React, { useEffect, useRef, useState } from "react";
import "./Velocimetro.css";

const CX = 250;
const CY = 250;

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
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad)
  };
}

function arcPath(r, a1, a2) {
  const s = polar(r, a1);
  const e = polar(r, a2);
  const large = (a2 - a1) > 180 ? 1 : 0;

  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)}
          A ${r} ${r} 0 ${large} 1
          ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function Velocimetro({ velocidad = 0, maxVel = 240 }) {

  const targetAngle = MIN_ANGLE + (Math.min(velocidad, maxVel) / maxVel) * SWEEP;
  const currentAngle = useRef(targetAngle);
  const [angle, setAngle] = useState(targetAngle);
  const rafRef = useRef(null);

  // --- Tiritón: loop independiente, no toca la animación principal ---
  const [vib, setVib] = useState(0);
  const vibT = useRef(0);
  const vibRaf = useRef(null);
  useEffect(() => {
    const loop = () => {
      vibT.current += 0.7;
      // Empieza a temblar exactamente a partir de 120 km/h
      const ratio = Math.max(0, (velocidad - 120) / (maxVel - 120));
      const amp = ratio * 3.5; // máx ±3.5° de tiritón bien visible
      setVib(
        Math.sin(vibT.current * 3.8) * amp * 0.6
        + (Math.random() - 0.5) * amp * 0.8
      );
      vibRaf.current = requestAnimationFrame(loop);
    };
    vibRaf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(vibRaf.current);
  }, [velocidad, maxVel]);
  // -------------------------------------------------------------------

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const animate = () => {
      const diff = targetAngle - currentAngle.current;
      if (Math.abs(diff) < 0.05) {
        currentAngle.current = targetAngle;
        setAngle(targetAngle);
        return;
      }
      // Tope pequeño → la aguja tarda ~15 frames por km/h (igual de fluido que el tacómetro)
      // degPerKm = 1.125° → tope = 1.125/15 = 0.075° por frame
      const MAX_STEP = (SWEEP / maxVel) * 0.07;
      let step = diff * 0.35;
      if (step >  MAX_STEP) step =  MAX_STEP;
      if (step < -MAX_STEP) step = -MAX_STEP;
      currentAngle.current += step;
      setAngle(currentAngle.current);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetAngle]);

  // Valor mostrado derivado del ángulo actual (sincronizado con la aguja)
  const displayVel = Math.round(((angle - MIN_ANGLE) / SWEEP) * maxVel);

  const labels = [0,30,60,90,120,150,180,210,240];

  const ticks = [];

  for (let i = 0; i <= 40; i++) {

    const a = MIN_ANGLE + (i / 40) * SWEEP;

    const isMajor = i % 5 === 0;

    const outer = polar(R_TICK_OUT, a);
    const inner = polar(
      isMajor ? R_TICK_IN_MAJ : R_TICK_IN_MIN,
      a
    );

    const val = i * (maxVel / 40);

    const color =
      val >= maxVel * 0.8 ? "#ff1744"
      : val >= maxVel * 0.6 ? "#ff9100"
      : "#555";

    ticks.push(
      <line
        key={i}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke={color}
        strokeWidth={isMajor ? 4 : 2}
        strokeLinecap="round"
      />
    );
  }

  const redStart =
    MIN_ANGLE + (maxVel * 0.8 / maxVel) * SWEEP;

  return (

    <div className="velocimetro-container velocimetro-pro">

      <svg viewBox="0 0 500 500">

        <defs>

          <radialGradient id="bgVelGrad">
            <stop offset="0%" stopColor="#2a2a2a"/>
            <stop offset="100%" stopColor="#0d0d0d"/>
          </radialGradient>

        </defs>

        <circle
          cx={CX}
          cy={CY}
          r="248"
          fill="url(#bgVelGrad)"
        />

        <path
          d={arcPath(R_ARC, MIN_ANGLE, MAX_ANGLE)}
          fill="none"
          stroke="#3a3a3a"
          strokeWidth="18"
          strokeLinecap="round"
        />

        <path
          d={arcPath(R_ARC, redStart, MAX_ANGLE)}
          fill="none"
          stroke="#ff1744"
          strokeWidth="18"
          strokeLinecap="round"
        />

        {ticks}

        {labels.map((label,i)=>{

          const a =
            MIN_ANGLE +
            (i/(labels.length-1))*SWEEP;

          const p = polar(R_NUMS,a);

          const color =
            label >= maxVel*0.8 ? "#ff1744"
            : label >= maxVel*0.6 ? "#ff9100"
            : label >= maxVel*0.3 ? "#00e676"
            : "#fff";

          return (

            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="22"
              fill={color}
              fontWeight="700"
            >
              {label}
            </text>

          );

        })}

        <g
          style={{
            transform:`rotate(${angle + vib}deg)`,
            transformOrigin:`${CX}px ${CY}px`
          }}
        >

          <line
            x1={CX}
            y1={CY+35}
            x2={CX}
            y2={CY-190}
            stroke="#ff1744"
            strokeWidth="4"
          />

        </g>

        {/* Centro igual que tacómetro */}
        <circle cx={CX} cy={CY} r="22" fill="#1a1a1a" stroke="#ff1744" strokeWidth="3" />
        <circle cx={CX} cy={CY} r="8" fill="#ff1744" />

        <text
          x={CX}
          y={CY+70}
          textAnchor="middle"
          fontSize="36"
          fill="#2196f3"
          fontFamily="monospace"
        >
          {displayVel}
        </text>

        <text
          x={CX}
          y={CY+95}
          textAnchor="middle"
          fontSize="16"
          fill="#aaa"
        >
          km/h
        </text>

      </svg>

    </div>
  );
}

export default Velocimetro;