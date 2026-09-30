import { formatAmount, getDish } from '../data';
import { getOrder, orderTotal } from '../work';
import { EntityLink, Field, Section } from './EntityLink';
import { formatDate } from './EventView';

export function OrderView({ id }: { id: string }) {
  const o = getOrder(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Дата">{formatDate(o.date)}</Field>
        <Field label="Статус">{o.status}</Field>
        <Field label="Сума">{formatAmount(orderTotal(o), o.restaurantId)}</Field>
      </Section>
      <Section title="Позиції">
        {o.items.map((it) => (
          <EntityLink key={it.dishId} to={{ type: 'dish', id: it.dishId }} via="ordered">
            {getDish(it.dishId).name} × {it.qty}
          </EntityLink>
        ))}
      </Section>
      <Section title="Замовник">
        <EntityLink to={{ type: 'person', id: o.personId }} via="ordered by" />
      </Section>
      <Section title="Ресторан">
        <EntityLink to={{ type: 'restaurant', id: o.restaurantId }} via="from" />
      </Section>
    </>
  );
}
