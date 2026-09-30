// Контракт асистента (ADR-0018). Мок і майбутня модель (Claude з інструментами) віддають однаковий потік подій.
import type { Comment } from '../comments';
import type { EntityRef, NavAction, NavState } from '../navigation';

/** Що асистент знає про екран. */
export type GraphContext = {
  state: NavState;
  /** Коментарі — для підсумків. */
  comments: Comment[];
  userId: string;
  /** Асистент чекає продовження: наступна репліка — текст коментаря (ADR-0020). */
  awaiting?: Awaiting | null;
};

/** На що асистент чекає від наступної репліки. */
export type Awaiting = { kind: 'comment'; target: EntityRef };

/** Картка-відповідь на канвасі: повний текст і посилання на знайдене. */
export type AnswerCard = {
  id: string;
  title: string;
  text: string;
  links: { to: EntityRef; label?: string }[];
};

export type AssistantEvent =
  /** Шматок тексту відповіді (стрімінг). */
  | { type: 'text'; delta: string }
  /** Картку треба зареєструвати до дії, що її відкриває. */
  | { type: 'card'; card: AnswerCard }
  /** Дія над графом + підпис для чату («Відкрив: Львів»). */
  | { type: 'action'; action: NavAction; label: string }
  /** Скасувати попередню відповідь. */
  | { type: 'undo' }
  /** Залишити коментар від імені поточного користувача (ADR-0020). */
  | { type: 'comment'; target: EntityRef; text: string; label: string }
  /** Наступна репліка — продовження (диктування коментаря); null — більше не чекаємо. */
  | { type: 'await'; awaiting: Awaiting | null };

export interface Assistant {
  respond(message: string, ctx: GraphContext): AsyncIterable<AssistantEvent>;
}

/** Підпис ребра від картки-відповіді до знайденої сутності (і via її рядків-посилань). */
export const ANSWER_VIA = 'answer';
/** Підпис ребра від поточної картки до картки-відповіді. */
export const ASK_VIA = '✦ AI';
