// Спільна обгортка для всіх сутностей на канвасі (ADR-0005, вигляд — ADR-0008).
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo, useState, type CSSProperties } from 'react';
import { CommentThread, CommentsToggle } from './CommentThread';
import { useComments } from './comments';
import { registry, type EntityDef } from './entities/registry';
import { NodeKeyProvider, useNav, type EntityRef } from './navigation';

export type EntityNodeData = {
  entity: EntityRef;
  nodeKey: string;
  isRoot: boolean;
  expanded: boolean;
  focused: boolean;
};

export type EntityFlowNode = Node<EntityNodeData, 'entity'>;

/** Подія «переналаштуй камеру на розгорнуті ноди» — коли нода змінює розмір без навігації. */
export const REFIT_EVENT = 'graphux:refit';

function EntityNodeInner({ data }: NodeProps<EntityFlowNode>) {
  return (
    <NodeKeyProvider nodeKey={data.nodeKey}>
      <EntityBody {...data} />
    </NodeKeyProvider>
  );
}

function Badge({ def, size }: { def: EntityDef; size: number }) {
  return def.iconSrc ? <img src={def.iconSrc} width={size} height={size} alt="" /> : <span>{def.icon}</span>;
}

function EntityBody({ entity, isRoot, expanded, focused }: EntityNodeData) {
  const { focus, close } = useNav();
  const { count } = useComments(entity);
  const [threadOpen, setThreadOpen] = useState(false);
  const def = registry[entity.type];
  const title = def.title(entity.id);
  const style = { '--accent': def.accent } as CSSProperties;

  const handles = (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </>
  );

  // Згорнута нода — плитка 33px з підписом, як швидкий доступ на Start page (Figma 47:1085).
  if (!expanded) {
    return (
      <div className="entity-icon" style={style} onClick={focus} title={`${def.label}: ${title}`}>
        {handles}
        <div className="entity-icon__badge">
          <Badge def={def} size={18} />
          {count > 0 && <span className="entity-icon__count" title={`Коментарів: ${count}`}>{count}</span>}
        </div>
        <div className="entity-icon__label">{title}</div>
      </div>
    );
  }

  const closeButton = !isRoot && (
    <button type="button" className="entity-card__close nodrag" title="Закрити цю гілку" onClick={close}>
      ×
    </button>
  );

  const toggleThread = () => {
    setThreadOpen((o) => !o);
    // Висота картки змінилась — просимо камеру показати її повністю, коли ноду переміряють.
    setTimeout(() => window.dispatchEvent(new Event(REFIT_EVENT)), 80);
  };
  const toggle = <CommentsToggle entity={entity} open={threadOpen} onToggle={toggleThread} />;
  const thread = threadOpen && <CommentThread entity={entity} />;

  if (def.chrome === 'bare') {
    return (
      <div className={`entity-bare${focused ? ' is-focused' : ''}`} style={{ ...style, width: def.width }}>
        {handles}
        <div className="entity-bare__actions">
          {toggle}
          {closeButton}
        </div>
        <def.Component id={entity.id} />
        {thread && <div className="entity-bare__thread">{thread}</div>}
      </div>
    );
  }

  return (
    <div className={`entity-card${focused ? ' is-focused' : ''}`} style={{ ...style, width: def.width }}>
      {handles}
      <span className="entity-card__divider" />
      <header className="entity-card__header">
        <div className="entity-card__titles">
          <h2 className="entity-card__title">{title}</h2>
          <span className="entity-card__subtitle">{def.subtitle?.(entity.id) ?? def.label}</span>
        </div>
        <div className="entity-card__actions">
          {toggle}
          {closeButton}
          <span className="entity-card__badge">
            <Badge def={def} size={20} />
          </span>
        </div>
      </header>
      <div className="entity-card__body">
        <def.Component id={entity.id} />
      </div>
      {thread}
    </div>
  );
}

export const EntityNode = memo(EntityNodeInner);
