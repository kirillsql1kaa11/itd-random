export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

const ADJECTIVES = [
  'Быстрый', 'Умный', 'Тихий', 'Четкий', 'Ловкий', 'Дерзкий', 'Редкий',
  'Хитрый', 'Тайный', 'Дикий', 'Яркий', 'Смелый', 'Сонный', 'Вечный'
];

const NOUNS = [
  'Скроллер', 'Мемолог', 'Думер', 'Бэкендер', 'Фронтендер', 'ИТДшник',
  'Аналитик', 'Тестер', 'Архитектор', 'Олимпиадник', 'Сеньор', 'Джун'
];

export function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}${noun}_${num}`;
}

export function formatScore(score: number): string {
  return new Intl.NumberFormat('ru-RU').format(score);
}
