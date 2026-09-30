import { getTask } from '../work';
import { EntityLink, Field, Section } from './EntityLink';

export function TaskView({ id }: { id: string }) {
  const t = getTask(id);
  const done = t.checklist.filter((c) => c.done).length;

  return (
    <>
      <Section title="Інфо">
        <Field label="Пріоритет">{t.priority}</Field>
        <Field label="Прогрес">
          {done}/{t.checklist.length}
        </Field>
        {t.tags.length > 0 && (
          <div className="tags">
            {t.tags.map((tag) => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        )}
      </Section>
      <Section title="Чекліст">
        {t.checklist.map((c) => (
          <div key={c.text} className={`check${c.done ? ' is-done' : ''}`}>
            <span className="check__box">{c.done ? '✓' : ''}</span>
            {c.text}
          </div>
        ))}
      </Section>
      <Section title="Проєкт">
        <EntityLink to={{ type: 'project', id: t.projectId }} via="in project" />
      </Section>
      <Section title="Виконавець">
        <EntityLink to={{ type: 'person', id: t.assigneeId }} via="assigned to" />
      </Section>
    </>
  );
}
