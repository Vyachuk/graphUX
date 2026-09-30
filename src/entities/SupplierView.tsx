import { getSupplier } from '../work';
import { EntityLink, Field, Section } from './EntityLink';

export function SupplierView({ id }: { id: string }) {
  const s = getSupplier(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Рейтинг">★ {s.rating.toFixed(1)}</Field>
        <Field label="Позицій">{s.ingredientIds.length}</Field>
      </Section>
      <Section title="Склад">
        <EntityLink to={{ type: 'city', id: s.cityId }} via="warehouse in" />
      </Section>
      <Section title="Постачає">
        {s.ingredientIds.map((iid) => (
          <EntityLink key={iid} to={{ type: 'ingredient', id: iid }} via="supplies" />
        ))}
      </Section>
      <Section title="Клієнти">
        {s.restaurantIds.map((rid) => (
          <EntityLink key={rid} to={{ type: 'restaurant', id: rid }} via="delivers to" />
        ))}
      </Section>
    </>
  );
}
