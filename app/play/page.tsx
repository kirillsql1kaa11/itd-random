import type { Metadata } from 'next';
import { PlayView } from '@/components/PlayView';

export const metadata: Metadata = {
  title: 'Игра',
  robots: { index: false, follow: false },
};

export default function PlayPage() {
  return <PlayView />;
}
