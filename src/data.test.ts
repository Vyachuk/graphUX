import { describe, expect, it } from 'vitest';
import * as db from './data';
import { registry } from './entities/registry';

// ADR-0007: кожне посилання в мок-даних має вказувати на існуючу сутність.
describe('цілісність мок-даних', () => {
  it.each(db.people.map((p) => [p.name, p] as const))('людина %s', (_, p) => {
    expect(() => [
      db.getCity(p.cityId),
      db.getCompany(p.companyId),
      db.getRestaurant(p.favoriteRestaurantId),
      db.getDish(p.favoriteDishId),
      ...p.friendIds.map(db.getPerson),
    ]).not.toThrow();
    expect(p.friendIds).not.toContain(p.id);
  });

  it('міста, країни, компанії, ресторани', () => {
    expect(() => {
      db.cities.forEach((c) => db.getCountry(c.countryId));
      db.countries.forEach((c) => db.getCity(c.capitalId));
      db.companies.forEach((c) => db.getCity(c.cityId));
      db.restaurants.forEach((r) => db.getCity(r.cityId));
    }).not.toThrow();
  });

  it('страви, події, відгуки', () => {
    expect(() => {
      db.dishes.forEach((d) => [db.getRestaurant(d.restaurantId), ...d.ingredientIds.map(db.getIngredient)]);
      db.events.forEach((e) => [
        db.getCity(e.cityId),
        db.getRestaurant(e.venueId),
        db.getCompany(e.organizerId),
        ...e.attendeeIds.map(db.getPerson),
      ]);
      db.reviews.forEach((r) => [db.getPerson(r.authorId), db.getRestaurant(r.restaurantId)]);
    }).not.toThrow();
  });

  it('подія проходить у місті свого ресторану', () => {
    for (const e of db.events) expect(db.getRestaurant(e.venueId).cityId).toBe(e.cityId);
  });

  it('унікальні id у кожній колекції', () => {
    const collections = [db.people, db.restaurants, db.cities, db.countries, db.dishes, db.ingredients, db.companies, db.events, db.reviews];
    for (const list of collections) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('жодна сутність не є тупиком: у кожної є хоча б один зворотний зв\'язок', () => {
    for (const c of db.cities) expect(db.residentsOf(c.id).length + db.restaurantsIn(c.id).length).toBeGreaterThan(0);
    for (const i of db.ingredients) expect(db.dishesWith(i.id).length).toBeGreaterThan(0);
    for (const c of db.companies) expect(db.employeesOf(c.id).length).toBeGreaterThan(0);
    for (const r of db.restaurants) expect(db.reviewsOf(r.id).length).toBeGreaterThan(0);
  });

  it('ціна у валюті країни ресторану', () => {
    expect(db.formatPrice(db.getDish('d1'))).toBe('240 ₴');
    expect(db.formatPrice(db.getDish('d7'))).toBe('38 zł');
  });
});

describe('registry', () => {
  it('title кожного типу працює на реальних даних', () => {
    const samples = {
      people: 'all', person: 'p1', restaurant: 'r1', city: 'kyiv', dish: 'd1',
      company: 'c1', country: 'ua', ingredient: 'beet', event: 'e1', review: 'rv1',
    } as const;
    for (const [type, id] of Object.entries(samples)) {
      expect(registry[type as keyof typeof samples].title(id)).toBeTruthy();
    }
  });
});
