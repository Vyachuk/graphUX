// Нечіткий пошук сутностей за назвою (ADR-0018): регістр, апострофи, відмінки («Олену», «Львові», «Пʼяної вишні»).
import * as db from '../data';
import type { EntityRef, EntityType } from '../navigation';
import * as work from '../work';

/** Нижній регістр, без апострофів і розділових знаків, ʼ/’/' прибираємо. */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʼ’'`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokens = (s: string) => normalize(s).split(' ').filter(Boolean);

export function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Типові закінчення відмінків: відкидаємо одне найдовше, лишаючи основу щонайменше з 3 літер. */
const ENDINGS = ['ами', 'ями', 'ові', 'еві', 'ого', 'ому', 'ими', 'іми', 'ах', 'ях', 'ам', 'ям', 'ом', 'ем', 'ою', 'ею', 'ів', 'ої', 'ій', 'ий', 'і', 'ї', 'у', 'ю', 'а', 'я', 'о', 'е', 'и', 'й', 'ь'];

export function stem(w: string) {
  const e = ENDINGS.find((x) => w.endsWith(x) && w.length - x.length >= 3);
  return e ? w.slice(0, -e.length) : w;
}

/** Усі можливі основи: саме слово і слово без кожного з підхожих закінчень («львів» → львів, льв). */
export function stems(w: string): string[] {
  return [w, ...ENDINGS.filter((x) => w.endsWith(x) && w.length - x.length >= 3).map((x) => w.slice(0, -x.length))];
}

/**
 * Слова збігаються, якщо збігаються якісь їхні основи (без закінчення) з точністю до однієї літери —
 * для чергування і/о, і/е: «львова» ≈ «львів», «києві» ≈ «київ», «пʼяної» ≈ «пʼяна». Короткі основи — лише точно.
 * Так «борщ» ≠ «борошно».
 */
export function wordMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [xs, ys] = [stems(a), stems(b)];
  return xs.some((x) => ys.some((y) => x === y || (x.length >= 4 && y.length >= 4 && levenshtein(x, y) <= 1)));
}

/** Службові слова запитів: не шукаємо за ними сутності. */
const STOP = new Set(
  (
    'покажи покажіть відкрий відкрити знайди перейди до на у в з із та і й що хто які який яка скільки де як ' +
    'любить люблять працює працюють живе живуть меню фінанси виручка виручку витрати витрат заробила заробив заробили ' +
    'порівняй порівняти порівняння закрий закрити прибери згорни усе все крім гілку гілка ресторани ресторан ресторани ' +
    'страви страва люди людей мешканці там тут мені будь ласка граф гей хей про лютим лютий березнем березень квартал ' +
    'рік році минулий минулим коментарі коментарях підсумуй показати відкрити закрити знайти перейти можеш будь ласка підкажи скажи розкажи'
  ).split(' '),
);

type Entry = { ref: EntityRef; words: string[]; title: string };

const entry = (type: EntityType, id: string, title: string): Entry => ({
  ref: { type, id },
  title,
  words: tokens(title).filter((w) => w.length > 2),
});

const index: Entry[] = [
  ...db.people.map((p) => entry('person', p.id, p.name)),
  ...db.restaurants.map((r) => entry('restaurant', r.id, r.name)),
  ...db.cities.map((c) => entry('city', c.id, c.name)),
  ...db.countries.map((c) => entry('country', c.id, c.name)),
  ...db.dishes.map((d) => entry('dish', d.id, d.name)),
  ...db.ingredients.map((i) => entry('ingredient', i.id, i.name)),
  ...db.companies.map((c) => entry('company', c.id, c.name)),
  ...db.events.map((e) => entry('event', e.id, e.name)),
  ...work.teams.map((t) => entry('team', t.id, t.name)),
  ...work.projects.map((p) => entry('project', p.id, p.name)),
  ...work.suppliers.map((s) => entry('supplier', s.id, s.name)),
  ...work.orders.map((o) => entry('order', o.id, `замовлення ${o.id.slice(1)}`)),
];

export type Hit = { ref: EntityRef; title: string; score: number; matched: number };

/**
 * Усі сутності, згадані в запиті, від найкращої. Оцінка — частка слів назви, знайдених у запиті;
 * приймаємо ≥ 0.5 (для «Олену» → «Олена Коваль» досить імені). `types` звужує пошук.
 */
export function findEntities(query: string, types?: EntityType[]): Hit[] {
  const q = tokens(query).filter((w) => !STOP.has(w));
  const hits: Hit[] = [];
  for (const e of index) {
    if (types && !types.includes(e.ref.type)) continue;
    if (!e.words.length) continue;
    const matched = e.words.filter((w) => q.some((t) => wordMatch(t, w))).length;
    const score = matched / e.words.length;
    if (matched && score >= 0.5) hits.push({ ref: e.ref, title: e.title, score, matched });
  }
  return hits.sort((a, b) => b.score - a.score || b.matched - a.matched);
}

export const findEntity = (query: string, types?: EntityType[]) => findEntities(query, types)[0] ?? null;
