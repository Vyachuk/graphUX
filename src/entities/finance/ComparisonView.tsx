// Порівняння обраного періоду з поточним кварталом (Figma 638:2528).
import { getFinancials, getPeriod, metricLabel, parseMetricId, QUARTER } from '../../finance';
import { MetricCard } from './parts';

export function ComparisonView({ id }: { id: string }) {
  const { restaurantId, kind, period } = parseMetricId(id);
  const f = getFinancials(restaurantId);
  const p = getPeriod(period ?? '');
  // Історія є лише для виручки; для витрат масштабуємо від неї з тією ж пропорцією, що й поточний квартал.
  const past = kind === 'revenue'
    ? f.history[p.id]
    : { ...f.history[p.id], total: Math.round((f.history[p.id].total * f.expenses.total) / f.revenue.total / 50) * 50 };

  return (
    <div className="fin-comparison">
      <MetricCard kind={kind} data={past} title={`${metricLabel[kind].total} · ${p.label}`} />
      <MetricCard kind={kind} data={f[kind]} title={`${metricLabel[kind].total} · ${QUARTER}`} />
    </div>
  );
}
