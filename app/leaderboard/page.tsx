import type { Metadata } from 'next';
import { LeaderboardView } from '@/components/LeaderboardView';

export const metadata: Metadata = {
  title: 'Рейтинг игроков',
  description: 'Таблица рекордов викторины «Кто автор поста?»: лучшие очки, серии и точность по режимам.',
};

export default function LeaderboardPage() {
  return <LeaderboardView />;
}
