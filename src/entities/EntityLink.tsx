import { Children, type ReactNode } from 'react';
import { sameRef, useNav, type EntityRef } from '../navigation';
import { registry } from './registry';

type Props = {
  to: EntityRef;
  /** Підпис ребра на канвасі, напр. "loves", "lives in". */
  via: string;
  children?: ReactNode;
};

/** Будь-який елемент ноди як посилання: чи відкрита ця сутність гілкою з ноди і як її відкрити. */
export function useEntityLink(to: EntityRef, via: string) {
  const { open, openedChildren } = useNav();
  return {
    active: openedChildren.some((r) => sameRef(r, to)),
    onClick: () => open(to, via),
  };
}

/** Клікабельне посилання на іншу сутність: відкриває її новою гілкою (ADR-0009). */
export function EntityLink({ to, via, children }: Props) {
  const { active, onClick } = useEntityLink(to, via);
  const def = registry[to.type];

  return (
    <button
      type="button"
      className={`entity-link nodrag${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span className="entity-link__icon">{def.icon}</span>
      <span className="entity-link__label">{children ?? def.title(to.id)}</span>
      <span className="entity-link__arrow">→</span>
    </button>
  );
}

/** Секція з заголовком; порожня (напр. фанатів немає) не рендериться. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  if (Children.count(children) === 0) return null;
  return (
    <section className="section">
      <h4 className="section__title">{title}</h4>
      <div className="section__body">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <span className="field__value">{children}</span>
    </div>
  );
}
