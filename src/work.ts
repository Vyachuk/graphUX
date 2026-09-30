// Робочий домен для стрес-тесту (ADR-0013): команди, проєкти, задачі, постачальники, замовлення.
// Генерується детерміновано; обсяг вмісту навмисно різний, щоб картки мали різну висоту.
import { companies, dishesOf, employeesOf, getCity, getDish, ingredients, people, restaurants } from './data';
import { int, pick, sample, seeded } from './seeded';

export type Team = {
  id: string;
  name: string;
  companyId: string;
  leadId: string;
  memberIds: string[];
};

export type ProjectStatus = 'Планування' | 'В роботі' | 'На паузі' | 'Завершено';

export type Project = {
  id: string;
  name: string;
  teamId: string;
  clientRestaurantId: string;
  status: ProjectStatus;
  budget: number;
  deadline: string;
  description: string[];
};

export type Priority = 'Низький' | 'Середній' | 'Високий' | 'Критичний';

export type Task = {
  id: string;
  title: string;
  projectId: string;
  assigneeId: string;
  priority: Priority;
  checklist: { text: string; done: boolean }[];
  tags: string[];
};

export type Supplier = {
  id: string;
  name: string;
  cityId: string;
  rating: number;
  ingredientIds: string[];
  restaurantIds: string[];
};

export type OrderStatus = 'Нове' | 'Готується' | 'Доставлено' | 'Скасовано';

export type Order = {
  id: string;
  personId: string;
  restaurantId: string;
  date: string;
  status: OrderStatus;
  items: { dishId: string; qty: number }[];
};

const rand = seeded('work-domain');
const date = (month: number) => `2026-${String(month).padStart(2, '0')}-${String(int(rand, 1, 28)).padStart(2, '0')}`;

const teamNames = ['Core', 'Growth', 'Platform', 'Mobile', 'Payments', 'Insights', 'Delivery', 'Kitchen OS'];

export const teams: Team[] = companies.flatMap((c, ci) =>
  [0, 1].map((ti) => {
    const staff = employeesOf(c.id);
    const lead = staff[ti % staff.length];
    const others = sample(rand, people.filter((p) => p.id !== lead.id), int(rand, 1, 5));
    return {
      id: `t${ci * 2 + ti + 1}`,
      name: `${c.name} · ${teamNames[ci * 2 + ti]}`,
      companyId: c.id,
      leadId: lead.id,
      memberIds: [lead.id, ...others.map((p) => p.id)],
    };
  }),
);

const projectNames = [
  'Онлайн-бронювання столиків', 'Програма лояльності', 'QR-меню', 'Прогноз закупівель',
  'Кухонний дисплей', 'Аналітика відгуків', 'Доставка за 30 хвилин', 'Єдиний POS',
  'Інвентаризація бару', 'Графік змін персоналу', 'Динамічні ціни', 'Чайові онлайн',
  'Фінансовий дашборд', 'Мобільний офіціант', 'Контроль алергенів', 'Відеоспостереження кухні',
];

const descriptionPool = [
  'Ціль — скоротити час обслуговування гостя щонайменше на 20%.',
  'Пілот запускаємо в одному закладі, далі масштабуємо на всю мережу.',
  'Інтеграція з наявною касою обовʼязкова, міграцію даних робимо поетапно.',
  'Ризик: сезонне навантаження в грудні, тому реліз до кінця листопада.',
  'Метрики успіху погоджені з операційним директором.',
  'Дизайн узгоджуємо з брендбуком закладу, без окремої айдентики.',
  'Потрібна підтримка офлайн-режиму, бо у підвалах слабкий звʼязок.',
  'Бюджет включає навчання персоналу та два тижні супроводу після запуску.',
];

const statuses: ProjectStatus[] = ['Планування', 'В роботі', 'В роботі', 'На паузі', 'Завершено'];

export const projects: Project[] = teams.flatMap((t, ti) =>
  [0, 1].map((pi) => ({
    id: `pr${ti * 2 + pi + 1}`,
    name: projectNames[ti * 2 + pi],
    teamId: t.id,
    clientRestaurantId: pick(rand, restaurants).id,
    status: pick(rand, statuses),
    budget: int(rand, 8, 120) * 1000,
    deadline: date(int(rand, 10, 12)),
    description: sample(rand, descriptionPool, int(rand, 1, 5)),
  })),
);

