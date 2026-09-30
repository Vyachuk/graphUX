// Стрес-тест канвасу (ADR-0013): дерево зі 100–200 розгорнутих карток, побудоване обходом реальних зв'язків.
import * as db from './data';
import { comparisonId, metricId, parseMetricId, periods, type MetricKind } from './finance';
import type { EntityDef } from './entities/registry';
import type { EntityRef, NavState, TreeNode } from './navigation';
import { refKey } from './navigation';
import { seeded } from './seeded';
import * as work from './work';

export type Link = { ref: EntityRef; via: string };

const to = (type: EntityRef['type'], id: string, via: string): Link => ({ ref: { type, id }, via });
const kinds: MetricKind[] = ['revenue', 'expenses'];

/** Вихідні зв'язки сутності — ті самі, що показує її картка. */
export function outgoing({ type, id }: EntityRef): Link[] {
  switch (type) {
    case 'people':
      return db.people.map((p) => to('person', p.id, 'row'));
    case 'person': {
      const p = db.getPerson(id);
      return [
        to('company', p.companyId, 'works at'),
        to('city', p.cityId, 'lives in'),
        to('restaurant', p.favoriteRestaurantId, 'loves'),
        to('dish', p.favoriteDishId, 'favorite dish'),
        ...db.reviewsBy(id).map((r) => to('review', r.id, 'wrote')),
        ...db.eventsOf(id).map((e) => to('event', e.id, 'attends')),
        ...work.teamsWith(id).map((t) => to('team', t.id, 'member of')),
        ...work.tasksFor(id).map((t) => to('task', t.id, 'assignee')),
        ...work.ordersBy(id).map((o) => to('order', o.id, 'ordered')),
        ...p.friendIds.map((f) => to('person', f, 'friend')),
      ];
    }
    case 'restaurant': {
      const r = db.getRestaurant(id);
      return [
        to('report', id, 'financials'),
        to('city', r.cityId, 'located in'),
        ...db.dishesOf(id).map((d) => to('dish', d.id, 'serves')),
        ...db.reviewsOf(id).map((rv) => to('review', rv.id, 'review')),
        ...db.eventsAt(id).map((e) => to('event', e.id, 'hosts')),
        ...work.suppliersOf(id).map((s) => to('supplier', s.id, 'supplied by')),
        ...work.projectsFor(id).map((p) => to('project', p.id, 'client of')),
        ...work.ordersAt(id).map((o) => to('order', o.id, 'order')),
        ...db.fansOf(id).map((p) => to('person', p.id, 'fan')),
      ];
    }
    case 'city': {
      const c = db.getCity(id);
      return [
        to('country', c.countryId, 'in country'),
        ...db.restaurantsIn(id).map((r) => to('restaurant', r.id, 'restaurant')),
        ...db.companiesIn(id).map((co) => to('company', co.id, 'based here')),
        ...db.eventsIn(id).map((e) => to('event', e.id, 'event')),
        ...work.suppliersIn(id).map((s) => to('supplier', s.id, 'warehouse')),
        ...db.residentsOf(id).map((p) => to('person', p.id, 'resident')),
      ];
    }
    case 'country':
      return db.citiesOf(id).map((c) => to('city', c.id, 'city'));
    case 'dish': {
      const d = db.getDish(id);
      return [
        to('restaurant', d.restaurantId, 'served at'),
        ...d.ingredientIds.map((i) => to('ingredient', i, 'contains')),
        ...db.loversOf(id).map((p) => to('person', p.id, 'loved by')),
      ];
    }
    case 'ingredient':
      return [
        ...db.dishesWith(id).map((d) => to('dish', d.id, 'used in')),
        ...work.suppliersWith(id).map((s) => to('supplier', s.id, 'supplied by')),
      ];
    case 'company': {
      const c = db.getCompany(id);
      return [
        to('city', c.cityId, 'HQ in'),
        ...db.employeesOf(id).map((p) => to('person', p.id, 'employee')),
        ...work.teamsOf(id).map((t) => to('team', t.id, 'team')),
        ...db.eventsBy(id).map((e) => to('event', e.id, 'organizes')),
      ];
    }
    case 'event': {
      const e = db.getEvent(id);
      return [
        to('restaurant', e.venueId, 'venue'),
        to('city', e.cityId, 'in city'),
        to('company', e.organizerId, 'organized by'),
        ...e.attendeeIds.map((p) => to('person', p, 'attendee')),
      ];
    }
    case 'review': {
      const r = db.getReview(id);
      return [to('person', r.authorId, 'written by'), to('restaurant', r.restaurantId, 'about')];
    }
    case 'report':
      return kinds.map((k) => to('metric', metricId(id, k), k));
    case 'metric': {
      const { restaurantId, kind } = parseMetricId(id);
      return periods.map((p) => to('comparison', comparisonId(restaurantId, kind, p.id), p.label));
    }
    case 'comparison':
    case 'assistant':
      return [];
    case 'team': {
      const t = work.getTeam(id);
      return [
        to('company', t.companyId, 'part of'),
        ...work.projectsOf(id).map((p) => to('project', p.id, 'owns')),
        ...t.memberIds.map((p) => to('person', p, p === t.leadId ? 'lead' : 'member')),
      ];
    }
    case 'project': {
      const p = work.getProject(id);
      return [
        to('team', p.teamId, 'by team'),
        to('restaurant', p.clientRestaurantId, 'for client'),
        ...work.tasksOf(id).map((t) => to('task', t.id, 'task')),
      ];
    }
    case 'task': {
      const t = work.getTask(id);
      return [to('project', t.projectId, 'in project'), to('person', t.assigneeId, 'assigned to')];
    }
    case 'supplier': {
      const s = work.getSupplier(id);
      return [
        to('city', s.cityId, 'warehouse in'),
        ...s.ingredientIds.map((i) => to('ingredient', i, 'supplies')),
        ...s.restaurantIds.map((r) => to('restaurant', r, 'delivers to')),
      ];
    }
    case 'order': {
      const o = work.getOrder(id);
      return [
        ...o.items.map((it) => to('dish', it.dishId, 'ordered')),
        to('person', o.personId, 'ordered by'),
        to('restaurant', o.restaurantId, 'from'),
      ];
    }
  }
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const STRESS_DEFAULT = 150;
export const STRESS_BRANCH = 3;

/**
 * Дерево з `count` нод обходом у ширину від таблиці людей. Кожна сутність — один раз,
 * у кожної ноди до `branch` дітей (зв'язки перемішані детерміновано, щоб типи чергувались).
 */
export function stressNav(count = STRESS_DEFAULT, branch = STRESS_BRANCH): NavState {
  const rand = seeded(`stress:${count}:${branch}`);
  const root: TreeNode = { key: 'n0', ref: { type: 'people', id: 'all' }, parent: null, children: [] };
  const nodes: Record<string, TreeNode> = { n0: root };
  const seen = new Set([refKey(root.ref)]);
  const order = [root];
  let seq = 1;

  // Обхід у ширину: `order` росте під час проходу. Якщо обхід вичерпався раніше за `count`
  // (листя на кшталт comparison не має зв'язків), повторюємо прохід із лімітом гілок на 1 більше.
  for (let limit = branch; seq < count; limit++) {
    const before = seq;
    for (let i = 0; i < order.length && seq < count; i++) {
      const node = order[i];
      for (const link of shuffle(outgoing(node.ref), rand)) {
        if (node.children.length >= limit || seq >= count) break;
        if (seen.has(refKey(link.ref))) continue;
        seen.add(refKey(link.ref));
        const child: TreeNode = { key: `n${seq++}`, ref: link.ref, via: link.via, parent: node.key, children: [] };
        nodes[child.key] = child;
        node.children.push(child.key);
        order.push(child);
      }
    }
    if (seq === before) break; // досяжних сутностей більше немає
  }

  return { nodes, root: 'n0', focus: 'n0', seq, stress: true };
}

/** Максимальне розтягнення картки в стрес-тесті: ширина ∈ [base, base × (1 + WIDTH_SPREAD)]. */
export const WIDTH_SPREAD = 0.6;

/**
 * Ширина розгорнутої картки. У стрес-тесті кожна картка отримує свою (стабільну для ключа) ширину.
 * Лише розтягуємо, не звужуємо: фінансові віджети мають фіксовану внутрішню сітку.
 * «Голі» ноди (metric, comparison) не чіпаємо — вони самі є карткою фіксованого розміру.
 */
export function cardWidth(def: EntityDef, key: string, stress = false): number {
  if (!stress || def.chrome === 'bare') return def.width;
  return Math.round(def.width * (1 + WIDTH_SPREAD * seeded(`w:${key}`)()));
}

/** Параметри з URL: `?stress=150&branch=3`. */
export function stressFromUrl(search: string): { count: number; branch: number } | null {
  const params = new URLSearchParams(search);
  if (!params.has('stress')) return null;
  const count = Number(params.get('stress')) || STRESS_DEFAULT;
  const branch = Number(params.get('branch')) || STRESS_BRANCH;
  return { count: Math.max(2, Math.min(count, 500)), branch: Math.max(1, branch) };
}
