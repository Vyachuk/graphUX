// Мок-асистент (ADR-0018): ключові слова українською + нечіткий пошук сутностей.
// Віддає той самий потік подій, що й майбутня модель з інструментами: заміна не зачепить UI.
import * as db from '../data';
import { registry } from '../entities/registry';
import {
  comparisonId,
  getFinancials,
  getPeriod,
  metricId,
  metricLabel,
  parseMetricId,
  pct,
  QUARTER,
  usd,
  type MetricKind,
  type PeriodId,
} from '../finance';
import { navReducer, pathTo, sameRef, type EntityRef, type EntityType, type NavAction, type NavState } from '../navigation';
import * as work from '../work';
import { findEntity, normalize, type Hit } from './search';
import { cleanCommand, stripLead } from './wake';
import { ANSWER_VIA, ASK_VIA, type AnswerCard, type Assistant, type AssistantEvent, type GraphContext } from './types';

const title = (ref: EntityRef) => registry[ref.type].title(ref.id);
const has = (q: string, re: RegExp) => re.test(q);
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} і ${items.at(-1)}`);

let cardSeq = 0;

/** Хід асистента: імітує стан навігації, щоб знати ключі нових карток, і збирає події. */
class Turn {
  s: NavState;
  events: AssistantEvent[] = [];
  text = '';

  constructor(
    readonly ctx: GraphContext,
    readonly message: string,
  ) {
    this.s = ctx.state;
  }

  act(action: NavAction, label: string) {
    this.s = navReducer(this.s, action);
    this.events.push({ type: 'action', action, label });
  }

  say(text: string) {
    this.text += (this.text ? ' ' : '') + text;
  }

  /** Відкриває `ref` з ноди `from` (або фокусує, якщо вже відкрита звідти); повертає її ключ. */
  open(from: string, ref: EntityRef, via: string) {
    this.act({ kind: 'open', from, ref, via }, `Відкрив: ${title(ref)}`);
    return this.s.focus;
  }

  /** Картка-відповідь поруч із поточною карткою; повертає її ключ. */
  card(text: string, links: AnswerCard['links']) {
    const card: AnswerCard = { id: `a${++cardSeq}`, title: cardTitle(this.message), text, links };
    this.events.push({ type: 'card', card });
    this.act({ kind: 'open', from: this.s.focus, ref: { type: 'assistant', id: card.id }, via: ASK_VIA }, `Відповідь: ${card.title}`);
    return this.s.focus;
  }

  /** Ключ уже відкритої в дереві ноди з цією сутністю (остання відкрита). */
  find(ref: EntityRef) {
    return Object.values(this.s.nodes)
      .filter((n) => sameRef(n.ref, ref))
      .map((n) => n.key)
      .at(-1);
  }
}

const cardTitle = (message: string) => {
  // Оригінальний текст (з великими літерами в назвах), лише без ключового слова й розділових знаків на початку.
  const t = message
    .trim()
    .replace(/^(гей|хей|ей|эй|окей|hey|ok|okay)[\s,]*(граф|graf|graph)\S*[\s,.!?]*/i, '')
    .replace(/^(гей|хей|ей|hey)(граф|graf|graph)\S*[\s,.!?]*/i, '')
    .replace(/[.!]+$/, '');
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

/** Ресторан з контексту: найближчий на шляху від фокуса до кореня (ресторан, звіт, метрика, порівняння). */
function restaurantInContext(s: NavState): string | null {
  for (const key of pathTo(s, s.focus).reverse()) {
    const { type, id } = s.nodes[key].ref;
    if (type === 'restaurant' || type === 'report') return id;
    if (type === 'metric' || type === 'comparison') return parseMetricId(id).restaurantId;
  }
  return null;
}

function period(q: string): PeriodId | null {
  if (has(q, /лют/)) return 'feb';
  if (has(q, /берез/)) return 'mar';
  if (has(q, /\bq2\b|другий квартал|другим кварталом|другого кварталу/)) return 'q2';
  if (has(q, /2025|минул\S* рок|минул\S* рік/)) return 'y2025';
  return null;
}

const kindOf = (q: string): MetricKind => (has(q, /витрат/) ? 'expenses' : 'revenue');

// ---------------------------------------------------------------- інтенти

function undo(t: Turn) {
  t.events.push({ type: 'undo' });
  t.say('Скасував попередню відповідь.');
}

function navigate(t: Turn, q: string) {
  const node = t.s.nodes[t.s.focus];
  const target = has(q, /корен|початок|початку|додому/)
    ? t.s.root
    : has(q, /назад|поверн/)
      ? node.parent
      : node.children.at(-1);
  if (!target) return t.say(has(q, /назад|поверн/) ? 'Ми вже на початку.' : 'Далі нічого не відкрито.');
  t.act({ kind: 'focus', key: target }, `Перейшов: ${title(t.s.nodes[target].ref)}`);
  t.say(`Перейшов до «${title(t.s.nodes[target].ref)}».`);
}

const FINANCE: EntityType[] = ['report', 'metric', 'comparison'];
const typeWords: [RegExp, EntityType][] = [
  [/компан/, 'company'],
  [/ресторан|заклад/, 'restaurant'],
  [/міст/, 'city'],
  [/людин|профіл/, 'person'],
  [/страв/, 'dish'],
  [/звіт|фінанс/, 'report'],
  [/поді/, 'event'],
  [/команд/, 'team'],
  [/проєкт|проект/, 'project'],
  [/задач/, 'task'],
  [/відповід|асистент/, 'assistant'],
];

function close(t: Turn, q: string, hit: Hit | null) {
  const s = t.s;
  const root = s.nodes[s.root];
  if (has(q, /крім фінанс|окрім фінанс/)) {
    const hasFinance = (key: string): boolean =>
      FINANCE.includes(s.nodes[key].ref.type) || s.nodes[key].children.some(hasFinance);
    const none = !hasFinance(s.root);
    // Найвищі гілки без фінансів на будь-якій глибині; предки фінансових карток лишаються.
    const doomed: string[] = [];
    const walk = (key: string) => s.nodes[key].children.forEach((c) => (hasFinance(c) ? walk(c) : doomed.push(c)));
    walk(s.root);
    if (!doomed.length) return t.say('Усе відкрите й так стосується фінансів.');
    for (const k of doomed) t.act({ kind: 'close', key: k }, `Закрив: ${title(s.nodes[k].ref)}`);
    const n = `${doomed.length} ${doomed.length === 1 ? 'гілку' : 'гілок'}`;
    return t.say(none ? `Фінансів на канвасі немає — закрив ${n}.` : `Закрив ${n}, фінанси лишились.`);
  }
  if (has(q, /(^|\s)(усе|все|усі|всі)(\s|$)/)) {
    if (!root.children.length) return t.say('Закривати нічого.');
    for (const k of [...root.children]) t.act({ kind: 'close', key: k }, `Закрив: ${title(s.nodes[k].ref)}`);
    return t.say('Закрив усі гілки.');
  }
  let key: string | undefined;
  if (hit) key = t.find(hit.ref);
  if (!key) {
    const type = typeWords.find(([re]) => has(q, re))?.[1];
    if (type) key = Object.values(s.nodes).filter((n) => n.ref.type === type).at(-1)?.key;
  }
  key ??= s.focus;
  if (key === s.root) return t.say('Кореневу таблицю закрити не можна.');
  const name = title(s.nodes[key].ref);
  t.act({ kind: 'close', key }, `Закрив: ${name}`);
  t.say(`Закрив гілку «${name}».`);
}

function finance(t: Turn, q: string, hit: Hit | null) {
  const rid = hit?.ref.type === 'restaurant' ? hit.ref.id : restaurantInContext(t.s);
  if (!rid) return t.say('Для якого закладу? Наприклад: «скільки заробила Пʼяна вишня».');
  const f = getFinancials(rid);
  const name = db.getRestaurant(rid).name;
  const kind = kindOf(q);
  const p = period(q);
  const m = f[kind];

  let text: string;
  if (p) {
    const other = f.history[p];
    const diff = ((m.total - other.total) / other.total) * 100;
    text = `${metricLabel[kind].chart} «${name}»: ${QUARTER} — ${usd(m.total)}, ${getPeriod(p).label} — ${usd(other.total)} (${pct(diff)}).`;
  } else {
    text = `${metricLabel[kind].total} «${name}» за ${QUARTER} — ${usd(m.total)} (${pct(m.delta)} до попереднього кварталу).`;
  }
  // З картки-відповіді одразу відкриваємо ціль — метрику чи порівняння, — без дублювання звіту й метрики.
  const target: EntityRef = p ? { type: 'comparison', id: comparisonId(rid, kind, p) } : { type: 'metric', id: metricId(rid, kind) };
  const existing = t.find(target);
  if (existing) {
    t.act({ kind: 'focus', key: existing }, `Перейшов: ${title(target)}`);
  } else {
    const cardKey = t.card(text, [{ to: target }, { to: { type: 'report', id: rid } }]);
    t.open(cardKey, target, ANSWER_VIA);
  }
  t.say(text);
}

type Who = { re: RegExp; types: EntityType[]; get: (id: string) => EntityRef[]; phrase: (name: string, n: number) => string };

const ppl = (xs: { id: string }[]): EntityRef[] => xs.map((x) => ({ type: 'person', id: x.id }));
const WHO: Who[] = [
  { re: /любить|люблять|улюблен|фанат/, types: ['dish'], get: (id) => ppl(db.loversOf(id)), phrase: (n) => `«${n}» люблять` },
  { re: /любить|люблять|улюблен|фанат/, types: ['restaurant'], get: (id) => ppl(db.fansOf(id)), phrase: (n) => `Фанати «${n}»` },
  { re: /працю|співробіт|штат/, types: ['company'], get: (id) => ppl(db.employeesOf(id)), phrase: (n) => `У «${n}» працюють` },
  { re: /працю|учасник|склад/, types: ['team'], get: (id) => ppl(work.getTeam(id).memberIds.map((pid) => ({ id: pid }))), phrase: (n) => `У команді «${n}»` },
  { re: /живе|живуть|мешка/, types: ['city'], get: (id) => ppl(db.residentsOf(id)), phrase: (n) => `У місті ${n} живуть` },
  {
    re: /ресторан|заклад|поїсти|куди піти/,
    types: ['city'],
    get: (id) => db.restaurantsIn(id).map((r) => ({ type: 'restaurant', id: r.id })),
    phrase: (n) => `Заклади в місті ${n}`,
  },
  {
    re: /меню|страв|їсти|подають/,
    types: ['restaurant'],
    get: (id) => db.dishesOf(id).map((d) => ({ type: 'dish', id: d.id })),
    phrase: (n) => `У меню «${n}»`,
  },
  {
    re: /відгук/,
    types: ['restaurant'],
    get: (id) => db.reviewsOf(id).map((r) => ({ type: 'review', id: r.id })),
    phrase: (n) => `Відгуки про «${n}»`,
  },
  {
    re: /постачальн|хто возить|хто постачає/,
    types: ['restaurant', 'ingredient', 'city'],
    get: (id) =>
      [...work.suppliersOf(id), ...work.suppliersWith(id), ...work.suppliersIn(id)].map((s) => ({ type: 'supplier', id: s.id })),
    phrase: (n) => `Постачальники для «${n}»`,
  },
  {
    re: /задач/,
    types: ['person', 'project'],
    get: (id) => [...work.tasksFor(id), ...work.tasksOf(id)].map((x) => ({ type: 'task', id: x.id })),
    phrase: (n) => `Задачі «${n}»`,
  },
];

function who(t: Turn, q: string, hit: Hit): boolean {
  const rule = WHO.find((w) => w.types.includes(hit.ref.type) && has(q, w.re));
  if (!rule) return false;
  const found = rule.get(hit.ref.id);
  if (!found.length) {
    t.card(`${rule.phrase(hit.title, 0)}: нікого не знайшов.`, [{ to: hit.ref }]);
    t.say(`${rule.phrase(hit.title, 0)} — нічого не знайшов.`);
    return true;
  }
  const names = found.map(title);
  const text = `${rule.phrase(hit.title, found.length)}: ${list(names)}.`;
  const cardKey = t.card(text, found.map((to) => ({ to })));
  // Показуємо до трьох знайдених одразу; фокус — на першій.
  const shown = found.slice(0, 3);
  for (const ref of [...shown].reverse()) t.open(cardKey, ref, ANSWER_VIA);
  t.say(found.length > 3 ? `${text} Відкрив перші три.` : text);
  return true;
}

function show(t: Turn, hit: Hit) {
  const existing = t.find(hit.ref);
  if (existing) {
    t.act({ kind: 'focus', key: existing }, `Перейшов: ${hit.title}`);
    return t.say(`«${hit.title}» уже відкрито — перейшов до неї.`);
  }
  const def = registry[hit.ref.type];
  const text = `${def.label}: ${hit.title}.`;
  const cardKey = t.card(text, [{ to: hit.ref }]);
  t.open(cardKey, hit.ref, ANSWER_VIA);
  t.say(`Відкрив «${hit.title}» (${def.label.toLowerCase()}).`);
}

function comments(t: Turn, q: string, hit: Hit | null) {
  // «коментарі до звіту Пʼяної вишні» — тред звіту, а не ресторану.
  const ref: EntityRef =
    hit?.ref.type === 'restaurant' && has(q, /звіт|фінанс/) ? { type: 'report', id: hit.ref.id } : (hit?.ref ?? t.s.nodes[t.s.focus].ref);
  const key = `${ref.type}:${ref.id}`;
  const thread = t.ctx.comments.filter((c) => c.target === key);
  const name = title(ref);
  if (!thread.length) return t.say(`До «${name}» коментарів поки немає.`);
  const authors = [...new Set(thread.map((c) => c.authorId))];
  const top = [...thread].sort((a, b) => b.likes.length - a.likes.length)[0];
  const text =
    `До «${name}» ${thread.length} ${thread.length === 1 ? 'коментар' : 'коментарі'} від ${list(authors.map((a) => db.getPerson(a).name))}. ` +
    `Найпопулярніший: «${top.text}»`;
  t.card(text, [{ to: ref }, ...authors.map((a) => ({ to: { type: 'person' as const, id: a } }))]);
  t.say(text);
}

function path(t: Turn) {
  const names = pathTo(t.s, t.s.focus).map((k) => title(t.s.nodes[k].ref));
  t.say(names.length === 1 ? `Ти на початку: «${names[0]}».` : `Шлях: ${names.join(' → ')}.`);
}

const HELP =
  'Я вмію: показати сутність («покажи Львів», «відкрий Олену»), відповісти хто/що («хто любить борщ», «які ресторани у Львові»), ' +
  'фінанси («скільки заробила Пʼяна вишня», «порівняй виручку з лютим»), закрити гілку («закрий компанію», «закрий усе крім фінансів»), ' +
  'навігацію («назад», «далі», «до початку»), коментарі («залиш коментар до Львова: тут затишно», «що в коментарях») і «скасуй».';

// ---------------------------------------------------------------- коментарі (ADR-0020)

/** Команда «залиш коментар…»: дієслово запису або «коментар» в однині на початку. */
const WRITE_COMMENT = /^(залиш\S*|лиши\S*|додай|додати|напиши|написати|запиши|записати|надиктуй|прокоментуй|коментар)(\s|$|[:,—–-])/i;

/** Про що коментар: названа сутність («до звіту Пʼяної вишні» → звіт), тип («до компанії») або поточна картка. */
function commentTarget(t: Turn, spec: string): EntityRef {
  const q = cleanCommand(spec);
  const hit = q ? findEntity(q) : null;
  if (hit) return hit.ref.type === 'restaurant' && has(q, /звіт|фінанс/) ? { type: 'report', id: hit.ref.id } : hit.ref;
  const type = q ? typeWords.find(([re]) => has(q, re))?.[1] : undefined;
  const byType = type && Object.values(t.s.nodes).filter((n) => n.ref.type === type).at(-1);
  if (byType) return byType.ref;
  // Картка-відповідь асистента — не предмет обговорення: коментуємо те, звідки питали.
  let key = t.s.focus;
  while (t.s.nodes[key].ref.type === 'assistant' && t.s.nodes[key].parent) key = t.s.nodes[key].parent!;
  return t.s.nodes[key].ref;
}

/**
 * Розбирає «[до X] [: | — | що] текст» після дієслова. Без тексту — асистент перепитає.
 * Голос не ставить двокрапок: «до Львова тут затишно» — ціль «Львова» (найкоротший початок
 * з найкращим збігом назви), решта — текст.
 */
function splitComment(rest: string, verb: string): { spec: string; text: string } {
  const sep = rest.match(/\s*[:—–]\s*/);
  if (sep?.index !== undefined) return { spec: rest.slice(0, sep.index), text: rest.slice(sep.index + sep[0].length) };
  const that = rest.match(/(^|\s)що\s+/i);
  if (that?.index !== undefined) return { spec: rest.slice(0, that.index), text: rest.slice(that.index + that[0].length) };
  const aboutTarget = /^до\s/i.test(rest) || /^прокоментуй/i.test(verb);
  if (!aboutTarget) return { spec: '', text: rest };

  const words = rest.replace(/^до\s+/i, '').split(/\s+/).filter(Boolean);
  let best = { k: 0, score: 0 };
  for (let k = 1; k <= Math.min(5, words.length); k++) {
    const hit = findEntity(cleanCommand(words.slice(0, k).join(' ')));
    if (hit && hit.score > best.score) best = { k, score: hit.score };
  }
  // Лише тип («до компанії …»): перше слово — ціль.
  if (!best.k && typeWords.some(([re]) => has(normalize(words[0] ?? ''), re))) best = { k: 1, score: 0 };
  if (!best.k) return { spec: rest, text: '' };
  return { spec: words.slice(0, best.k).join(' '), text: words.slice(best.k).join(' ') };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function writeComment(t: Turn, target: EntityRef, text: string) {
  const clean = capitalize(text.trim());
  const name = title(target);
  t.events.push({ type: 'comment', target, text: clean, label: `Коментар до «${name}»` });
  t.events.push({ type: 'await', awaiting: null });
  // Якщо сутність відкрита — переводимо фокус, щоб було видно лічильник коментарів.
  const key = t.find(target);
  if (key && key !== t.s.focus) t.act({ kind: 'focus', key }, `Перейшов: ${name}`);
  t.say(`Записав коментар до «${name}»: «${clean}».`);
}

function comment(t: Turn, message: string) {
  const original = stripLead(message);
  const m = original.match(WRITE_COMMENT)!;
  const verb = m[1];
  // «залиш мені коментар», «напиши коментар»: прибираємо саме слово «коментар».
  const rest = original
    .slice(m[0].length)
    .replace(/^\s*(мені\s+)?(коментар\S*|комент)(\s|$)/i, '')
    .trim();
  const { spec, text } = splitComment(rest, verb);
  const target = commentTarget(t, spec.replace(/^до\s+/i, ''));
  if (text.trim()) return writeComment(t, target, text);
  t.events.push({ type: 'await', awaiting: { kind: 'comment', target } });
  t.say(`Що написати в коментарі до «${title(target)}»? Скажи текст або «скасуй».`);
}

/** Диктування: уся репліка — текст коментаря; «скасуй» — без коментаря. */
function dictation(t: Turn, message: string, target: EntityRef) {
  const text = stripLead(message);
  if (has(cleanCommand(text), /^(скасу|відмін|не треба|нічого|забудь)/)) {
    t.events.push({ type: 'await', awaiting: null });
    return t.say('Добре, коментар не записую.');
  }
  if (!text) return t.say('Не почув тексту. Скажи ще раз або «скасуй».');
  writeComment(t, target, text);
}

/** Поточна картка як «згадана сутність» — для продовження розмови без назви. */
const focusHit = (t: Turn): Hit => {
  const ref = t.s.nodes[t.s.focus].ref;
  return { ref, title: title(ref), score: 1, matched: 1 };
};

/** Розбирає фразу і будує хід. Чиста функція: зручно тестувати. */
export function plan(message: string, ctx: GraphContext): Turn {
  const t = new Turn(ctx, message);
  if (ctx.awaiting?.kind === 'comment') {
    dictation(t, message, ctx.awaiting.target);
    return t;
  }
  // Без «гей граф», «будь ласка», «ну»…: розпізнане голосом рідко починається одразу з дієслова.
  const q = cleanCommand(message);
  const hit = findEntity(q);

  if (!q) t.say('Слухаю. Спробуй: «покажи Львів».');
  else if (has(q, /^(скасу|відмін|поверни як було)/)) undo(t);
  else if (has(q, /що ти вмієш|допомога|допоможи|^help/)) t.say(HELP);
  else if (has(q, /як я сюди|де я|мій шлях|шлях/)) path(t);
  else if (has(q, /^(закри|прибер|згорн|сховай)/)) close(t, q, hit);
  else if (has(q, /^(назад|поверн|далі|вперед|до корен|до початку|на початок|додому)/)) navigate(t, q);
  else if (WRITE_COMMENT.test(stripLead(message)) && !has(q, /^коментар(і|ях|ів)/)) comment(t, message);
  else if (has(q, /коментар/)) comments(t, q, hit);
  else if (has(q, /скільки|виручк|фінанс|заробил|заробив|дохід|витрат|порівня|прибут/) && (!hit || hit.ref.type === 'restaurant'))
    finance(t, q, hit);
  else if (hit && who(t, q, hit)) {
    /* відповів */
  } else if (!hit && who(t, q, focusHit(t))) {
    /* «а хто там живе?» — про поточну картку */
  } else if (hit) show(t, hit);
  else t.say(`Не знайшов, про що йдеться. ${HELP}`);
  return t;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockAssistant implements Assistant {
  constructor(private delayMs = 18) {}

  async *respond(message: string, ctx: GraphContext): AsyncIterable<AssistantEvent> {
    const t = plan(message, ctx);
    if (this.delayMs) await sleep(this.delayMs * 10); // «думаю»
    // Спершу дії — користувач бачить, що асистент робить, — потім текст шматочками, як у стрімінгу моделі.
    for (const e of t.events) yield e;
    for (const chunk of t.text.match(/\S+\s*/g) ?? []) {
      if (this.delayMs) await sleep(this.delayMs);
      yield { type: 'text', delta: chunk };
    }
  }
}
