// Будівельні блоки фінансових нод з макета Figma 638:4192.
import type { ReactNode } from 'react';
import trendDown from '../../assets/figma/trend-down.svg';
import trendUp from '../../assets/figma/trend-up.svg';
import { metricLabel, pct, usd, type MetricKind, type MetricSnapshot } from '../../finance';
import type { EntityRef } from '../../navigation';
import { useEntityLink } from '../EntityLink';
import { Sparkline } from './charts';

const tone: Record<MetricKind, { color: string; icon: string }> = {
  revenue: { color: '#34d399', icon: trendUp },
  expenses: { color: '#f87171', icon: trendDown },
};

/** Колір зміни: ріст виручки — добре (зелений), ріст витрат — погано (червоний). */
const deltaColor = (kind: MetricKind, delta: number) => ((delta >= 0) === (kind === 'revenue') ? '#34d399' : '#f87171');
const arrow = (delta: number) => (delta >= 0 ? '↑' : '↓');

/** Картка-посилання: вся площа клікабельна, активна — коли її сутність відкрита гілкою з цієї ноди. */
export function LinkCard({ to, via, className, children }: { to: EntityRef; via: string; className: string; children: ReactNode }) {
  const { active, onClick } = useEntityLink(to, via);
  return (
    <button type="button" className={`${className} fin-link nodrag${active ? ' is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

/** KPI-плитка 143×128 (вузли 638:2333 / 638:2340). */
export function KpiTile({ kind, data }: { kind: MetricKind; data: MetricSnapshot }) {
  return (
    <>
      <span className="fin-muted">{metricLabel[kind].total}</span>
      <span className="fin-value">{usd(data.total)}</span>
      <span className="fin-delta" style={{ color: deltaColor(kind, data.delta) }}>
        {arrow(data.delta)} {Math.abs(data.delta)}% vs last Q
      </span>
    </>
  );
}

/** Картка графіка (вузол 638:2347): іконка тренду, назва, % і спарклайн. */
export function ChartCard({ kind, data, width, label }: { kind: MetricKind; data: MetricSnapshot; width: number; label?: string }) {
  const { color, icon } = tone[kind];
  return (
    <div className="fin-chart" style={{ width }}>
      <div className="fin-chart__head">
        <span className={`fin-chart__icon fin-chart__icon--${kind}`}>
          <img src={icon} width={12} height={12} alt="" />
        </span>
        <span className="fin-chart__label">{label ?? metricLabel[kind].chart}</span>
        <span className="fin-chart__delta" style={{ color }}>
          {pct(data.trendDelta)}
        </span>
      </div>
      <Sparkline data={data.trend} color={color} width={width - 28} />
    </div>
  );
}

/** KPI-картка з графіком (вузол 638:2531): у ноді metric і в порівнянні. */
export function MetricCard({ kind, data, title, highlighted }: { kind: MetricKind; data: MetricSnapshot; title?: string; highlighted?: boolean }) {
  return (
    <div className={`fin-metric${highlighted ? ' fin-metric--highlighted' : ''}`}>
      <div className="fin-metric__kpi">
        <span className="fin-muted">{title ?? metricLabel[kind].total}</span>
        <span className="fin-value">{usd(data.total)}</span>
        <span className="fin-delta" style={{ color: deltaColor(kind, data.delta) }}>
          {arrow(data.delta)} {Math.abs(data.delta)}% vs last Q
        </span>
      </div>
      <ChartCard kind={kind} data={data} width={308} />
    </div>
  );
}
