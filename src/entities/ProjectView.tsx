import { getPerson } from '../data';
import { getProject, tasksOf } from '../work';
import { EntityLink, Field, Section } from './EntityLink';
import { formatDate } from './EventView';

export function ProjectView({ id }: { id: string }) {
  const p = getProject(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Статус">
          <span className={`pill pill--${p.status === 'Завершено' ? 'done' : p.status === 'На паузі' ? 'idle' : 'live'}`}>{p.status}</span>
        </Field>
        <Field label="Бюджет">${p.budget.toLocaleString('en-US')}</Field>
        <Field label="Дедлайн">{formatDate(p.deadline)}</Field>
      </Section>
      <Section title="Опис">
        {p.description.map((line) => (
          <p key={line} className="prose">{line}</p>
        ))}
      </Section>
      <Section title="Команда">
        <EntityLink to={{ type: 'team', id: p.teamId }} via="by team" />
      </Section>
      <Section title="Клієнт">
        <EntityLink to={{ type: 'restaurant', id: p.clientRestaurantId }} via="for client" />
      </Section>
      <Section title="Задачі">
        {tasksOf(id).map((t) => (
          <EntityLink key={t.id} to={{ type: 'task', id: t.id }} via="task">
            {t.title} · {getPerson(t.assigneeId).name}
          </EntityLink>
        ))}
      </Section>
    </>
  );
}
