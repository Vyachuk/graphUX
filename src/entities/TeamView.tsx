import { getPerson } from '../data';
import { getTeam, projectsOf } from '../work';
import { EntityLink, Field, Section } from './EntityLink';

export function TeamView({ id }: { id: string }) {
  const t = getTeam(id);

  return (
    <>
      <Section title="Інфо">
        <Field label="Учасників">{t.memberIds.length}</Field>
        <Field label="Лід">{getPerson(t.leadId).name}</Field>
      </Section>
      <Section title="Компанія">
        <EntityLink to={{ type: 'company', id: t.companyId }} via="part of" />
      </Section>
      <Section title="Проєкти">
        {projectsOf(id).map((p) => (
          <EntityLink key={p.id} to={{ type: 'project', id: p.id }} via="owns">
            {p.name} · {p.status}
          </EntityLink>
        ))}
      </Section>
      <Section title="Учасники">
        {t.memberIds.map((pid) => (
          <EntityLink key={pid} to={{ type: 'person', id: pid }} via={pid === t.leadId ? 'lead' : 'member'} />
        ))}
      </Section>
    </>
  );
}
