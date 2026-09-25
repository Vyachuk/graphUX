// Мок-дані як граф зв'язків (ADR-0006, ADR-0007). Зворотні зв'язки — через селектори.

export type Person = {
  id: string;
  name: string;
  age: number;
  role: string;
  email: string;
  cityId: string;
  companyId: string;
  favoriteRestaurantId: string;
  favoriteDishId: string;
  friendIds: string[];
};

export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  priceLevel: 1 | 2 | 3 | 4;
  cityId: string;
  address: string;
};

export type City = {
  id: string;
  name: string;
  countryId: string;
  population: number;
};

export type Country = {
  id: string;
  name: string;
  flag: string;
  currency: string;
  language: string;
  capitalId: string;
};

export type Dish = {
  id: string;
  name: string;
  price: number;
  restaurantId: string;
  ingredientIds: string[];
};

export type Ingredient = {
  id: string;
  name: string;
  category: 'Овочі' | 'Фрукти' | 'Молочне' | 'Риба' | 'Бакалія' | 'Інше';
  allergen: boolean;
};

export type Company = {
  id: string;
  name: string;
  industry: string;
  founded: number;
  cityId: string;
};

export type Event = {
  id: string;
  name: string;
  date: string;
  cityId: string;
  venueId: string;
  organizerId: string;
  attendeeIds: string[];
};

export type Review = {
  id: string;
  authorId: string;
  restaurantId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  date: string;
};

export const countries: Country[] = [
  { id: 'ua', name: 'Україна', flag: '🇺🇦', currency: 'UAH', language: 'українська', capitalId: 'kyiv' },
  { id: 'pl', name: 'Польща', flag: '🇵🇱', currency: 'PLN', language: 'польська', capitalId: 'warsaw' },
];

export const cities: City[] = [
  { id: 'kyiv', name: 'Київ', countryId: 'ua', population: 2_950_000 },
  { id: 'lviv', name: 'Львів', countryId: 'ua', population: 720_000 },
  { id: 'odesa', name: 'Одеса', countryId: 'ua', population: 1_010_000 },
  { id: 'warsaw', name: 'Варшава', countryId: 'pl', population: 1_860_000 },
  { id: 'krakow', name: 'Краків', countryId: 'pl', population: 800_000 },
];

export const companies: Company[] = [
  { id: 'c1', name: 'Hlib Labs', industry: 'SaaS', founded: 2015, cityId: 'kyiv' },
  { id: 'c2', name: 'Kava Systems', industry: 'FoodTech', founded: 2019, cityId: 'lviv' },
  { id: 'c3', name: 'Black Sea Data', industry: 'Analytics', founded: 2012, cityId: 'odesa' },
  { id: 'c4', name: 'Wawel Soft', industry: 'Fintech', founded: 2017, cityId: 'krakow' },
];

export const restaurants: Restaurant[] = [
  { id: 'r1', name: 'Kanapa', cuisine: 'Українська', rating: 4.7, priceLevel: 3, cityId: 'kyiv', address: 'Андріївський узвіз, 19' },
  { id: 'r2', name: 'Baczewski', cuisine: 'Галицька', rating: 4.8, priceLevel: 3, cityId: 'lviv', address: 'вул. Шевська, 8' },
  { id: 'r3', name: 'Dacha', cuisine: 'Домашня', rating: 4.6, priceLevel: 2, cityId: 'odesa', address: 'Французький бульвар, 85' },
  { id: 'r4', name: 'Sushi Master', cuisine: 'Японська', rating: 4.2, priceLevel: 2, cityId: 'kyiv', address: 'вул. Хрещатик, 22' },
  { id: 'r5', name: 'Pod Baranem', cuisine: 'Польська', rating: 4.5, priceLevel: 2, cityId: 'krakow', address: 'ul. Świętej Gertrudy, 21' },
  { id: 'r6', name: 'Stary Dom', cuisine: 'Польська', rating: 4.4, priceLevel: 3, cityId: 'warsaw', address: 'ul. Puławska, 104' },
  { id: 'r7', name: 'Реберня', cuisine: 'Гриль', rating: 4.6, priceLevel: 3, cityId: 'lviv', address: 'пл. Ринок, 18' },
  { id: 'r8', name: 'Пʼяна вишня', cuisine: 'Бар', rating: 4.7, priceLevel: 2, cityId: 'lviv', address: 'пл. Ринок, 11' },
  { id: 'r9', name: 'ВСЛ', cuisine: 'Українська', rating: 4.5, priceLevel: 2, cityId: 'lviv', address: 'вул. Друкарська, 6' },
];

