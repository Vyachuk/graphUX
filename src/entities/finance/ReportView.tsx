// Financial Report ресторану (Figma 638:2318).
import { getFinancials, metricId, type MetricKind } from '../../finance';
import { Donut } from './charts';
import { ChartCard, KpiTile, LinkCard } from './parts';

const kinds: MetricKind[] = ['revenue', 'expenses'];

export function ReportView({ id }: { id: string }) {
  const f = getFinancials(id);
  const to = (kind: MetricKind) => ({ type: 'metric', id: metricId(id, kind) }) as const;

  return (
    <div className="fin-report">
      <div className="fin-report__row">
        {kinds.map((kind) => (
          <LinkCard key={kind} to={to(kind)} via={kind} className={`fin-kpi fin-kpi--${kind}`}>
            <KpiTile kind={kind} data={f[kind]} />
          </LinkCard>
        ))}
        {kinds.map((kind) => (
          <LinkCard key={`chart-${kind}`} to={to(kind)} via={`${kind} trend`} className="fin-chart-link">
            <ChartCard kind={kind} data={f[kind]} width={231} />
          </LinkCard>
        ))}
      </div>
      <div className="fin-breakdown">
        <Donut data={f.breakdown} />
        <ul className="fin-legend">
          {f.breakdown.map((s) => (
            <li key={s.label}>
              <span className="fin-legend__dot" style={{ background: s.color }} />
              <span className="fin-legend__label">{s.label}</span>
              <span className="fin-legend__value">{s.share}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
