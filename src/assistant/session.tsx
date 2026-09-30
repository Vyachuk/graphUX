// Сесія асистента (ADR-0018): одна історія для голосу й чату, виконання дій над графом, «Скасувати».
// ADR-0020: коментарі від імені поточного користувача, диктування в два кроки.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAllComments, useCommentsDispatch, useCurrentUser } from '../comments';
import { REFIT_EVENT } from '../EntityNode';
import type { NavAction, NavState } from '../navigation';
import { putCard } from './cards';
import { MockAssistant } from './mock';
import type { Assistant, Awaiting } from './types';
import { useVoice, type VoiceControl } from './voice';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: 'voice' | 'text';
  /** Що асистент зробив на графі: «Відкрив: Львів». */
  actions: string[];
  /** Стан навігації до відповіді — для «Скасувати». */
  before?: NavState;
  /** Коментарі, записані цією відповіддю, — «Скасувати» їх видаляє. */
  comments?: { id: string; by: string }[];
  pending?: boolean;
  undone?: boolean;
};

type Session = {
  messages: Message[];
  busy: boolean;
  send: (text: string, source?: 'voice' | 'text') => Promise<string>;
  undo: (id: string) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  voice: VoiceControl;
  /** Асистент чекає продовження — наприклад, текст коментаря. */
  awaiting: Awaiting | null;
  cancelAwaiting: () => void;
};

const SessionContext = createContext<Session | null>(null);

let msgSeq = 0;
const nextId = () => `m${++msgSeq}`;

export function AssistantProvider({
  state,
  dispatch,
  assistant: given,
  children,
}: {
  state: NavState;
  dispatch: (a: NavAction) => void;
  assistant?: Assistant;
  children: ReactNode;
}) {
  const assistant = useMemo(() => given ?? new MockAssistant(), [given]);
  const comments = useAllComments();
  const commentsDispatch = useCommentsDispatch();
  const { userId } = useCurrentUser();
  const [awaiting, setAwaitingState] = useState<Awaiting | null>(null);
  const awaitingRef = useRef<Awaiting | null>(null);
  const setAwaiting = (a: Awaiting | null) => {
    awaitingRef.current = a;
    setAwaitingState(a);
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpenState] = useState(false);
  // Панель чату звужує канвас — камера знову наводиться на фокус.
  const setChatOpen = useCallback((open: boolean) => {
    setChatOpenState(open);
    setTimeout(() => window.dispatchEvent(new Event(REFIT_EVENT)), 60);
  }, []);

  // Асистент працює з актуальним станом, а не з тим, що був при створенні колбеку.
  const live = useRef({ state, comments, userId, messages });
  live.current = { state, comments, userId, messages };

  const patch = (id: string, f: (m: Message) => Message) => setMessages((ms) => ms.map((m) => (m.id === id ? f(m) : m)));

  const undo = useCallback(
    (id: string) => {
      const m = live.current.messages.find((x) => x.id === id);
      if (!m?.before || m.undone) return;
      dispatch({ kind: 'restore', state: m.before });
      for (const c of m.comments ?? []) commentsDispatch({ kind: 'remove', id: c.id, by: c.by });
      patch(id, (x) => ({ ...x, undone: true }));
    },
    [dispatch, commentsDispatch],
  );

  const send = useCallback(
    async (text: string, source: 'voice' | 'text' = 'text') => {
      const clean = text.trim();
      if (!clean) return '';
      const { state: before, comments, userId } = live.current;
      const reply: Message = { id: nextId(), role: 'assistant', text: '', actions: [], before, pending: true };
      setMessages((ms) => [...ms, { id: nextId(), role: 'user', text: clean, source, actions: [] }, reply]);
      setBusy(true);
      let full = '';
      try {
        const ctx = { state: before, comments, userId, awaiting: awaitingRef.current };
        for await (const e of assistant.respond(clean, ctx)) {
          if (e.type === 'card') putCard(e.card);
          else if (e.type === 'await') setAwaiting(e.awaiting);
          else if (e.type === 'comment') {
            const id = crypto.randomUUID();
            commentsDispatch({
              kind: 'add',
              comment: { id, target: `${e.target.type}:${e.target.id}`, authorId: userId, text: e.text, createdAt: Date.now(), likes: [] },
            });
            patch(reply.id, (m) => ({ ...m, actions: [...m.actions, e.label], comments: [...(m.comments ?? []), { id, by: userId }] }));
          }
          else if (e.type === 'action') {
            dispatch(e.action);
            patch(reply.id, (m) => ({ ...m, actions: [...m.actions, e.label] }));
          } else if (e.type === 'undo') {
            const last = [...live.current.messages].reverse().find((m) => m.role === 'assistant' && m.actions.length && !m.undone);
            if (last) undo(last.id);
          } else {
            full += e.delta;
            patch(reply.id, (m) => ({ ...m, text: m.text + e.delta }));
          }
        }
      } catch {
        full = 'Щось пішло не так. Спробуй ще раз.';
        patch(reply.id, (m) => ({ ...m, text: full }));
      } finally {
        patch(reply.id, (m) => ({ ...m, pending: false }));
        setBusy(false);
      }
      return full.trim();
    },
    [assistant, dispatch, undo, commentsDispatch],
  );

  // Під час диктування коментаря голос чекає довші паузи.
  const voice = useVoice(
    (command, { woke }) => {
      // Нове «Гей, граф» — нова команда: диктування, що лишилось після тиші, скасовуємо.
      if (woke) setAwaiting(null);
      return send(command, 'voice');
    },
    { dictating: () => awaitingRef.current?.kind === 'comment', onIdle: () => setAwaiting(null) },
  );
  const cancelAwaiting = useCallback(() => setAwaiting(null), []);

  const value = useMemo(
    () => ({ messages, busy, send, undo, chatOpen, setChatOpen, voice, awaiting, cancelAwaiting }),
    [messages, busy, send, undo, chatOpen, setChatOpen, voice, awaiting, cancelAwaiting],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAssistant() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useAssistant must be used inside AssistantProvider');
  return ctx;
}
