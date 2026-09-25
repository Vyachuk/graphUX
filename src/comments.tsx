// Коментарі до сутностей (ADR-0010): чистий reducer + провайдер зі збереженням у localStorage.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { refKey, type EntityRef } from './navigation';

export type Comment = {
  id: string;
  /** refKey сутності, напр. "report:r8". */
  target: string;
  authorId: string;
  text: string;
  createdAt: number;
  likes: string[];
};

export type CommentsAction =
  | { kind: 'add'; comment: Comment }
  | { kind: 'remove'; id: string; by: string }
  | { kind: 'toggleLike'; id: string; by: string };

export function commentsReducer(state: Comment[], action: CommentsAction): Comment[] {
  switch (action.kind) {
    case 'add':
      return action.comment.text.trim() ? [...state, { ...action.comment, text: action.comment.text.trim() }] : state;
    case 'remove':
      // Видаляти можна лише власні коментарі.
      return state.filter((c) => !(c.id === action.id && c.authorId === action.by));
    case 'toggleLike':
      return state.map((c) =>
        c.id !== action.id
          ? c
          : { ...c, likes: c.likes.includes(action.by) ? c.likes.filter((p) => p !== action.by) : [...c.likes, action.by] },
      );
  }
}

const STORAGE_KEY = 'graphux.comments.v1';
const USER_KEY = 'graphux.user.v1';

const HOUR = 3_600_000;
export const seedComments = (now = Date.now()): Comment[] => [
  { id: 'seed-1', target: 'report:r8', authorId: 'p3', text: 'Витрати на маркетинг 35% — чи не забагато для бару на Ринку?', createdAt: now - 26 * HOUR, likes: ['p5'] },
  { id: 'seed-2', target: 'report:r8', authorId: 'p2', text: 'Це сезонне: у лютому був фестиваль. Порівняйте з Березнем.', createdAt: now - 3 * HOUR, likes: ['p3', 'p1'] },
  { id: 'seed-3', target: 'person:p1', authorId: 'p6', text: 'Олена веде редизайн графа — питання по UX до неї 🙌', createdAt: now - 50 * 60_000, likes: [] },
  { id: 'seed-4', target: 'restaurant:r1', authorId: 'p4', text: 'Забронював столик на Kyiv Food Fest.', createdAt: now - 5 * 24 * HOUR, likes: ['p1'] },
];

function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback();
  } catch {
    return fallback();
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Сховище недоступне (приватний режим) — працюємо без збереження.
  }
}

type CommentsContextValue = {
  comments: Comment[];
  dispatch: (a: CommentsAction) => void;
  userId: string;
  setUserId: (id: string) => void;
};

const CommentsContext = createContext<CommentsContextValue | null>(null);

export function CommentsProvider({ children }: { children: ReactNode }) {
  const [comments, dispatch] = useReducer(commentsReducer, undefined, () => load(STORAGE_KEY, () => seedComments()));
  const [userId, setUserId] = useState(() => load(USER_KEY, () => 'p1'));

  useEffect(() => save(STORAGE_KEY, comments), [comments]);
  useEffect(() => save(USER_KEY, userId), [userId]);

  const value = useMemo(() => ({ comments, dispatch, userId, setUserId }), [comments, userId]);
  return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>;
}

function useCommentsContext() {
  const ctx = useContext(CommentsContext);
  if (!ctx) throw new Error('useComments must be used inside CommentsProvider');
  return ctx;
}

export const useCurrentUser = () => {
  const { userId, setUserId } = useCommentsContext();
  return { userId, setUserId };
};

/** Тред однієї сутності. */
export function useComments(ref: EntityRef) {
  const { comments, dispatch, userId } = useCommentsContext();
  const target = refKey(ref);
  const list = useMemo(() => comments.filter((c) => c.target === target), [comments, target]);

  const add = useCallback(
    (text: string) =>
      dispatch({
        kind: 'add',
        comment: { id: crypto.randomUUID(), target, authorId: userId, text, createdAt: Date.now(), likes: [] },
      }),
    [dispatch, target, userId],
  );

  return {
    list,
    count: list.length,
    userId,
    add,
    remove: (id: string) => dispatch({ kind: 'remove', id, by: userId }),
    toggleLike: (id: string) => dispatch({ kind: 'toggleLike', id, by: userId }),
  };
}

const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' });

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.round((ts - now) / 1000);
  if (Math.abs(s) < 45) return 'щойно';
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf.format(m, 'minute');
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf.format(h, 'hour');
  return rtf.format(Math.round(h / 24), 'day');
}
