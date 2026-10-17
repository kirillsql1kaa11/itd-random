import type { Metadata } from 'next';
import { ResultPage } from '@/components/ResultPage';

export const metadata: Metadata = {
  title: 'Результат',
  robots: { index: false, follow: false },
};

export default function ResultRoutePage() {
  return <ResultPage />;
}
