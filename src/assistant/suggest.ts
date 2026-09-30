// Підказки під поточну картку (ADR-0018): фрази, які мок гарантовано розуміє (перевірено тестом).
import * as db from '../data';
import { parseMetricId } from '../finance';
import type { EntityRef } from '../navigation';
import * as work from '../work';

export function suggestions(ref: EntityRef): string[] {
  const { type, id } = ref;
  switch (type) {
    case 'people':
      return ['Які ресторани у Львові?', 'Хто любить борщ?', 'Скільки заробила Пʼяна вишня?'];
    case 'person': {
      const p = db.getPerson(id);
      return [`Покажи ${db.getCompany(p.companyId).name}`, `Задачі ${p.name}`, 'Залиш коментар'];
    }
    case 'restaurant': {
      const r = db.getRestaurant(id);
      return [`Скільки заробила ${r.name}?`, `Що в меню ${r.name}?`, `Відгуки про ${r.name}`, 'Залиш коментар'];
    }
    case 'city': {
      const c = db.getCity(id);
      return [`Які ресторани в ${c.name}?`, `Хто живе в ${c.name}?`, 'Назад'];
    }
    case 'dish':
      return [`Хто любить ${db.getDish(id).name}?`, 'Назад'];
    case 'company': {
      const c = db.getCompany(id);
      return [`Хто працює в ${c.name}?`, 'Закрий компанію'];
    }
    case 'team':
      return [`Хто в команді ${work.getTeam(id).name}?`, 'Назад'];
    case 'report':
    case 'metric':
    case 'comparison': {
      const rid = type === 'report' ? id : parseMetricId(id).restaurantId;
      return ['Порівняй виручку з лютим', `Коментарі до звіту ${db.getRestaurant(rid).name}`, 'Залиш коментар'];
    }
    default:
      return ['Що ти вмієш?', 'Назад', 'Закрий усе крім фінансів'];
  }
}
