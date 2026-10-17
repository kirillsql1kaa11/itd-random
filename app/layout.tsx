import type { Metadata } from 'next';
import { Inter, Unbounded } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/components/AppProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-unbounded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ИТД - КТО АВТОР?',
    template: '%s — ИТД Кто автор?',
  },
  description: 'Угадай автора поста по скриншоту из соцсети ИТД, викторина с рейтингом игроков.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${inter.variable} ${unbounded.variable}`}>
      <body className="antialiased flex flex-col min-h-screen bg-[#08080a] text-[#f5f5f7]">
        <AppProvider>
          <Header />
          <main className="main-content">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
