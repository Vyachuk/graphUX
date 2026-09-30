import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useStore,
  useStoreApi,
} from '@xyflow/react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { EntityNode, REFIT_EVENT, type EntityFlowNode } from './EntityNode';
import { CommentsProvider, useCurrentUser } from './comments';
import { people } from './data';
import { anchorOf, GraphEdge, MapEdge } from './GraphEdge';
import { registry } from './entities/registry';
import { buildGraph, heightKey, type Anchors, type Heights, type LayoutMode } from './layout';
import { initialNav, navReducer, NavProvider, pathTo, type NavAction, type NavState } from './navigation';
import { StressHud } from './StressHud';
import { AssistantChat, AssistantDock } from './assistant/AssistantUI';
import { AssistantProvider } from './assistant/session';
import { stressFromUrl, stressNav } from './stress';

const nodeTypes = { entity: EntityNode };
const edgeTypes = { graph: GraphEdge, map: MapEdge };
// Зверху місце під хлібні крихти, знизу — під Controls.
const FIT_PADDING = { top: '80px', bottom: '40px', x: '48px' } as const;
/** Стрес-тест: граф зі 150+ карток має влазити в екран цілком. */
const STRESS_MIN_ZOOM = 0.02;
const STRESS_PAD = 48;
const STRESS_TOP = 80;
const minimapColor = (n: EntityFlowNode) => registry[n.data.entity.type].accent;

/** ADR-0013: `?stress=150` відкриває канвас зі 150 розгорнутими картками. */
function initialState(): NavState {
  const stress = stressFromUrl(window.location.search);
  return stress ? stressNav(stress.count, stress.branch) : initialNav;
}

export default function App() {
  const [state, dispatch] = useReducer(navReducer, undefined, initialState);
  const nav = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <CommentsProvider>
      <NavProvider value={nav}>
        {/* ADR-0018: асистент бачить той самий стан і діє тими самими діями, що й користувач. */}
        <AssistantProvider state={state} dispatch={dispatch}>
          <div className="app">
            <div className="app__canvas">
              <ReactFlowProvider>
                <Canvas state={state} dispatch={dispatch} />
              </ReactFlowProvider>
              <AssistantDock />
            </div>
            <AssistantChat />
          </div>
        </AssistantProvider>
      </NavProvider>
    </CommentsProvider>
  );
}

/** ADR-0017: «Мапа» за замовчуванням, `?layout=tree` — колонки з ADR-0009. */
const initialMode = (): LayoutMode => (new URLSearchParams(window.location.search).get('layout') === 'tree' ? 'tree' : 'map');

