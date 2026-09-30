// Ключове слово «Гей, граф» і виділення команди з результатів розпізнавання (ADR-0018, ADR-0019).
// Чиста логіка без Web Speech — щоб тестувати на реалістичних транскрипціях Chrome.
import { findEntity, levenshtein, normalize } from './search';

/** Варіанти «гей», які видає розпізнавання (зокрема латиницею й російською «э»). */
const HEY = ['гей', 'хей', 'ей', 'эй', 'хай', 'гай', 'гєй', 'окей', 'окай', 'hey', 'hei', 'hi', 'okay', 'ok'];

const isHey = (w: string) => HEY.includes(w) || (w.length >= 3 && HEY.some((h) => h.length >= 3 && levenshtein(w, h) <= 1));

/** «граф», «графе», «графа», «грав», «граф'», «graf», «graph», «grab»… */
const isGraf = (w: string) =>
  /^(граф|graf|graph)/.test(w) || (w.length >= 4 && ['граф', 'graf'].some((g) => levenshtein(w.slice(0, 4), g) <= 1));

/**
 * Шукає «гей граф» у розпізнаному тексті (регістр, розділові знаки, латиниця, «гейграф» разом).
 * `rest` — усе після ключового слова в оригінальному написанні: «Гей граф, покажи Львів!» → «покажи Львів!».
 */
export function detectWake(transcript: string): { woke: boolean; rest: string } {
  const raw = transcript.split(/\s+/).filter(Boolean);
  // Порівнюємо нормалізовані слова, повертаємо оригінальні (з великими літерами назв).
  const words = raw.map((w) => normalize(w).replace(/\s/g, ''));
  const rest = (from: number) =>
    raw
      .slice(from)
      .join(' ')
      .replace(/^[\s,.!?:;—-]+/, '')
      .trim();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^(гей|хей|ей|эй|hey)(граф|graf|graph)/.test(w)) return { woke: true, rest: rest(i + 1) };
    // «граф» може бути наступним непорожнім словом (після «гей, —» тощо).
    const j = words.findIndex((x, k) => k > i && x);
    if (w && isHey(w) && j > 0 && isGraf(words[j])) return { woke: true, rest: rest(j + 1) };
  }
  return { woke: false, rest: '' };
}

/** Результати розпізнавання: для кожної фрази — її варіанти (перший — найімовірніший). */
export type Heard = string[][];

/**
 * Чи прозвучало ключове слово в останній фразі — у будь-якому з її варіантів,
 * або на стику двох останніх («гей» закінчило одну фразу, «граф» почав наступну).
 * Повертає індекс фрази, з якої починається команда.
 */
export function findWake(heard: Heard): number | null {
  const last = heard.length - 1;
  if (last < 0) return null;
  if (heard[last].some((alt) => detectWake(alt).woke)) return last;
  if (last > 0 && detectWake(`${heard[last - 1][0]} ${heard[last][0]}`).woke) return last - 1;
  return null;
}

/**
 * Текст команди від фрази `start` до кінця, без ключового слова.
 * Для кожної фрази беремо перший варіант, але якщо в ньому немає жодної відомої сутності,
 * а в іншому варіанті є, — беремо той («покажи львів» замість «покажи лев»).
 */
export function commandFrom(heard: Heard, start: number): string {
  const pick = (alts: string[]) => {
    const clean = alts.map((a) => {
      const w = detectWake(a);
      return (w.woke ? w.rest : a).trim();
    });
    if (findEntity(clean[0])) return clean[0];
    return clean.find((c) => findEntity(c)) ?? clean[0];
  };
  // Ключове слово могло бути розбите між фразами: прибираємо його зі склеєного тексту.
  const text = heard.slice(start).map(pick).join(' ').trim();
  const w = detectWake(text);
  return (w.woke ? w.rest : text).trim();
}

/** Службові слова на початку команди: «ну», «будь ласка», «можеш»… */
const FILLERS = new Set(['ну', 'а', 'і', 'й', 'та', 'так', 'будь', 'ласка', 'можеш', 'можете', 'можна', 'мені', 'прошу', 'слухай', 'давай', 'ще', 'от', 'ось']);

/** Прибирає ключове слово і службові слова на початку: «гей граф, будь ласка, покажи Львів» → «покажи львів». */
export function cleanCommand(text: string): string {
  const w = detectWake(text);
  const words = normalize(w.woke ? w.rest : text).split(' ').filter(Boolean);
  while (words.length > 1 && FILLERS.has(words[0])) words.shift();
  return words.join(' ');
}

/**
 * Як cleanCommand, але зберігає оригінальний текст (регістр, розділові знаки) —
 * для тексту коментаря: «Гей граф, будь ласка, залиш коментар: Тут дорого!» → «залиш коментар: Тут дорого!».
 */
export function stripLead(text: string): string {
  const w = detectWake(text);
  const words = (w.woke ? w.rest : text.trim()).split(/\s+/).filter(Boolean);
  while (words.length > 1 && FILLERS.has(normalize(words[0]))) words.shift();
  return words.join(' ').replace(/^[\s,.!?:;—-]+/, '');
}
