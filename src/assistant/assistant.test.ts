import { describe, expect, it } from 'vitest';
import { seedComments } from '../comments';
import { initialNav, navReducer, pathTo, type NavState } from '../navigation';
import { getCard, putCard } from './cards';
import { MockAssistant, plan } from './mock';
import { findEntity, wordMatch } from './search';
import type { AssistantEvent, GraphContext } from './types';

const ctx = (state: NavState = initialNav): GraphContext => ({ state, comments: seedComments(0), userId: 'p1' });

/** Програє хід через справжній navReducer: реєструє картки, виконує дії. */
function run(message: string, state: NavState = initialNav) {
  const t = plan(message, ctx(state));
  let s = state;
  for (const e of t.events) {
    if (e.type === 'card') putCard(e.card);
    if (e.type === 'action') s = navReducer(s, e.action);
  }
  const focus = s.nodes[s.focus];
  return { t, s, focus: focus.ref, text: t.text };
}

describe('пошук сутностей', () => {
  it.each([
    ['відкрий Олену', 'person', 'p1'],
    ['що у Львові', 'city', 'lviv'],
    ['у Києві', 'city', 'kyiv'],
    ['пʼяної вишні', 'restaurant', 'r8'],
    ["П'яна вишня", 'restaurant', 'r8'],
    ['реберня', 'restaurant', 'r7'],
    ['реберня на узвозі', 'restaurant', 'r1'],
    ['hlib labs', 'company', 'c1'],
    ['борщ', 'dish', 'd2'],
    ['Тараса', 'person', 'p6'],
  ])('«%s» → %s:%s', (q, type, id) => {
    expect(findEntity(q)?.ref).toEqual({ type, id });
  });

  it('відмінки через початок слова', () => {
    expect(wordMatch('львові', 'львів')).toBe(true);
    expect(wordMatch('вишні', 'вишня')).toBe(true);
    expect(wordMatch('кава', 'київ')).toBe(false);
    expect(wordMatch('борщ', 'борошно')).toBe(false);
  });

  it('службові слова не дають хибних збігів', () => {
    expect(findEntity('покажи будь ласка')).toBeNull();
  });
});

