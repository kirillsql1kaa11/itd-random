'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Volume2, VolumeX, HelpCircle } from 'lucide-react';
import { soundFx } from '@/lib/sound';
import { useApp } from './AppProvider';

const NAV_ITEMS = [
  { href: '/', label: 'Главная' },
  { href: '/leaderboard', label: 'Рейтинг' },
  { href: '/authors', label: 'Авторы' },
  { href: '/stats', label: 'Статистика' },
];

export function Header() {
  const pathname = usePathname();
  const { openRules } = useApp();
  const [isMuted, setIsMuted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMuted(soundFx.isMuted());
  }, []);

  const handleToggleSound = () => {
    const nextMuted = soundFx.toggleMute();
    setIsMuted(nextMuted);
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="logo-group">
          <Link href="/" className="logo-badge" onClick={() => soundFx.playClick()}>
            <span className="logo-dot"></span>
            ИТД <span style={{ fontWeight: 400, opacity: 0.6 }}>· КТО АВТОР?</span>
          </Link>
        </div>

        <nav className="nav-tabs" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`nav-tab-btn ${isActive(item.href) ? 'active' : ''}`}
              onClick={() => soundFx.playClick()}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-controls">
          <button
            type="button"
            className="icon-btn"
            onClick={openRules}
            title="Правила игры"
          >
            <HelpCircle size={16} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={handleToggleSound}
            title={mounted && isMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {mounted && isMuted ? <VolumeX size={16} /> : <Volume2 size={16} style={{ color: 'var(--accent-blue)' }} />}
          </button>
        </div>
      </div>
    </header>
  );
}
