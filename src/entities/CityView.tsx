import { companiesIn, eventsIn, getCity, residentsOf, restaurantsIn } from '../data';
import { EntityLink, Field, Section } from './EntityLink';

export function CityView({ id }: { id: string }) {
  const c = getCity(id);
  const companies = companiesIn(id);
  const events = eventsIn(id);
  const residents = residentsOf(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Населення">{c.population.toLocaleString('uk-UA')}</Field>
      </Section>
      <Section title="Країна">
        <EntityLink to={{ type: 'country', id: c.countryId }} via="in country" />
      </Section>
      <Section title="Ресторани">
        {restaurantsIn(id).map((r) => (
          <EntityLink key={r.id} to={{ type: 'restaurant', id: r.id }} via="restaurant" />
        ))}
      </Section>
      {companies.length > 0 && (
        <Section title="Компанії">
          {companies.map((co) => (
            <EntityLink key={co.id} to={{ type: 'company', id: co.id }} via="based here" />
          ))}
        </Section>
      )}
      {events.length > 0 && (
        <Section title="Події">
          {events.map((e) => (
            <EntityLink key={e.id} to={{ type: 'event', id: e.id }} via="event" />
          ))}
        </Section>
      )}
      {residents.length > 0 && (
        <Section title="Мешканці">
          {residents.map((p) => (
            <EntityLink key={p.id} to={{ type: 'person', id: p.id }} via="resident" />
          ))}
        </Section>
      )}
    </>
  );
}