describe('мок: інтенти', () => {
  it('«покажи Львів» — картка-відповідь поруч із фокусом, з неї відкрито місто', () => {
    const { s, focus, text } = run('покажи Львів');
    expect(focus).toEqual({ type: 'city', id: 'lviv' });
    const parent = s.nodes[s.nodes[s.focus].parent!];
    expect(parent.ref.type).toBe('assistant');
    expect(parent.via).toBe('✦ AI');
    expect(s.nodes[s.focus].via).toBe('answer');
    expect(getCard(parent.ref.id).links).toEqual([{ to: { type: 'city', id: 'lviv' } }]);
    expect(text).toMatch(/Львів/);
  });

  it('«гей граф, відкрий Олену» — ключове слово відкидається', () => {
    expect(run('Гей граф, відкрий Олену').focus).toEqual({ type: 'person', id: 'p1' });
  });

  it('уже відкрита сутність — лише фокус, без нової картки', () => {
    const { s } = run('покажи Львів');
    const again = run('відкрий Львів', navReducer(s, { kind: 'focus', key: 'n0' }));
    expect(again.focus).toEqual({ type: 'city', id: 'lviv' });
    expect(Object.keys(again.s.nodes)).toHaveLength(Object.keys(s.nodes).length);
  });

  it('«хто любить борщ» — список у картці, знайдені відкриті', () => {
    const { s, focus, text } = run('хто любить борщ');
    expect(text).toMatch(/Олена Коваль/);
    expect(focus).toEqual({ type: 'person', id: 'p1' });
    const card = getCard(s.nodes[s.nodes[s.focus].parent!].ref.id);
    expect(card.links.map((l) => l.to.id)).toEqual(['p1']);
  });

  it('«які ресторани у Львові» — до трьох відкрито, решта в картці', () => {
    const { s, text } = run('які ресторани у Львові');
    const cardNode = Object.values(s.nodes).find((n) => n.ref.type === 'assistant')!;
    expect(getCard(cardNode.ref.id).links).toHaveLength(7);
    expect(cardNode.children).toHaveLength(3);
    expect(text).toMatch(/Відкрив перші три/);
  });

  it('«скільки заробила Пʼяна вишня» — картка-відповідь → виручка', () => {
    const { s, focus, text } = run('скільки заробила Пʼяна вишня');
    expect(focus).toEqual({ type: 'metric', id: 'r8.revenue' });
    expect(text).toMatch(/\$181,900/);
    // via — ті самі, що на картках: ребра стартують від рядків
    expect(pathTo(s, s.focus).map((k) => s.nodes[k].via ?? '')).toEqual(['', '✦ AI', 'answer']);
  });

  it('порівняння після фінансів не дублює звіт і метрику', () => {
    const { s } = run('скільки заробила Пʼяна вишня');
    const cmp = run('порівняй виручку з лютим', s);
    const types = Object.values(cmp.s.nodes).map((n) => n.ref.type);
    expect(types.filter((t) => t === 'metric')).toHaveLength(1);
    expect(cmp.focus).toEqual({ type: 'comparison', id: 'r8.revenue.feb' });
    // повторне те саме питання — лише фокус
    const again = run('порівняй виручку з лютим', navReducer(cmp.s, { kind: 'focus', key: 'n0' }));
    expect(Object.keys(again.s.nodes)).toHaveLength(Object.keys(cmp.s.nodes).length);
  });

  it('«порівняй витрати Пʼяної вишні з лютим» — до порівняння', () => {
    const { focus, text } = run('порівняй витрати Пʼяної вишні з лютим');
    expect(focus).toEqual({ type: 'comparison', id: 'r8.expenses.feb' });
    expect(text).toMatch(/Лютий/);
  });

  it('фінанси без назви беруть ресторан з контексту', () => {
    const { s } = run('скільки заробила Пʼяна вишня');
    expect(run('порівняй виручку з березнем', s).focus).toEqual({ type: 'comparison', id: 'r8.revenue.mar' });
  });

  it('навігація: назад, далі, до початку', () => {
    const { s } = run('покажи Львів');
    const back = run('назад', s);
    expect(back.focus.type).toBe('assistant');
    expect(run('далі', back.s).focus).toEqual({ type: 'city', id: 'lviv' });
    expect(run('до початку', s).s.focus).toBe('n0');
  });

  it('закрий: фокус, за назвою, за типом, усе крім фінансів', () => {
    const a = run('покажи Львів');
    const closed = run('закрий', a.s);
    expect(Object.values(closed.s.nodes).some((n) => n.ref.id === 'lviv')).toBe(false);

    const b = run('покажи Hlib Labs', a.s);
    expect(Object.values(run('закрий компанію', b.s).s.nodes).some((n) => n.ref.type === 'company')).toBe(false);
    expect(Object.values(run('закрий Львів', b.s).s.nodes).some((n) => n.ref.id === 'lviv')).toBe(false);

    // Дві гілки від кореня: Львів і фінанси.
    const f = run('скільки заробила Пʼяна вишня', navReducer(b.s, { kind: 'focus', key: 'n0' }));
    const onlyFin = run('закрий усе крім фінансів', f.s).s;
    expect(Object.values(onlyFin.nodes).map((n) => n.ref.type)).toEqual(expect.arrayContaining(['assistant', 'metric']));
    expect(Object.values(onlyFin.nodes).some((n) => n.ref.type === 'city' || n.ref.type === 'company')).toBe(false);
  });

  it('корінь не закривається', () => {
    expect(run('закрий').text).toMatch(/не можна/);
  });

  it('«скасуй» — подія undo', () => {
    expect(run('скасуй').t.events).toEqual([{ type: 'undo' }]);
  });

  it('коментарі до фокуса і шлях', () => {
    const { s } = run('скільки заробила Пʼяна вишня');
    const r = run('що в коментарях до звіту Пʼяної вишні', s);
    expect(r.text).toMatch(/2 коментарі/);
    expect(run('як я сюди дійшов', s).text).toMatch(/Усі люди → .* → Revenue/);
  });

  it('незрозуміле — підказка', () => {
    expect(run('абракадабра').text).toMatch(/Я вмію/);
  });
});

describe('MockAssistant', () => {
  it('спершу картки й дії, потім текст шматочками', async () => {
    const events: AssistantEvent[] = [];
    for await (const e of new MockAssistant(0).respond('покажи Львів', ctx())) events.push(e);
    const types = events.map((e) => e.type);
    expect(types.indexOf('card')).toBeLessThan(types.indexOf('action'));
    expect(types.lastIndexOf('action')).toBeLessThan(types.indexOf('text'));
    expect(events.filter((e) => e.type === 'text').length).toBeGreaterThan(1);
  });
});

