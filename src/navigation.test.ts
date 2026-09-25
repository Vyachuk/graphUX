import { describe, expect, it } from 'vitest';
import { initialNav, navReducer, pathTo, type EntityRef, type NavAction, type NavState } from './navigation';

const person = (id: string): EntityRef => ({ type: 'person', id });
const run = (...actions: NavAction[]) => actions.reduce(navReducer, initialNav);
const label = (s: NavState, key: string) => `${s.nodes[key].ref.type}:${s.nodes[key].ref.id}`;
const kids = (s: NavState, key: string) => s.nodes[key].children.map((k) => label(s, k));

// people → Олена → Реберня на Узвозі
const chain = run(
  { kind: 'open', from: 'n0', ref: person('p1'), via: 'row' },
  { kind: 'open', from: 'n1', ref: { type: 'restaurant', id: 'r1' }, via: 'loves' },
);

describe('navReducer (ADR-0009)', () => {
  it('починається з таблиці людей як кореня', () => {
    expect(label(initialNav, initialNav.root)).toBe('people:all');
    expect(initialNav.focus).toBe('n0');
  });

  it('open додає дитину і ставить на неї фокус', () => {
    expect(pathTo(chain, chain.focus).map((k) => label(chain, k))).toEqual(['people:all', 'person:p1', 'restaurant:r1']);
    expect(chain.nodes.n2.via).toBe('loves');
  });

  it('інший айтем тієї ж ноди створює НОВУ гілку, стару не чіпає', () => {
    const s = navReducer(chain, { kind: 'open', from: 'n1', ref: { type: 'city', id: 'kyiv' }, via: 'lives in' });
    expect(kids(s, 'n1')).toEqual(['restaurant:r1', 'city:kyiv']);
    expect(s.focus).toBe('n3');
    expect(s.nodes.n2).toBe(chain.nodes.n2);
  });

  it('повторний клік по вже відкритій гілці лише фокусує її', () => {
    const branched = navReducer(chain, { kind: 'open', from: 'n1', ref: { type: 'city', id: 'kyiv' } });
    const s = navReducer(branched, { kind: 'open', from: 'n1', ref: { type: 'restaurant', id: 'r1' } });
    expect(s.nodes).toBe(branched.nodes);
    expect(s.focus).toBe('n2');
  });

  it('одна сутність може бути в дереві кілька разів з різними ключами', () => {
    const s = navReducer(chain, { kind: 'open', from: 'n2', ref: person('p1'), via: 'fan' });
    expect(label(s, 'n3')).toBe('person:p1');
    expect(label(s, 'n1')).toBe('person:p1');
  });

  it('focus ігнорує невідомий ключ', () => {
    expect(navReducer(chain, { kind: 'focus', key: 'nope' })).toBe(chain);
    expect(navReducer(chain, { kind: 'focus', key: 'n0' }).focus).toBe('n0');
  });

  it('close видаляє піддерево, прибирає посилання з батька й переносить фокус на батька', () => {
    const s = navReducer(chain, { kind: 'close', key: 'n1' });
    expect(Object.keys(s.nodes)).toEqual(['n0']);
    expect(s.nodes.n0.children).toEqual([]);
    expect(s.focus).toBe('n0');
  });

  it('close сестринської гілки не рухає фокус', () => {
    const s0 = navReducer(chain, { kind: 'open', from: 'n1', ref: { type: 'city', id: 'kyiv' } });
    const s = navReducer(s0, { kind: 'close', key: 'n2' });
    expect(kids(s, 'n1')).toEqual(['city:kyiv']);
    expect(s.focus).toBe('n3');
  });

  it('корінь закрити не можна', () => {
    expect(navReducer(chain, { kind: 'close', key: 'n0' })).toBe(chain);
  });
});
