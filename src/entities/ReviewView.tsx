import { getReview } from '../data';
import { EntityLink, Field, Section } from './EntityLink';
import { formatDate } from './EventView';

export const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

export function ReviewView({ id }: { id: string }) {
  const r = getReview(id);

  return (
    <>
      <Section title="Оцінка">
        <Field label={formatDate(r.date)}>
          <span className="stars">{stars(r.rating)}</span>
        </Field>
        <blockquote className="quote">{r.text}</blockquote>
      </Section>
      <Section title="Автор">
        <EntityLink to={{ type: 'person', id: r.authorId }} via="written by" />
      </Section>
      <Section title="Про ресторан">
        <EntityLink to={{ type: 'restaurant', id: r.restaurantId }} via="about" />
      </Section>
    </>
  );
}