describe('підказки', () => {
  const refs = [
    { type: 'people', id: 'all' },
    { type: 'person', id: 'p1' },
    { type: 'restaurant', id: 'r8' },
    { type: 'city', id: 'lviv' },
    { type: 'dish', id: 'd2' },
    { type: 'company', id: 'c1' },
    { type: 'team', id: 't1' },
    { type: 'report', id: 'r8' },
    { type: 'metric', id: 'r8.revenue' },
  ] as const;

  it.each(refs)('%o: кожну підказку мок розуміє', async (ref) => {
    const { suggestions } = await import('./suggest');
    // стан: картка з цією сутністю у фокусі
    const s = navReducer(initialNav, { kind: 'open', from: 'n0', ref: { ...ref }, via: 'x' });
    for (const q of suggestions(ref)) {
      const r = run(q, ref.type === 'people' ? initialNav : s);
      expect(r.text, q).not.toMatch(/Я вмію|Не знайшов|Для якого закладу/);
    }
  });
});

describe('«Гей, граф» (ADR-0019)', async () => {
  const { detectWake, findWake, commandFrom, cleanCommand } = await import('./wake');

  // Реальні варіанти, які видає розпізнавання Chrome для «Гей, граф».
  it.each([
    ['Гей граф покажи Львів', 'покажи Львів'],
    ['гей, граф, відкрий Олену', 'відкрий Олену'],
    ['Гей, граф. Покажи Львів.', 'Покажи Львів.'],
    ['хей граф назад', 'назад'],
    ['Гей графе скільки заробила пʼяна вишня', 'скільки заробила пʼяна вишня'],
    ['Hey Graf покажи Львів', 'покажи Львів'],
    ['hey graph покажи Львів', 'покажи Львів'],
    ['Гей Graf покажи Львів', 'покажи Львів'],
    ['гейграф далі', 'далі'],
    ['Гей грав закрий', 'закрий'],
    ['окей граф назад', 'назад'],
    ['ну гей граф', ''],
    ['эй граф закрий', 'закрий'],
  ])('«%s» → «%s»', (heard, rest) => {
    expect(detectWake(heard)).toEqual({ woke: true, rest });
  });

  it.each(['покажи Львів', 'гей друже', 'граф відкрий', 'гей гра', 'хай буде так'])('«%s» — не ключове слово', (heard) => {
    expect(detectWake(heard).woke).toBe(false);
  });

  it('ключове слово в не першому варіанті розпізнавання', () => {
    expect(findWake([['гей граф'], ['а граф', 'гей граф покажи львів']])).toBe(1);
  });

  it('ключове слово на стику двох фраз', () => {
    expect(findWake([['гей'], ['граф покажи львів']])).toBe(0);
    expect(commandFrom([['гей'], ['граф покажи Львів']], 0)).toBe('покажи Львів');
  });

  it('пауза після «Гей, граф»: команда в наступній фразі', () => {
    const heard = [['Гей граф'], ['покажи Львів']];
    expect(findWake(heard.slice(0, 1))).toBe(0);
    expect(commandFrom(heard.slice(0, 1), 0)).toBe(''); // ще нічого не сказано — чекаємо, не відправляємо
    expect(commandFrom(heard, 0)).toBe('покажи Львів');
  });

  it('обирає варіант, у якому є відома сутність', () => {
    expect(commandFrom([['гей граф покажи лев', 'гей граф покажи Львів']], 0)).toBe('покажи Львів');
  });

  it('прибирає вставні слова на початку', () => {
    expect(cleanCommand('Гей граф, будь ласка, покажи Львів')).toBe('покажи львів');
    expect(cleanCommand('ну а можеш закрити компанію')).toBe('закрити компанію');
  });
});

describe('мок: розмовні формулювання (ADR-0019)', () => {
  it.each([
    ['будь ласка, покажи Львів', 'city', 'lviv'],
    ['а відкрий Олену', 'person', 'p1'],
    ['можеш показати Львів?', 'city', 'lviv'],
    ['Гей граф. Покажи Львів.', 'city', 'lviv'],
    ['Hey Graf покажи Львів', 'city', 'lviv'],
    ['ну скільки заробила Пʼяна вишня', 'metric', 'r8.revenue'],
  ])('«%s» → %s:%s', (q, type, id) => {
    expect(run(q).focus).toEqual({ type, id });
  });

  it('«закрити», «закрийте», «можеш закрити»', () => {
    const { s } = run('покажи Львів');
    for (const q of ['закрити', 'закрийте', 'можеш закрити']) {
      expect(Object.values(run(q, s).s.nodes).some((n) => n.ref.id === 'lviv'), q).toBe(false);
    }
  });

  it('«скасуйте», «поверніться назад»', () => {
    expect(run('скасуйте').t.events).toEqual([{ type: 'undo' }]);
    const { s } = run('покажи Львів');
    expect(run('поверніться назад', s).focus.type).toBe('assistant');
  });

  it('продовження без назви — про поточну картку: «а хто там живе?»', () => {
    const { s } = run('покажи Львів');
    const r = run('а хто там живе?', s);
    expect(r.text).toMatch(/У місті Львів живуть/);
  });

  it('заголовок картки зберігає великі літери назв', () => {
    const { s } = run('Гей граф, покажи Львів.');
    const card = Object.values(s.nodes).find((n) => n.ref.type === 'assistant')!;
    expect(getCard(card.ref.id).title).toBe('Покажи Львів');
  });
});

