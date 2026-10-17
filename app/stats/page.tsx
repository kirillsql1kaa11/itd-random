import type { Metadata } from 'next';
import { StatsView } from '@/components/StatsView';

export const metadata: Metadata = {
  title: 'Статистика',
  description: 'Локальная статистика ваших игр в викторине «Кто автор поста?».',
};

export default function StatsPage() {
  return <StatsView />;
}
