import { dishesWith, formatPrice, getIngredient } from '../data';
import { EntityLink, Field, Section } from './EntityLink';

export function IngredientView({ id }: { id: string }) {
  const i = getIngredient(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Категорія">{i.category}</Field>
        <Field label="Алерген">{i.allergen ? '⚠️ так' : 'ні'}</Field>
      </Section>
      <Section title="Входить у страви">
        {dishesWith(id).map((d) => (
          <EntityLink key={d.id} to={{ type: 'dish', id: d.id }} via="used in">
            {d.name} · {formatPrice(d)}
          </EntityLink>
        ))}
      </Section>
    </>
  );
}