export const ingredients: Ingredient[] = [
  { id: 'beet', name: 'Буряк', category: 'Овочі', allergen: false },
  { id: 'cabbage', name: 'Капуста', category: 'Овочі', allergen: false },
  { id: 'garlic', name: 'Часник', category: 'Овочі', allergen: false },
  { id: 'potato', name: 'Картопля', category: 'Овочі', allergen: false },
  { id: 'onion', name: 'Цибуля', category: 'Овочі', allergen: false },
  { id: 'cherry', name: 'Вишня', category: 'Фрукти', allergen: false },
  { id: 'apple', name: 'Яблуко', category: 'Фрукти', allergen: false },
  { id: 'sourcream', name: 'Сметана', category: 'Молочне', allergen: true },
  { id: 'cottage', name: 'Сир кисломолочний', category: 'Молочне', allergen: true },
  { id: 'butter', name: 'Масло', category: 'Молочне', allergen: true },
  { id: 'creamcheese', name: 'Крем-сир', category: 'Молочне', allergen: true },
  { id: 'herring', name: 'Оселедець', category: 'Риба', allergen: true },
  { id: 'salmon', name: 'Лосось', category: 'Риба', allergen: true },
  { id: 'flour', name: 'Борошно', category: 'Бакалія', allergen: true },
  { id: 'rice', name: 'Рис', category: 'Бакалія', allergen: false },
  { id: 'sugar', name: 'Цукор', category: 'Бакалія', allergen: false },
  { id: 'egg', name: 'Яйце', category: 'Інше', allergen: true },
  { id: 'honey', name: 'Мед', category: 'Інше', allergen: false },
];

export const dishes: Dish[] = [
  { id: 'd1', name: 'Борщ з пампушками', price: 240, restaurantId: 'r1', ingredientIds: ['beet', 'cabbage', 'garlic', 'sourcream', 'flour'] },
  { id: 'd2', name: 'Вареники з вишнею', price: 210, restaurantId: 'r1', ingredientIds: ['flour', 'cherry', 'sugar'] },
  { id: 'd3', name: 'Деруни', price: 190, restaurantId: 'r2', ingredientIds: ['potato', 'onion', 'sourcream', 'egg'] },
  { id: 'd4', name: 'Сирники', price: 170, restaurantId: 'r2', ingredientIds: ['cottage', 'egg', 'flour', 'honey'] },
  { id: 'd5', name: 'Форшмак', price: 230, restaurantId: 'r3', ingredientIds: ['herring', 'apple', 'butter', 'onion'] },
  { id: 'd6', name: 'Філадельфія рол', price: 320, restaurantId: 'r4', ingredientIds: ['salmon', 'rice', 'creamcheese'] },
  { id: 'd7', name: 'Пероги руські', price: 38, restaurantId: 'r5', ingredientIds: ['flour', 'potato', 'cottage', 'onion'] },
  { id: 'd8', name: 'Бігос', price: 45, restaurantId: 'r6', ingredientIds: ['cabbage', 'onion', 'apple'] },
  { id: 'd9', name: 'Реберця BBQ', price: 390, restaurantId: 'r7', ingredientIds: ['onion', 'garlic', 'honey'] },
  { id: 'd10', name: 'Вишнівка з сирником', price: 150, restaurantId: 'r8', ingredientIds: ['cherry', 'cottage', 'sugar'] },
  { id: 'd11', name: 'Вареники з картоплею', price: 180, restaurantId: 'r9', ingredientIds: ['flour', 'potato', 'onion', 'sourcream'] },
];

