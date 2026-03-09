import React from "react";
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

  const angle =
    MIN_ANGLE +
    (Math.min(velocidad, maxVel) / maxVel) * SWEEP;

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
            transform:`rotate(${angle}deg)`,
            transformOrigin:`${CX}px ${CY}px`,
            transition:"transform 0.3s"
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
          {velocidad}
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