// KPI-картка з чипами періодів (Figma 638:2474, чипи 638:2517…2523).
import { comparisonId, getFinancials, parseMetricId, periods } from '../../finance';
import { useEntityLink } from '../EntityLink';
import { MetricCard } from './parts';

export function MetricView({ id }: { id: string }) {
  const { restaurantId, kind } = parseMetricId(id);
  const f = getFinancials(restaurantId);

  return (
    <div className="fin-metric-node">
      <MetricCard kind={kind} data={f[kind]} highlighted />
      <div className="fin-chips">
        {periods.map((p) => (
          <PeriodChip key={p.id} label={p.label} to={{ type: 'comparison', id: comparisonId(restaurantId, kind, p.id) }} />
        ))}
      </div>
    </div>
  );
}

function PeriodChip({ label, to }: { label: string; to: { type: 'comparison'; id: string } }) {
  const { active, onClick } = useEntityLink(to, label);
  return (
    <button type="button" className={`fin-chip nodrag${active ? ' is-active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}
