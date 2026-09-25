// Модель навігації: дерево відкритих сутностей + фокус (ADR-0009, замінює лінійний стек з ADR-0002).
import { createContext, useContext, useMemo, type Dispatch, type ReactNode } from 'react';

export type EntityType =
  | 'people'
  | 'person'
  | 'restaurant'
  | 'city'
  | 'dish'
  | 'company'
  | 'country'
  | 'ingredient'
  | 'event'
  | 'review'
  | 'report'
  | 'metric'
  | 'comparison';
export type EntityRef = { type: EntityType; id: string };

export type TreeNode = {
  key: string;
  ref: EntityRef;
  /** Підпис ребра від батька. */
  via?: string;
  parent: string | null;
  children: string[];
};

export type NavState = {
  nodes: Record<string, TreeNode>;
  root: string;
  focus: string;
  /** Лічильник для унікальних ключів: одна сутність може бути в дереві кілька разів. */
  seq: number;
};

export type NavAction =
  | { kind: 'open'; from: string; ref: EntityRef; via?: string }
  | { kind: 'focus'; key: string }
  | { kind: 'close'; key: string };

export const sameRef = (a: EntityRef, b: EntityRef) => a.type === b.type && a.id === b.id;
export const refKey = (ref: EntityRef) => `${ref.type}:${ref.id}`;

export const initialNav: NavState = {
  nodes: { n0: { key: 'n0', ref: { type: 'people', id: 'all' }, parent: null, children: [] } },
  root: 'n0',
  focus: 'n0',
  seq: 1,
};

/** Ключі від кореня до `key` включно. */
export function pathTo(state: NavState, key: string): string[] {
  const path: string[] = [];
  for (let k: string | null = key; k; k = state.nodes[k].parent) path.unshift(k);
  return path;
}

function removeSubtree(nodes: Record<string, TreeNode>, key: string) {
  for (const child of nodes[key].children) removeSubtree(nodes, child);
  delete nodes[key];
}

export function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.kind) {
    case 'open': {
      const from = state.nodes[action.from];
      if (!from) return state;
      // Та сама сутність уже відкрита з цієї ноди — лише фокусуємо її гілку.
      const existing = from.children.find((k) => sameRef(state.nodes[k].ref, action.ref));
      if (existing) return existing === state.focus ? state : { ...state, focus: existing };

      const key = `n${state.seq}`;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [from.key]: { ...from, children: [...from.children, key] },
          [key]: { key, ref: action.ref, via: action.via, parent: from.key, children: [] },
        },
        focus: key,
        seq: state.seq + 1,
      };
    }
    case 'focus': {
      if (!state.nodes[action.key] || action.key === state.focus) return state;
      return { ...state, focus: action.key };
    }
    case 'close': {
      const node = state.nodes[action.key];
      if (!node || node.parent === null) return state; // корінь не закривається
      const nodes = { ...state.nodes };
      removeSubtree(nodes, action.key);
      const parent = nodes[node.parent];
      nodes[node.parent] = { ...parent, children: parent.children.filter((k) => k !== action.key) };
      const focus = nodes[state.focus] ? state.focus : node.parent;
      return { ...state, nodes, focus };
    }
  }
}

type NavContextValue = { state: NavState; dispatch: Dispatch<NavAction> };

const NavContext = createContext<NavContextValue | null>(null);
const NodeKeyContext = createContext<string>('n0');

export function NavProvider({ value, children }: { value: NavContextValue; children: ReactNode }) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function NodeKeyProvider({ nodeKey, children }: { nodeKey: string; children: ReactNode }) {
  return <NodeKeyContext.Provider value={nodeKey}>{children}</NodeKeyContext.Provider>;
}

/** Навігація з точки зору поточної ноди: `open` додає нову гілку з неї. */
export function useNav() {
  const ctx = useContext(NavContext);
  const key = useContext(NodeKeyContext);
  if (!ctx) throw new Error('useNav must be used inside NavProvider');
  const { state, dispatch } = ctx;
  const node = state.nodes[key];

  return useMemo(
    () => ({
      key,
      /** Сутності, вже відкриті гілками з цієї ноди (для підсвічування посилань). */
      openedChildren: (node?.children ?? []).map((k) => state.nodes[k].ref),
      open: (ref: EntityRef, via?: string) => dispatch({ kind: 'open', from: key, ref, via }),
      focus: () => dispatch({ kind: 'focus', key }),
      close: () => dispatch({ kind: 'close', key }),
    }),
    [key, node, state.nodes, dispatch],
  );
}
