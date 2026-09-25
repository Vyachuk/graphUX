import { dishesOf, eventsAt, fansOf, formatPrice, getPerson, getRestaurant, reviewsOf } from '../data';
import { EntityLink, Field, Section } from './EntityLink';
import { stars } from './ReviewView';

export function RestaurantView({ id }: { id: string }) {
  const r = getRestaurant(id);
  const events = eventsAt(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Кухня">{r.cuisine}</Field>
        <Field label="Рейтинг">★ {r.rating.toFixed(1)}</Field>
        <Field label="Ціни">{'$'.repeat(r.priceLevel)}</Field>
        <Field label="Адреса">{r.address}</Field>
      </Section>
      <Section title="Фінанси">
        <EntityLink to={{ type: 'report', id }} via="financials">
          Financial Report · Q1 2026
        </EntityLink>
      </Section>
      <Section title="Місто">
        <EntityLink to={{ type: 'city', id: r.cityId }} via="located in" />
      </Section>
      <Section title="Меню">
        {dishesOf(id).map((d) => (
          <EntityLink key={d.id} to={{ type: 'dish', id: d.id }} via="serves">
            {d.name} · {formatPrice(d)}
          </EntityLink>
        ))}
      </Section>
      <Section title="Відгуки">
        {reviewsOf(id).map((rv) => (
          <EntityLink key={rv.id} to={{ type: 'review', id: rv.id }} via="review">
            {stars(rv.rating)} · {getPerson(rv.authorId).name}
          </EntityLink>
        ))}
      </Section>
      {events.length > 0 && (
        <Section title="Події тут">
          {events.map((e) => (
            <EntityLink key={e.id} to={{ type: 'event', id: e.id }} via="hosts" />
          ))}
        </Section>
      )}
      <Section title="Фанати">
        {fansOf(id).map((p) => (
          <EntityLink key={p.id} to={{ type: 'person', id: p.id }} via="fan" />
        ))}
      </Section>
    </>
  );
}
