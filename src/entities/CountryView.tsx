import { citiesOf, getCountry } from '../data';
import { EntityLink, Field, Section } from './EntityLink';

export function CountryView({ id }: { id: string }) {
  const c = getCountry(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Мова">{c.language}</Field>
        <Field label="Валюта">{c.currency}</Field>
      </Section>
      <Section title="Столиця">
        <EntityLink to={{ type: 'city', id: c.capitalId }} via="capital" />
      </Section>
      <Section title="Міста">
        {citiesOf(id).map((city) => (
          <EntityLink key={city.id} to={{ type: 'city', id: city.id }} via="city" />
        ))}
      </Section>
    </>
  );
}
