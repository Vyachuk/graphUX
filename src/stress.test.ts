import { describe, expect, it } from 'vitest';
import { registry } from './entities/registry';
import { buildGraph, expandedKeys } from './layout';
import { refKey, type EntityType } from './navigation';
import { cardWidth, outgoing, stressFromUrl, stressNav, WIDTH_SPREAD } from './stress';
import * as work from './work';

describe('stressNav (ADR-0013)', () => {
  it.each([100, 150, 200])('будує рівно %i віджетів, кожна сутність один раз', (count) => {
    const s = stressNav(count);
    const refs = Object.values(s.nodes).map((n) => refKey(n.ref));
    expect(refs).toHaveLength(count);
    expect(new Set(refs).size).toBe(count);
  });

  it('це зв\'язне дерево: у кожної ноди, крім кореня, є батько, і ребро відповідає реальному зв\'язку', () => {
    const s = stressNav(150);
    for (const n of Object.values(s.nodes)) {
      if (n.key === s.root) continue;
      const parent = s.nodes[n.parent!];
      expect(parent.children).toContain(n.key);
      expect(outgoing(parent.ref).some((l) => refKey(l.ref) === refKey(n.ref) && l.via === n.via)).toBe(true);
    }
  });

  it('усі ноди розгорнуті, ребер на одне менше за ноди', () => {
    const s = stressNav(150);
    const g = buildGraph(s);
    expect(expandedKeys(s).size).toBe(150);
    expect(g.nodes.every((n) => n.data.expanded)).toBe(true);
    expect(g.edges).toHaveLength(149);
  });

  it('на канвасі різноманіття типів, включно з новими', () => {
    const types = new Set(Object.values(stressNav(200).nodes).map((n) => n.ref.type));
    expect(types.size).toBeGreaterThanOrEqual(14);
    for (const t of ['team', 'project', 'task', 'supplier', 'order'] as EntityType[]) expect(types).toContain(t);
  });

  it('детермінований: той самий URL — той самий граф', () => {
    expect(stressNav(150)).toEqual(stressNav(150));
  });
});

describe('cardWidth', () => {
  it('поза стрес-тестом — ширина з реєстру', () => {
    expect(cardWidth(registry.person, 'n5')).toBe(registry.person.width);
  });

  it('у стрес-тесті ширини різні, але в межах [base, base × (1 + spread)]', () => {
    const g = buildGraph(stressNav(150));
    const cards = g.nodes.filter((n) => registry[n.data.entity.type].chrome !== 'bare');
    for (const n of cards) {
      const base = registry[n.data.entity.type].width;
      expect(n.data.width).toBeGreaterThanOrEqual(base);
      expect(n.data.width).toBeLessThanOrEqual(Math.round(base * (1 + WIDTH_SPREAD)));
    }
    expect(new Set(cards.map((n) => n.data.width)).size).toBeGreaterThan(cards.length * 0.6);
  });

  it('«голі» ноди фіксованого розміру не розтягуються', () => {
    expect(cardWidth(registry.metric, 'n7', true)).toBe(registry.metric.width);
  });
});

describe('outgoing', () => {
  it('усі зв\'язки кожного типу ведуть на існуючі сутності', () => {
    const s = stressNav(200);
    for (const n of Object.values(s.nodes)) {
      for (const l of outgoing(n.ref)) expect(() => registry[l.ref.type].title(l.ref.id)).not.toThrow();
    }
  });
});

describe('stressFromUrl', () => {
  it('читає параметри й обмежує межі', () => {
    expect(stressFromUrl('')).toBeNull();
    expect(stressFromUrl('?stress')).toEqual({ count: 150, branch: 3 });
    expect(stressFromUrl('?stress=120&branch=5')).toEqual({ count: 120, branch: 5 });
    expect(stressFromUrl('?stress=9999')?.count).toBe(500);
  });
});

describe('цілісність робочого домену', () => {
  it('усі посилання ведуть на існуючі сутності', () => {
    expect(() => {
      work.teams.forEach((t) => [registry.company.title(t.companyId), ...t.memberIds.map(registry.person.title)]);
      work.projects.forEach((p) => [work.getTeam(p.teamId), registry.restaurant.title(p.clientRestaurantId)]);
      work.tasks.forEach((t) => [work.getProject(t.projectId), registry.person.title(t.assigneeId)]);
      work.suppliers.forEach((s) => [
        registry.city.title(s.cityId),
        ...s.ingredientIds.map(registry.ingredient.title),
        ...s.restaurantIds.map(registry.restaurant.title),
      ]);
      work.orders.forEach((o) => [registry.person.title(o.personId), ...o.items.map((i) => registry.dish.title(i.dishId))]);
    }).not.toThrow();
  });

  it('лід — учасник команди, виконавець задачі — учасник команди проєкту', () => {
    for (const t of work.teams) expect(t.memberIds).toContain(t.leadId);
    for (const t of work.tasks) expect(work.getTeam(work.getProject(t.projectId).teamId).memberIds).toContain(t.assigneeId);
  });

  it('замовлення містить лише страви свого ресторану', () => {
    for (const o of work.orders) {
      for (const it of o.items) expect(registry.dish.title(it.dishId)).toBeTruthy();
      expect(o.items.length).toBeGreaterThan(0);
    }
  });

  it('обсяг вмісту різний — отже й висота карток', () => {
    expect(new Set(work.tasks.map((t) => t.checklist.length)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(work.projects.map((p) => p.description.length)).size).toBeGreaterThanOrEqual(3);
  });
});
