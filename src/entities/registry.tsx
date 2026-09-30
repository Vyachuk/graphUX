// Реєстр сутностей (ADR-0005). Новий тип = компонент + рядок тут + значення в EntityType.
import type { ComponentType } from 'react';
import {
  getCity,
  getCompany,
  getCountry,
  getDish,
  getEvent,
  getIngredient,
  getPerson,
  getRestaurant,
  getReview,
} from '../data';
import type { EntityType } from '../navigation';
import { CityView } from './CityView';
import { CompanyView } from './CompanyView';
import { CountryView } from './CountryView';
import { DishView } from './DishView';
import { EventView } from './EventView';
import { IngredientView } from './IngredientView';
import { PeopleTable } from './PeopleTable';
import { PersonView } from './PersonView';
import { RestaurantView } from './RestaurantView';
import { ReviewView } from './ReviewView';
import { OrderView } from './OrderView';
import { ProjectView } from './ProjectView';
import { SupplierView } from './SupplierView';
import { TaskView } from './TaskView';
import { TeamView } from './TeamView';
import { AssistantView } from '../assistant/AssistantView';
import { getCard } from '../assistant/cards';
import { getOrder, getProject, getSupplier, getTask, getTeam } from '../work';
import chartDonut from '../assets/figma/chart-donut.svg';
import { getPeriod, metricLabel, parseMetricId, QUARTER } from '../finance';
import { ComparisonView } from './finance/ComparisonView';
import { MetricView } from './finance/MetricView';
import { ReportView } from './finance/ReportView';

export type EntityDef = {
  icon: string;
  label: string;
  /** Ширина розгорнутої ноди, px (ADR-0004). */
  width: number;
  accent: string;
  title: (id: string) => string;
  /** Підзаголовок у хедері картки; за замовчуванням — label (ADR-0008). */
  subtitle?: (id: string) => string;
  /** SVG-іконка з Figma замість емодзі в бейджі хедера. */
  iconSrc?: string;
  /** 'bare' — нода без хедера, вміст сам є карткою (metric, comparison). */
  /** 'columns' (за замовчуванням) — секції течуть колонками, як сторінка; 'block' — вміст має власну сітку (ADR-0016). */
  flow?: 'columns' | 'block';
  chrome?: 'card' | 'bare';
  Component: ComponentType<{ id: string }>;
};

export const registry: Record<EntityType, EntityDef> = {
  people: {
    icon: '👥',
    label: 'Люди',
    width: 760,
    accent: '#6366f1',
    flow: 'block',
    title: () => 'Усі люди',
    Component: PeopleTable,
  },
  person: {
    icon: '🧑',
    label: 'Людина',
    width: 640,
    accent: '#0ea5e9',
    title: (id) => getPerson(id).name,
    Component: PersonView,
  },
  restaurant: {
    icon: '🍽️',
    label: 'Ресторан',
    width: 640,
    accent: '#f97316',
    title: (id) => getRestaurant(id).name,
    Component: RestaurantView,
  },
  city: {
    icon: '🏙️',
    label: 'Місто',
    width: 600,
    accent: '#10b981',
    title: (id) => getCity(id).name,
    Component: CityView,
  },
  dish: {
    icon: '🥟',
    label: 'Страва',
    width: 520,
    accent: '#e11d48',
    title: (id) => getDish(id).name,
    Component: DishView,
  },
  company: {
    icon: '🏢',
    label: 'Компанія',
    width: 600,
    accent: '#8b5cf6',
    title: (id) => getCompany(id).name,
    Component: CompanyView,
  },
  country: {
    icon: '🌍',
    label: 'Країна',
    width: 460,
    accent: '#0d9488',
    title: (id) => `${getCountry(id).flag} ${getCountry(id).name}`,
    Component: CountryView,
  },
  ingredient: {
    icon: '🧄',
    label: 'Інгредієнт',
    width: 460,
    accent: '#84cc16',
    title: (id) => getIngredient(id).name,
    Component: IngredientView,
  },
  event: {
    icon: '📅',
    label: 'Подія',
    width: 560,
    accent: '#d946ef',
    title: (id) => getEvent(id).name,
    Component: EventView,
  },
  review: {
    icon: '⭐',
    label: 'Відгук',
    width: 480,
    accent: '#eab308',
    title: (id) => `★ ${getReview(id).rating} · ${getPerson(getReview(id).authorId).name}`,
    Component: ReviewView,
  },
  report: {
    icon: '📊',
    label: 'Фінансовий звіт',
    width: 831,
    accent: '#34d399',
    iconSrc: chartDonut,
    flow: 'block',
    title: (id) => `Financial Report ${getRestaurant(id).name}`,
    subtitle: () => `${QUARTER} Overview`,
    Component: ReportView,
  },
  metric: {
    icon: '📈',
    label: 'Показник',
    width: 334,
    accent: '#34d399',
    chrome: 'bare',
    title: (id) => {
      const { restaurantId, kind } = parseMetricId(id);
      return `${metricLabel[kind].chart} · ${getRestaurant(restaurantId).name}`;
    },
    Component: MetricView,
  },
  comparison: {
    icon: '⚖️',
    label: 'Порівняння',
    width: 726,
    accent: '#34d399',
    chrome: 'bare',
    title: (id) => {
      const { kind, period } = parseMetricId(id);
      return `${metricLabel[kind].chart}: ${getPeriod(period ?? '').label} vs ${QUARTER}`;
    },
    Component: ComparisonView,
  },
  team: {
    icon: '🧩',
    label: 'Команда',
    width: 560,
    accent: '#38bdf8',
    title: (id) => getTeam(id).name,
    Component: TeamView,
  },
  project: {
    icon: '🗂️',
    label: 'Проєкт',
    width: 640,
    accent: '#a78bfa',
    title: (id) => getProject(id).name,
    Component: ProjectView,
  },
  task: {
    icon: '✅',
    label: 'Задача',
    width: 520,
    accent: '#22c55e',
    title: (id) => getTask(id).title,
    Component: TaskView,
  },
  supplier: {
    icon: '🚚',
    label: 'Постачальник',
    width: 560,
    accent: '#f59e0b',
    title: (id) => getSupplier(id).name,
    Component: SupplierView,
  },
  order: {
    icon: '🧾',
    label: 'Замовлення',
    width: 480,
    accent: '#fb7185',
    title: (id) => `Замовлення №${getOrder(id).id.slice(1)}`,
    Component: OrderView,
  },
  assistant: {
    icon: '✦',
    label: 'Асистент',
    width: 520,
    accent: '#a3e635',
    flow: 'block',
    title: (id) => getCard(id).title,
    Component: AssistantView,
  },
};
