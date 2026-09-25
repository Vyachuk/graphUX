import { employeesOf, eventsBy, getCompany } from '../data';
import { EntityLink, Field, Section } from './EntityLink';

export function CompanyView({ id }: { id: string }) {
  const c = getCompany(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Індустрія">{c.industry}</Field>
        <Field label="Заснована">{c.founded}</Field>
      </Section>
      <Section title="Штаб-квартира">
        <EntityLink to={{ type: 'city', id: c.cityId }} via="HQ in" />
      </Section>
      <Section title="Працівники">
        {employeesOf(id).map((p) => (
          <EntityLink key={p.id} to={{ type: 'person', id: p.id }} via="employee">
            {p.name} · {p.role}
          </EntityLink>
        ))}
      </Section>
      <Section title="Організовує події">
        {eventsBy(id).map((e) => (
          <EntityLink key={e.id} to={{ type: 'event', id: e.id }} via="organizes" />
        ))}
      </Section>
    </>
  );
}
