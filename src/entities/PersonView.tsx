import { eventsOf, getPerson, getRestaurant, reviewsBy } from '../data';
import { EntityLink, Field, Section } from './EntityLink';
import { stars } from './ReviewView';

export function PersonView({ id }: { id: string }) {
  const p = getPerson(id);
  const reviews = reviewsBy(id);
  const events = eventsOf(id);

  return (
    <>
      <Section title="Профіль">
        <Field label="Роль">{p.role}</Field>
        <Field label="Вік">{p.age}</Field>
        <Field label="Email">{p.email}</Field>
      </Section>
      <Section title="Працює в">
        <EntityLink to={{ type: 'company', id: p.companyId }} via="works at" />
      </Section>
      <Section title="Живе в">
        <EntityLink to={{ type: 'city', id: p.cityId }} via="lives in" />
      </Section>
      <Section title="Улюблений ресторан">
        <EntityLink to={{ type: 'restaurant', id: p.favoriteRestaurantId }} via="loves" />
      </Section>
      <Section title="Улюблена страва">
        <EntityLink to={{ type: 'dish', id: p.favoriteDishId }} via="favorite dish" />
      </Section>
      {reviews.length > 0 && (
        <Section title="Відгуки">
          {reviews.map((r) => (
            <EntityLink key={r.id} to={{ type: 'review', id: r.id }} via="wrote">
              {stars(r.rating)} · {getRestaurant(r.restaurantId).name}
            </EntityLink>
          ))}
        </Section>
      )}
      {events.length > 0 && (
        <Section title="Події">
          {events.map((e) => (
            <EntityLink key={e.id} to={{ type: 'event', id: e.id }} via="attends" />
          ))}
        </Section>
      )}
      <Section title="Друзі">
        {p.friendIds.map((fid) => (
          <EntityLink key={fid} to={{ type: 'person', id: fid }} via="friend" />
        ))}
      </Section>
    </>
  );
}