function Canvas({ state, dispatch }: { state: NavState; dispatch: (a: NavAction) => void }) {
  // ADR-0009: лейаут залежить від виміряних висот нод.
  const [heights, setHeights] = useState<Heights>({});
  const [anchors, setAnchors] = useState<Anchors>({});
  const [mode, setMode] = useState(initialMode);
  const graph = useMemo(() => buildGraph(state, heights, mode, anchors), [state, heights, mode, anchors]);
  const store = useStoreApi<EntityFlowNode>();
  // React Flow v12 зберігає виміряні розміри в самих нодах, тож потрібен onNodesChange.
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityFlowNode>(graph.nodes);
  const { fitView, getNodesBounds, setViewport } = useReactFlow();
  const viewportWidth = useStore((s) => s.width);
  const pendingFit = useRef(true);
  // Стрес-тест: перший кадр показує весь граф, далі камера працює як звичайно.
  const fitAll = useRef(!!state.stress);
  const fitStart = useRef(performance.now());
  const [layoutMs, setLayoutMs] = useState<number | null>(null);

  useEffect(() => {
    pendingFit.current = true;
    fitStart.current = performance.now();
  }, [state]);

  // Зміна лейауту: у стрес-тесті знову показуємо огляд, інакше — фокус.
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    pendingFit.current = true;
    fitAll.current = !!state.stress;
    fitStart.current = performance.now();
  }, [mode, state.stress]);

  // Синхронізуємо ноди з графом. Виміри лишаємо лише тим, чий розмір не змінився.
  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      return graph.nodes.map((n) => {
        const old = byId.get(n.id);
        return old?.measured && old.data.expanded === n.data.expanded && old.data.width === n.data.width
          ? { ...n, measured: old.measured }
          : n;
      });
    });
  }, [graph, setNodes]);

  // Нові виміри → перерахунок лейауту.
  // ADR-0016: разом із висотами беремо положення рядків-якорів — лейаут прокладає ребра в обхід карток.
  useEffect(() => {
    if (mode === 'tree') return;
    const { nodeLookup } = store.getState();
    setAnchors((prev) => {
      let next = prev;
      for (const e of graph.edges) {
        const src = nodeLookup.get(e.source);
        const a = src && e.data?.anchor ? anchorOf(src, e.data.anchor) : null;
        const old = prev[e.target];
        if (a && (!old || Math.abs(old.x0 - a.x0) + Math.abs(old.x1 - a.x1) + Math.abs(old.y - a.y) > 0.5)) {
          if (next === prev) next = { ...prev };
          next[e.target] = a;
        }
      }
      return next;
    });
  }, [nodes, graph.edges, mode, store]);

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

  // Камера наводиться на фокус — щойно відкриту картку (ADR-0012), коли лейаут побудований з реальних висот.
  useEffect(() => {
    const synced =
      graph.complete &&
      nodes.length === graph.nodes.length &&
      nodes.every((n, i) => {
        const g = graph.nodes[i];
        return (
          n.id === g.id &&
          n.data.expanded === g.data.expanded &&
          n.position.x === g.position.x &&
          n.position.y === g.position.y &&
          n.measured?.width
        );
      });
    if (!pendingFit.current || !synced) return;
    pendingFit.current = false;
    setLayoutMs(performance.now() - fitStart.current);
    if (fitAll.current && mode !== 'tree') {
      // Мапа зі 150+ карток цілком — дрібно. Показуємо корінь і його дітей; увесь граф — ⛶ або мінімапа.
      fitAll.current = false;
      const root = state.nodes[state.root];
      fitView({ nodes: [root.key, ...root.children].map((id) => ({ id })), padding: FIT_PADDING, maxZoom: 1 });
      return;
    }
    if (fitAll.current) {
      // Дерево зі 150+ карток у рази вище, ніж ширше: вписуємо за шириною (усі колонки видно,
      // картки читабельні), далі — скрол униз. Увесь граф — мінімапа або кнопка ⛶.
      fitAll.current = false;
      const b = getNodesBounds(nodes);
      const zoom = Math.max(STRESS_MIN_ZOOM, Math.min(1, (viewportWidth - 2 * STRESS_PAD) / b.width));
      setViewport({ x: STRESS_PAD - b.x * zoom, y: STRESS_TOP - b.y * zoom, zoom });
      return;
    }
    fitView({ nodes: [...graph.camera].map((id) => ({ id })), duration: 400, padding: FIT_PADDING, maxZoom: 1 });
  }, [nodes, graph, fitView, getNodesBounds, setViewport, viewportWidth, mode, state]);

  // Нода змінила розмір без навігації (відкрили тред коментарів) — наводимо камеру на фокус заново.
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
      minZoom={state.stress ? STRESS_MIN_ZOOM : 0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
    >
      <Background gap={24} color="rgba(255,255,255,0.06)" />
      <Controls showInteractive={false} />
      <Panel position="top-left">
        <Breadcrumbs state={state} dispatch={dispatch} />
      </Panel>
      <Panel position="top-right" className="top-right">
        <LayoutSwitch mode={mode} onChange={setMode} />
        <UserSwitcher />
      </Panel>
      {state.stress && (
        <>
          <MiniMap pannable zoomable nodeColor={minimapColor} maskColor="rgb(0 0 0 / 0.5)" />
          <Panel position="top-center">
            <StressHud nodes={graph.nodes.length} edges={graph.edges.length} expanded={graph.expanded.size} layoutMs={layoutMs} />
          </Panel>
        </>
      )}
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

function LayoutSwitch({ mode, onChange }: { mode: LayoutMode; onChange: (m: LayoutMode) => void }) {
  const options: { id: LayoutMode; label: string }[] = [
    { id: 'map', label: '⇆ Мапа' },
    { id: 'tree', label: '☰ Дерево' },
  ];
  return (
    <div className="layout-switch" role="radiogroup" aria-label="Лейаут">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={mode === o.id}
          className={`layout-switch__option${mode === o.id ? ' is-active' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
