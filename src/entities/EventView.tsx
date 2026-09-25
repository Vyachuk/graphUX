import { getEvent } from '../data';
import { EntityLink, Field, Section } from './EntityLink';

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

export function EventView({ id }: { id: string }) {
  const e = getEvent(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Дата">{formatDate(e.date)}</Field>
        <Field label="Учасників">{e.attendeeIds.length}</Field>
      </Section>
      <Section title="Де">
        <EntityLink to={{ type: 'restaurant', id: e.venueId }} via="venue" />
        <EntityLink to={{ type: 'city', id: e.cityId }} via="in city" />
      </Section>
      <Section title="Організатор">
        <EntityLink to={{ type: 'company', id: e.organizerId }} via="organized by" />
      </Section>
      <Section title="Учасники">
        {e.attendeeIds.map((pid) => (
          <EntityLink key={pid} to={{ type: 'person', id: pid }} via="attendee" />
        ))}
      </Section>
    </>
  );
}
