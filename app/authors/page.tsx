import type { Metadata } from 'next';
import { AuthorsView } from '@/components/AuthorsView';

export const metadata: Metadata = {
  title: 'Авторы ИТД',
  description: 'Каталог авторов соцсети ИТД с поиском по имени, никнейму и стилю постов.',
};

export default function AuthorsPage() {
  return <AuthorsView />;
}
