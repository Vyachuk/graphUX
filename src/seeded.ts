// Детермінований генератор, щоб мок-дані не стрибали між перезавантаженнями.
export function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Випадковий елемент масиву. */
export const pick = <T,>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)];

/** Ціле з [min, max]. */
export const int = (rand: () => number, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/** Кілька різних елементів масиву. */
export function sample<T>(rand: () => number, list: readonly T[], count: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