export const people: Person[] = [
  { id: 'p1', name: 'Олена Коваль', age: 29, role: 'Product Designer', email: 'olena@example.com', cityId: 'kyiv', companyId: 'c1', favoriteRestaurantId: 'r1', favoriteDishId: 'd2', friendIds: ['p2', 'p4'] },
  { id: 'p2', name: 'Андрій Мельник', age: 34, role: 'Backend Engineer', email: 'andrii@example.com', cityId: 'lviv', companyId: 'c2', favoriteRestaurantId: 'r2', favoriteDishId: 'd3', friendIds: ['p1', 'p3', 'p7'] },
  { id: 'p3', name: 'Ірина Шевчук', age: 41, role: 'Engineering Manager', email: 'iryna@example.com', cityId: 'odesa', companyId: 'c3', favoriteRestaurantId: 'r3', favoriteDishId: 'd5', friendIds: ['p2', 'p5'] },
  { id: 'p4', name: 'Максим Бондар', age: 25, role: 'Frontend Engineer', email: 'maksym@example.com', cityId: 'kyiv', companyId: 'c1', favoriteRestaurantId: 'r4', favoriteDishId: 'd6', friendIds: ['p1', 'p6'] },
  { id: 'p5', name: 'Софія Ткаченко', age: 31, role: 'Data Analyst', email: 'sofia@example.com', cityId: 'lviv', companyId: 'c3', favoriteRestaurantId: 'r2', favoriteDishId: 'd4', friendIds: ['p3', 'p8'] },
  { id: 'p6', name: 'Тарас Кравець', age: 38, role: 'CTO', email: 'taras@example.com', cityId: 'kyiv', companyId: 'c1', favoriteRestaurantId: 'r1', favoriteDishId: 'd1', friendIds: ['p4', 'p1'] },
  { id: 'p7', name: 'Marek Nowak', age: 36, role: 'Solutions Architect', email: 'marek@example.com', cityId: 'krakow', companyId: 'c4', favoriteRestaurantId: 'r5', favoriteDishId: 'd7', friendIds: ['p2', 'p8'] },
  { id: 'p8', name: 'Anna Wiśniewska', age: 28, role: 'QA Engineer', email: 'anna@example.com', cityId: 'warsaw', companyId: 'c4', favoriteRestaurantId: 'r6', favoriteDishId: 'd8', friendIds: ['p7', 'p5'] },
];

export const events: Event[] = [
  { id: 'e1', name: 'Kyiv Food Fest', date: '2026-10-12', cityId: 'kyiv', venueId: 'r1', organizerId: 'c1', attendeeIds: ['p1', 'p4', 'p6'] },
  { id: 'e2', name: 'Lviv Coffee Days', date: '2026-11-03', cityId: 'lviv', venueId: 'r2', organizerId: 'c2', attendeeIds: ['p2', 'p5'] },
  { id: 'e3', name: 'Odesa Data Meetup', date: '2026-10-28', cityId: 'odesa', venueId: 'r3', organizerId: 'c3', attendeeIds: ['p3', 'p1', 'p5'] },
  { id: 'e4', name: 'Kraków Dev Dinner', date: '2026-12-05', cityId: 'krakow', venueId: 'r5', organizerId: 'c4', attendeeIds: ['p7', 'p2', 'p8'] },
];

