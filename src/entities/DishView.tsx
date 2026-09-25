import { formatPrice, getDish, loversOf } from '../data';
import { EntityLink, Field, Section } from './EntityLink';

export function DishView({ id }: { id: string }) {
  const d = getDish(id);
  const lovers = loversOf(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Ціна">{formatPrice(d)}</Field>
      </Section>
      <Section title="Подають у">
        <EntityLink to={{ type: 'restaurant', id: d.restaurantId }} via="served at" />
      </Section>
      <Section title="Склад">
        {d.ingredientIds.map((iid) => (
          <EntityLink key={iid} to={{ type: 'ingredient', id: iid }} via="contains" />
        ))}
      </Section>
      {lovers.length > 0 && (
        <Section title="Хто любить">
          {lovers.map((p) => (
            <EntityLink key={p.id} to={{ type: 'person', id: p.id }} via="loved by" />
          ))}
        </Section>
      )}
    </>
  );
}
