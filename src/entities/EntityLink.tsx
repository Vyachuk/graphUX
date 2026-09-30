import { Handle, Position } from '@xyflow/react';
import { Children, type ReactNode } from 'react';
import { anchorId, sameRef, useNav, type EntityRef } from '../navigation';
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

/**
 * Невидимий хендл усередині клікабельного елемента (ADR-0015). React Flow міряє його позицію,
 * і радіальне ребро до відкритої сутності виходить з краю картки на висоті саме цього елемента.
 * Батьківський елемент має бути `position: relative`.
 */
export function LinkAnchor({ to, via, edge = 'both' }: { to: EntityRef; via: string; edge?: 'l' | 'r' | 'both' }) {
  const id = anchorId(to, via);
  // Два хендли — лівий і правий край елемента: з них видно і висоту, і колонку, в якій він стоїть (ADR-0016).
  // Рядок таблиці ставить лівий у першу комірку, правий — в останню (`edge`).
  return (
    <>
      {edge !== 'r' && <Handle type="source" id={`${id}:l`} position={Position.Left} isConnectable={false} className="link-anchor" />}
      {edge !== 'l' && (
        <Handle type="source" id={`${id}:r`} position={Position.Right} isConnectable={false} className="link-anchor link-anchor--r" />
      )}
    </>
  );
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
      <LinkAnchor to={to} via={via} />
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