const taskVerbs = ['Спроєктувати', 'Реалізувати', 'Протестувати', 'Задокументувати', 'Оптимізувати', 'Погодити'];
const taskObjects = ['API замовлень', 'екран оплати', 'звіт по змінах', 'міграцію даних', 'push-сповіщення', 'рольову модель', 'імпорт меню', 'інтеграцію з касою'];
const checklistPool = [
  'Зібрати вимоги', 'Намалювати флоу', 'Написати тести', 'Code review', 'Оновити ADR',
  'Перевірити на планшеті', 'Показати шефу', 'Прогнати навантаження', 'Виправити зауваження', 'Реліз у пілоті',
];
const tagPool = ['frontend', 'backend', 'ux', 'infra', 'data', 'security', 'urgent'];
const priorities: Priority[] = ['Низький', 'Середній', 'Середній', 'Високий', 'Критичний'];

export const tasks: Task[] = projects.flatMap((pr, pi) => {
  const team = teams.find((t) => t.id === pr.teamId)!;
  return [0, 1, 2].map((k) => ({
    id: `tk${pi * 3 + k + 1}`,
    title: `${pick(rand, taskVerbs)} ${pick(rand, taskObjects)}`,
    projectId: pr.id,
    assigneeId: pick(rand, team.memberIds),
    priority: pick(rand, priorities),
    checklist: sample(rand, checklistPool, int(rand, 1, 7)).map((text) => ({ text, done: rand() < 0.5 })),
    tags: sample(rand, tagPool, int(rand, 0, 3)),
  }));
});

const supplierSeed: { name: string; cityId: string }[] = [
  { name: 'Карпатська ферма', cityId: 'lviv' },
  { name: 'Молочний двір', cityId: 'lviv' },
  { name: 'Київ Агро', cityId: 'kyiv' },
  { name: 'Чорноморський улов', cityId: 'odesa' },
  { name: 'Hurtownia Mazowsze', cityId: 'warsaw' },
  { name: 'Mąka i Cukier', cityId: 'krakow' },
];

export const suppliers: Supplier[] = supplierSeed.map((s, i) => {
  const country = getCity(s.cityId).countryId;
  const local = restaurants.filter((r) => getCity(r.cityId).countryId === country);
  return {
    id: `s${i + 1}`,
    ...s,
    rating: Math.round((3.8 + rand() * 1.2) * 10) / 10,
    ingredientIds: sample(rand, ingredients, int(rand, 2, 8)).map((x) => x.id),
    restaurantIds: sample(rand, local, int(rand, 1, 4)).map((r) => r.id),
  };
});

const orderStatuses: OrderStatus[] = ['Нове', 'Готується', 'Доставлено', 'Доставлено', 'Скасовано'];

export const orders: Order[] = Array.from({ length: 24 }, (_, i) => {
  const restaurant = pick(rand, restaurants);
  const menu = dishesOf(restaurant.id);
  return {
    id: `o${i + 1}`,
    personId: pick(rand, people).id,
    restaurantId: restaurant.id,
    date: date(9),
    status: pick(rand, orderStatuses),
    items: sample(rand, menu, int(rand, 1, menu.length)).map((d) => ({ dishId: d.id, qty: int(rand, 1, 4) })),
  };
});

const byId = <T extends { id: string }>(list: T[]) => (id: string) => {
  const item = list.find((x) => x.id === id);
  if (!item) throw new Error(`Unknown id: ${id}`);
  return item;
};

export const getTeam = byId(teams);
export const getProject = byId(projects);
export const getTask = byId(tasks);
export const getSupplier = byId(suppliers);
export const getOrder = byId(orders);

export const teamsOf = (companyId: string) => teams.filter((t) => t.companyId === companyId);
export const teamsWith = (personId: string) => teams.filter((t) => t.memberIds.includes(personId));
export const projectsOf = (teamId: string) => projects.filter((p) => p.teamId === teamId);
export const projectsFor = (restaurantId: string) => projects.filter((p) => p.clientRestaurantId === restaurantId);
export const tasksOf = (projectId: string) => tasks.filter((t) => t.projectId === projectId);
export const tasksFor = (personId: string) => tasks.filter((t) => t.assigneeId === personId);
export const suppliersOf = (restaurantId: string) => suppliers.filter((s) => s.restaurantIds.includes(restaurantId));
export const suppliersWith = (ingredientId: string) => suppliers.filter((s) => s.ingredientIds.includes(ingredientId));
export const suppliersIn = (cityId: string) => suppliers.filter((s) => s.cityId === cityId);
export const ordersBy = (personId: string) => orders.filter((o) => o.personId === personId);
export const ordersAt = (restaurantId: string) => orders.filter((o) => o.restaurantId === restaurantId);

/** Сума замовлення в «сирих» цінах страв (валюта — як у formatPrice). */
export const orderTotal = (o: Order) => o.items.reduce((sum, it) => sum + getDish(it.dishId).price * it.qty, 0);
