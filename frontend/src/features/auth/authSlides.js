import React from 'react';

// Ilustraciones vectoriales. Para usar fotos reales: poné los archivos en public/images/
// y reemplazá `art` por `image: '/images/mi-foto.jpg'` (y `alt`) en el slide.
const AMBER = '#e9a84c';
const TEAL = '#5eead4';

function Frame({ id, children }) {
  return (
    <svg viewBox="0 0 600 680" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a1820" /><stop offset="1" stopColor="#12524c" />
        </linearGradient>
      </defs>
      <rect width="600" height="680" fill={`url(#${id})`} />
      {children}
    </svg>
  );
}

const line = { fill: 'none', stroke: AMBER, strokeLinecap: 'round', strokeLinejoin: 'round' };

function PumpjackArt() {
  return (
    <Frame id="sky-pump">
      <circle cx="150" cy="430" r="70" fill={AMBER} opacity=".9" />
      <rect y="430" width="600" height="250" fill="#08141b" />
      <g {...line} strokeWidth="7">
        <path d="M322 430 L360 300 L398 430" />
        <path d="M340 372 H380" />
        <path d="M252 282 L470 318" />
        <path d="M262 278 Q228 284 236 326 L254 326" />
        <path d="M245 326 V430" />
        <path d="M462 316 L480 372" />
        <path d="M300 430 H530" />
      </g>
      <circle cx="482" cy="402" r="30" fill={AMBER} />
      <rect x="232" y="418" width="26" height="12" fill={AMBER} />
    </Frame>
  );
}

function DerrickArt() {
  return (
    <Frame id="sky-derrick">
      <rect y="400" width="600" height="280" fill="#08141b" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} y={400 + i * 70} width="600" height="70" fill={TEAL} opacity={0.05 + i * 0.03} />
      ))}
      <path d="M60 470 H100 M60 540 H100 M60 610 H100" stroke={TEAL} strokeWidth="2" opacity=".5" />
      <g {...line} strokeWidth="5">
        <path d="M235 400 L300 170 L365 400 Z" />
        <path d="M283 230 H317 M266 290 H334 M249 350 H351" />
        <path d="M283 230 L334 290 M317 230 L266 290 M266 290 L351 350 M334 290 L249 350 M249 350 L365 400 M351 350 L235 400" />
        <path d="M300 400 V560" strokeWidth="4" />
        <path d="M300 575 V585" strokeWidth="4" />
      </g>
      <rect x="290" y="150" width="20" height="20" fill={AMBER} />
      <circle cx="300" cy="600" r="9" fill={AMBER} />
    </Frame>
  );
}

function ForecastArt() {
  const grid = { stroke: TEAL, opacity: 0.16 };
  return (
    <Frame id="sky-forecast">
      <g {...grid}>
        {[200, 270, 340, 410].map((y) => <path key={y} d={`M90 ${y} H510`} />)}
        {[150, 210, 270, 330, 390, 450, 510].map((x) => <path key={x} d={`M${x} 200 V480`} />)}
      </g>
      <path d="M90 200 V480 H510" fill="none" stroke="#9fb8b5" strokeWidth="2" />
      <path d="M300 402 C360 410 430 418 510 422 L510 474 C430 462 360 440 300 402 Z" fill={TEAL} opacity=".16" />
      <polyline fill="none" stroke={AMBER} strokeWidth="2.5" opacity=".9"
        points="90,232 110,244 130,246 150,268 170,292 190,318 210,332 230,356 250,362 270,384 290,392 300,402" />
      <path d="M90 240 C150 255 200 320 240 358 S285 395 300 402" fill="none" stroke={TEAL} strokeWidth="4" strokeLinecap="round" />
      <path d="M300 402 C360 425 430 440 510 448" fill="none" stroke={TEAL} strokeWidth="4" strokeLinecap="round" strokeDasharray="10 8" />
      <path d="M300 200 V480" stroke={AMBER} strokeDasharray="4 6" opacity=".6" />
      <g fill="#9fb8b5" fontSize="15" fontFamily="system-ui, sans-serif">
        <text x="98" y="222">Histórico</text>
        <text x="308" y="222">Pronóstico</text>
      </g>
    </Frame>
  );
}

// Los textos son provisorios: ajustalos a lo que haga realmente la tesis.
export const AUTH_SLIDES = [
  { id: 'pozo', title: 'Predicción de producción de pozos',
    text: 'Modelos de machine learning entrenados con datos históricos de producción.', art: <PumpjackArt /> },
  { id: 'perforacion', title: 'Del dato al pozo',
    text: 'Perfiles de perforación y variables operativas como base de cada modelo.', art: <DerrickArt /> },
  { id: 'curvas', title: 'Curvas de declinación',
    text: 'Compará lo producido con lo que estima el modelo.', art: <ForecastArt /> },
];
