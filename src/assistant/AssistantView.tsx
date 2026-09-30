// Картка-відповідь асистента на канвасі (ADR-0018): повний текст і рядки-посилання на знайдене.
import { EntityLink, Section } from '../entities/EntityLink';
import { useCard } from './cards';
import { ANSWER_VIA } from './types';

export function AssistantView({ id }: { id: string }) {
  const card = useCard(id);
  return (
    <>
      <p className="assistant-card__text">{card.text}</p>
      <Section title="Знайдено">
        {card.links.map((l) => (
          <EntityLink key={`${l.to.type}:${l.to.id}`} to={l.to} via={ANSWER_VIA}>
            {l.label}
          </EntityLink>
        ))}
      </Section>
    </>
  );
}
