import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { EntityNode, REFIT_EVENT, type EntityFlowNode } from './EntityNode';
import { CommentsProvider, useCurrentUser } from './comments';
import { people } from './data';
import { GraphEdge } from './GraphEdge';
import { registry } from './entities/registry';
import { buildGraph, heightKey, type Heights } from './layout';
import { initialNav, navReducer, NavProvider, pathTo, type NavAction, type NavState } from './navigation';

const nodeTypes = { entity: EntityNode };
const edgeTypes = { graph: GraphEdge };
// Зверху місце під хлібні крихти, знизу — під Controls.
const FIT_PADDING = { top: '80px', bottom: '40px', x: '48px' } as const;

export default function App() {
  const [state, dispatch] = useReducer(navReducer, initialNav);
  const nav = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <CommentsProvider>
      <NavProvider value={nav}>
        <ReactFlowProvider>
          <Canvas state={state} dispatch={dispatch} />
        </ReactFlowProvider>
      </NavProvider>
    </CommentsProvider>
  );
}

function Canvas({ state, dispatch }: { state: NavState; dispatch: (a: NavAction) => void }) {
  // ADR-0009: лейаут дерева залежить від виміряних висот нод.
  const [heights, setHeights] = useState<Heights>({});
  const graph = useMemo(() => buildGraph(state, heights), [state, heights]);
  // React Flow v12 зберігає виміряні розміри в самих нодах, тож потрібен onNodesChange.
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityFlowNode>(graph.nodes);
  const { fitView } = useReactFlow();
  const pendingFit = useRef(true);

  useEffect(() => {
    pendingFit.current = true;
  }, [state]);

  // Синхронізуємо ноди з графом. Виміри лишаємо лише тим, чий розмір не змінився.
  useEffect(() => {
    setNodes((prev) =>
      graph.nodes.map((n) => {
        const old = prev.find((p) => p.id === n.id);
        return old?.measured && old.data.expanded === n.data.expanded ? { ...n, measured: old.measured } : n;
      }),
    );
  }, [graph, setNodes]);

  // Нові виміри → перерахунок лейауту.
  useEffect(() => {
    setHeights((prev) => {
      let next = prev;
      for (const n of nodes) {
        const h = n.measured?.height;
        const k = heightKey(n.id, n.data.expanded);
        if (h && Math.abs((prev[k] ?? -1) - h) > 0.5) {
          if (next === prev) next = { ...prev };
          next[k] = h;
        }
      }
      return next;
    });
  }, [nodes]);

  // Камера показує всі розгорнуті картки (ADR-0012), щойно лейаут побудований з реальних висот.
  useEffect(() => {
    const synced =
      graph.complete &&
      nodes.length === graph.nodes.length &&
      nodes.every((n, i) => {
        const g = graph.nodes[i];
        return n.id === g.id && n.data.expanded === g.data.expanded && n.position.y === g.position.y && n.measured?.width;
      });
    if (!pendingFit.current || !synced) return;
    pendingFit.current = false;
    fitView({ nodes: [...graph.camera].map((id) => ({ id })), duration: 400, padding: FIT_PADDING, maxZoom: 1 });
  }, [nodes, graph, fitView]);

  // Нода змінила розмір без навігації (відкрили тред коментарів) — показуємо розгорнуті картки заново.
  const cameraRef = useRef(graph.camera);
  cameraRef.current = graph.camera;
  useEffect(() => {
    const refit = () =>
      fitView({ nodes: [...cameraRef.current].map((id) => ({ id })), duration: 400, padding: FIT_PADDING, maxZoom: 1 });
    window.addEventListener(REFIT_EVENT, refit);
    return () => window.removeEventListener(REFIT_EVENT, refit);
  }, [fitView]);

  // ← батько, → остання відкрита дитина, ↑/↓ сестри.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Стрілки в полі коментаря рухають курсор, а не фокус графа (ADR-0010).
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const node = state.nodes[state.focus];
      const siblings = node.parent ? state.nodes[node.parent].children : [node.key];
      const i = siblings.indexOf(node.key);
      const target = {
        ArrowLeft: node.parent,
        ArrowRight: node.children.at(-1),
        ArrowUp: siblings[i - 1],
        ArrowDown: siblings[i + 1],
      }[e.key];
      if (target) {
        e.preventDefault();
        dispatch({ kind: 'focus', key: target });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, dispatch]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={graph.edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
    >
      <Background gap={24} color="rgba(255,255,255,0.06)" />
      <Controls showInteractive={false} />
      <Panel position="top-left">
        <Breadcrumbs state={state} dispatch={dispatch} />
      </Panel>
      <Panel position="top-right">
        <UserSwitcher />
      </Panel>
    </ReactFlow>
  );
}

function Breadcrumbs({ state, dispatch }: { state: NavState; dispatch: (a: NavAction) => void }) {
  return (
    <nav className="breadcrumbs">
      {pathTo(state, state.focus).map((key) => {
        const { ref } = state.nodes[key];
        const def = registry[ref.type];
        return (
          <button
            key={key}
            type="button"
            className={`breadcrumbs__item${key === state.focus ? ' is-active' : ''}`}
            onClick={() => dispatch({ kind: 'focus', key })}
          >
            {def.icon} {def.title(ref.id)}
          </button>
        );
      })}
    </nav>
  );
}

/** Від чийого імені пишуться коментарі й ставляться лайки (ADR-0010). */
function UserSwitcher() {
  const { userId, setUserId } = useCurrentUser();
  return (
    <label className="user-switcher">
      <span className="user-switcher__label">Ви</span>
      <select className="user-switcher__select" value={userId} onChange={(e) => setUserId(e.target.value)}>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