export const reviews: Review[] = [
  { id: 'rv1', authorId: 'p1', restaurantId: 'r1', rating: 5, text: 'Найкращі вареники з вишнею в місті.', date: '2026-08-14' },
  { id: 'rv2', authorId: 'p6', restaurantId: 'r1', rating: 4, text: 'Борщ бездоганний, але довго чекали столик.', date: '2026-07-02' },
  { id: 'rv3', authorId: 'p2', restaurantId: 'r2', rating: 5, text: 'Атмосфера старого Львова і чудові деруни.', date: '2026-06-21' },
  { id: 'rv4', authorId: 'p5', restaurantId: 'r2', rating: 4, text: 'Сирники — топ. Ціни трохи кусаються.', date: '2026-09-01' },
  { id: 'rv5', authorId: 'p3', restaurantId: 'r3', rating: 5, text: 'Форшмак як у бабусі, тераса — магія.', date: '2026-08-30' },
  { id: 'rv6', authorId: 'p4', restaurantId: 'r4', rating: 3, text: 'Швидко, але рис переварений.', date: '2026-09-10' },
  { id: 'rv7', authorId: 'p7', restaurantId: 'r5', rating: 5, text: 'Pierogi ruskie jak u mamy.', date: '2026-05-17' },
  { id: 'rv8', authorId: 'p2', restaurantId: 'r5', rating: 4, text: 'Був у відрядженні — пероги варті поїздки.', date: '2026-09-12' },
  { id: 'rv9', authorId: 'p8', restaurantId: 'r6', rating: 4, text: 'Solidny bigos, dobra obsługa.', date: '2026-08-08' },
  { id: 'rv10', authorId: 'p5', restaurantId: 'r7', rating: 5, text: 'Реберця з гонгом — must visit.', date: '2026-07-19' },
  { id: 'rv11', authorId: 'p2', restaurantId: 'r8', rating: 4, text: 'Класика Ринку, завжди черга.', date: '2026-08-02' },
  { id: 'rv12', authorId: 'p5', restaurantId: 'r9', rating: 4, text: 'Чесні домашні вареники.', date: '2026-09-05' },
];

const byId = <T extends { id: string }>(list: T[]) => (id: string) => {
  const item = list.find((x) => x.id === id);
  if (!item) throw new Error(`Unknown id: ${id}`);
  return item;
};

export const getPerson = byId(people);
export const getRestaurant = byId(restaurants);
export const getCity = byId(cities);
export const getCountry = byId(countries);
export const getDish = byId(dishes);
export const getIngredient = byId(ingredients);
export const getCompany = byId(companies);
export const getEvent = byId(events);
export const getReview = byId(reviews);

export const residentsOf = (cityId: string) => people.filter((p) => p.cityId === cityId);
export const restaurantsIn = (cityId: string) => restaurants.filter((r) => r.cityId === cityId);
export const companiesIn = (cityId: string) => companies.filter((c) => c.cityId === cityId);
export const eventsIn = (cityId: string) => events.filter((e) => e.cityId === cityId);
export const citiesOf = (countryId: string) => cities.filter((c) => c.countryId === countryId);
export const fansOf = (restaurantId: string) => people.filter((p) => p.favoriteRestaurantId === restaurantId);
export const dishesOf = (restaurantId: string) => dishes.filter((d) => d.restaurantId === restaurantId);
export const reviewsOf = (restaurantId: string) => reviews.filter((r) => r.restaurantId === restaurantId);
export const eventsAt = (restaurantId: string) => events.filter((e) => e.venueId === restaurantId);
export const loversOf = (dishId: string) => people.filter((p) => p.favoriteDishId === dishId);
export const dishesWith = (ingredientId: string) => dishes.filter((d) => d.ingredientIds.includes(ingredientId));
export const employeesOf = (companyId: string) => people.filter((p) => p.companyId === companyId);
export const eventsBy = (companyId: string) => events.filter((e) => e.organizerId === companyId);
export const eventsOf = (personId: string) => events.filter((e) => e.attendeeIds.includes(personId));
export const reviewsBy = (personId: string) => reviews.filter((r) => r.authorId === personId);

const currencySymbol: Record<string, string> = { UAH: '₴', PLN: 'zł' };

/** Ціна страви у валюті країни, де розташований ресторан. */
export const formatPrice = (dish: Dish) => {
  const { currency } = getCountry(getCity(getRestaurant(dish.restaurantId).cityId).countryId);
  return `${dish.price} ${currencySymbol[currency] ?? currency}`;
};
