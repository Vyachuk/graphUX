// Графіки з макета Figma 638:4192, рендеряться з даних (ADR-0008 §4).
import { useId } from 'react';
import { MONTHS, type Breakdown } from '../../finance';

const H = 70;
const PLOT_TOP = 4;
const PLOT_BOTTOM = 40;
// Позиції підписів місяців з макета (центри, % ширини).
const LABEL_X = [0.28, 0.64, 0.97];

/** Згладжена крива через точки (Catmull-Rom → кубічний Безьє). */
function smoothPath(pts: [number, number][]) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function Sparkline({ data, color, width }: { data: number[]; color: string; width: number }) {
  const gradientId = useId();
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i): [number, number] => [
    (i / (data.length - 1)) * width,
    PLOT_BOTTOM - ((v - min) / (max - min || 1)) * (PLOT_BOTTOM - PLOT_TOP - 6) - 3,
  ]);
  const line = smoothPath(pts);

  return (
    <svg className="sparkline" width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M0,${PLOT_TOP + 0.5}H${width}M0,${PLOT_BOTTOM + 0.5}H${width}`} className="sparkline__grid" />
      <path d={`${line} L${width},${PLOT_BOTTOM} L0,${PLOT_BOTTOM} Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {MONTHS.map((m, i) => (
        <text key={m} x={LABEL_X[i] * width} y={54} textAnchor={i === MONTHS.length - 1 ? 'end' : 'middle'} className="sparkline__label">
          {m}
        </text>
      ))}
    </svg>
  );
}

/** Кільцева діаграма 64px: зовнішній радіус 30, товщина 12 — як сегменти в макеті. */
export function Donut({ data }: { data: Breakdown }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
      <g transform="rotate(-126 32 32)">
        {data.map((s) => {
          const len = (s.share / 100) * c;
          const el = (
            <circle key={s.label} cx="32" cy="32" r={r} fill="none" stroke={s.color} strokeWidth="12"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}
