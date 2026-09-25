import { describe, expect, it } from 'vitest';
import { commentsReducer, seedComments, timeAgo, type Comment } from './comments';
import { getPerson } from './data';

const c = (over: Partial<Comment> = {}): Comment => ({
  id: 'c1', target: 'report:r8', authorId: 'p1', text: 'Привіт', createdAt: 0, likes: [], ...over,
});

describe('commentsReducer (ADR-0010)', () => {
  it('add додає коментар з обрізаним текстом', () => {
    expect(commentsReducer([], { kind: 'add', comment: c({ text: '  текст \n' }) })).toEqual([c({ text: 'текст' })]);
  });

  it('порожній коментар не додається', () => {
    const state: Comment[] = [];
    expect(commentsReducer(state, { kind: 'add', comment: c({ text: '   ' }) })).toBe(state);
  });

  it('видалити можна лише власний коментар', () => {
    const state = [c()];
    expect(commentsReducer(state, { kind: 'remove', id: 'c1', by: 'p2' })).toEqual(state);
    expect(commentsReducer(state, { kind: 'remove', id: 'c1', by: 'p1' })).toEqual([]);
  });

  it('лайк перемикається для конкретної людини', () => {
    let state = [c(), c({ id: 'c2' })];
    state = commentsReducer(state, { kind: 'toggleLike', id: 'c1', by: 'p2' });
    state = commentsReducer(state, { kind: 'toggleLike', id: 'c1', by: 'p3' });
    expect(state[0].likes).toEqual(['p2', 'p3']);
    expect(state[1].likes).toEqual([]);
    state = commentsReducer(state, { kind: 'toggleLike', id: 'c1', by: 'p2' });
    expect(state[0].likes).toEqual(['p3']);
  });

  it('демо-коментарі посилаються на існуючих людей', () => {
    for (const s of seedComments()) {
      expect(() => getPerson(s.authorId)).not.toThrow();
      s.likes.forEach((id) => expect(() => getPerson(id)).not.toThrow());
    }
  });
});

describe('timeAgo', () => {
  const now = 1_800_000_000_000;
  it('форматує відносний час українською', () => {
    expect(timeAgo(now - 10_000, now)).toBe('щойно');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 хвилин тому');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 години тому');
    expect(timeAgo(now - 26 * 3_600_000, now)).toBe('учора');
  });
});