describe('коментар голосом і в чаті (ADR-0020)', () => {
  /** Хід з урахуванням очікування диктування. */
  const turn = (message: string, state: NavState = initialNav, awaiting: GraphContext['awaiting'] = null) => {
    const t = plan(message, { ...ctx(state), awaiting });
    const comment = t.events.find((e) => e.type === 'comment');
    const wait = t.events.filter((e) => e.type === 'await').at(-1);
    return { t, comment: comment?.type === 'comment' ? comment : null, awaiting: wait?.type === 'await' ? wait.awaiting : undefined };
  };

  it('одною фразою з двокрапкою: ціль і текст', () => {
    const { comment, awaiting } = turn('Гей граф, залиш коментар до Львова: тут дуже затишно!');
    expect(comment).toMatchObject({ target: { type: 'city', id: 'lviv' }, text: 'Тут дуже затишно!' });
    expect(awaiting).toBeNull();
  });

  it('голосом без розділових знаків: «до Львова тут дуже затишно»', () => {
    expect(turn('залиш коментар до Львова тут дуже затишно').comment).toMatchObject({
      target: { type: 'city', id: 'lviv' },
      text: 'Тут дуже затишно',
    });
  });

  it('«…до звіту Пʼяної вишні маркетинг задорогий» — коментар до звіту, назва не потрапляє в текст', () => {
    expect(turn('напиши коментар до звіту Пʼяної вишні маркетинг задорогий').comment).toMatchObject({
      target: { type: 'report', id: 'r8' },
      text: 'Маркетинг задорогий',
    });
  });

  it('«напиши коментар що …» — до поточної картки', () => {
    const s = navReducer(initialNav, { kind: 'open', from: 'n0', ref: { type: 'restaurant', id: 'r1' }, via: 'x' });
    expect(turn('напиши коментар що тут дорого', s).comment).toMatchObject({
      target: { type: 'restaurant', id: 'r1' },
      text: 'Тут дорого',
    });
  });

  it('коментар до картки-відповіді йде до того, звідки питали', () => {
    const { s } = run('скільки заробила Пʼяна вишня');
    const onCard = navReducer(s, { kind: 'focus', key: s.nodes[s.focus].parent! });
    expect(turn('коментар гарний квартал', onCard).comment?.target).toEqual({ type: 'people', id: 'all' });
  });

  it('у два кроки: «залиш коментар до Олени» → «Що написати?» → текст', () => {
    const ask = turn('Гей граф, залиш коментар до Олени');
    expect(ask.comment).toBeNull();
    expect(ask.awaiting).toEqual({ kind: 'comment', target: { type: 'person', id: 'p1' } });
    expect(ask.t.text).toMatch(/Що написати/);

    const dictated = turn('Олена чудово веде редизайн, дякую', initialNav, ask.awaiting);
    expect(dictated.comment).toMatchObject({ target: { type: 'person', id: 'p1' }, text: 'Олена чудово веде редизайн, дякую' });
    expect(dictated.awaiting).toBeNull();
    expect(dictated.t.text).toMatch(/Записав коментар до «Олена Коваль»/);
  });

  it('під час диктування «скасуй» — без коментаря', () => {
    const r = turn('скасуй', initialNav, { kind: 'comment', target: { type: 'city', id: 'lviv' } });
    expect(r.comment).toBeNull();
    expect(r.awaiting).toBeNull();
  });

  it('читання коментарів не плутається із записом', () => {
    const { s } = run('скільки заробила Пʼяна вишня');
    expect(turn('що в коментарях до звіту Пʼяної вишні', s).comment).toBeNull();
    expect(turn('коментарі до звіту Пʼяної вишні', s).comment).toBeNull();
  });

  it('відкрита ціль отримує фокус — видно лічильник коментарів', () => {
    const { s } = run('покажи Львів');
    const back = navReducer(s, { kind: 'focus', key: 'n0' });
    const r = turn('залиш коментар до Львова: гарне місто', back);
    expect(r.t.events.some((e) => e.type === 'action' && e.action.kind === 'focus')).toBe(true);
  });
});
