import type { Metadata } from 'next';
import { HomeView } from '@/components/HomeView';

export const metadata: Metadata = {
  title: 'Главная',
  description: 'Викторина «Кто автор поста?» по соцсети ИТД: угадывай авторов по скриншотам и соревнуйся в рейтинге.',
};

export default function HomePage() {
  return <HomeView />;
}
